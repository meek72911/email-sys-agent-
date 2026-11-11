-- Gmail OAuth metadata. Secrets are encrypted by the server before reaching this table.
create table public.gmail_oauth_attempts (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id),state_hash text not null unique check(state_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes',consumed_at timestamptz,stored_at timestamptz
);
create table public.gmail_credentials (
 org_id uuid primary key references public.organizations(id) on delete cascade,
 owner_id uuid not null references auth.users(id),ciphertext text,scope text not null,
 expires_at timestamptz,status text not null check(status in ('active','revocation_pending','disconnected')),
 version integer not null default 1,updated_at timestamptz not null default now(),
 check ((status in ('active','revocation_pending') and ciphertext is not null and expires_at is not null) or (status='disconnected' and ciphertext is null and expires_at is null))
);
alter table public.gmail_oauth_attempts enable row level security;
alter table public.gmail_credentials enable row level security;
revoke all on public.gmail_oauth_attempts,public.gmail_credentials from public,anon,authenticated;

create function public.relay_require_gmail_owner(p_org uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.memberships where org_id=p_org and user_id=p_user and role='owner' for share;
 if not found then raise exception 'Owner access required'; end if;
end $$;
revoke all on function public.relay_require_gmail_owner(uuid,uuid) from public,anon,authenticated;

create function public.relay_begin_gmail_oauth(p_org uuid,p_state_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();attempt uuid;
begin
 if uid is null or p_state_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request'; end if;
 perform public.relay_require_gmail_owner(p_org,uid);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org::text,12));
 if exists(select 1 from public.gmail_credentials where org_id=p_org and status<>'disconnected') then raise exception 'Disconnect the existing Gmail connection first'; end if;
 if (select count(*) from public.gmail_oauth_attempts where org_id=p_org and created_at>now()-interval '10 minutes')>=5 then raise exception 'Too many authorization attempts'; end if;
 delete from public.gmail_oauth_attempts where org_id=p_org and expires_at<now()-interval '1 day';
 insert into public.gmail_oauth_attempts(org_id,user_id,state_hash) values(p_org,uid,p_state_hash) returning id into attempt;
 return attempt;
end $$;
create function public.relay_consume_gmail_oauth(p_state_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();attempt public.gmail_oauth_attempts%rowtype;
begin
 select * into attempt from public.gmail_oauth_attempts where state_hash=p_state_hash and user_id=uid for update;
 if not found or attempt.expires_at<=now() or attempt.consumed_at is not null then raise exception 'Authorization state unavailable'; end if;
 perform public.relay_require_gmail_owner(attempt.org_id,uid);
 update public.gmail_oauth_attempts set consumed_at=now() where id=attempt.id;return attempt.id;
end $$;
create function public.relay_store_gmail_credential(p_attempt uuid,p_ciphertext text,p_expires timestamptz,p_scope text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();a public.gmail_oauth_attempts%rowtype;written uuid;
begin
 select * into a from public.gmail_oauth_attempts where id=p_attempt and user_id=uid for update;
 if not found or a.consumed_at is null or a.stored_at is not null or a.expires_at<=now() then raise exception 'Authorization state unavailable'; end if;
 perform public.relay_require_gmail_owner(a.org_id,uid);
 if p_ciphertext is null or length(p_ciphertext) not between 40 and 25000 or p_ciphertext !~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' or p_scope is distinct from 'https://www.googleapis.com/auth/gmail.readonly' or p_expires is null or p_expires<=now() or p_expires>now()+interval '1 day' then raise exception 'Invalid credential'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.org_id::text,12));
 if exists(select 1 from public.gmail_credentials where org_id=a.org_id and status<>'disconnected') then raise exception 'Disconnect the existing Gmail connection first'; end if;
 insert into public.gmail_credentials(org_id,owner_id,ciphertext,scope,expires_at,status) values(a.org_id,uid,p_ciphertext,p_scope,p_expires,'active')
 on conflict(org_id) do update set owner_id=excluded.owner_id,ciphertext=excluded.ciphertext,scope=excluded.scope,expires_at=excluded.expires_at,status='active',version=public.gmail_credentials.version+1,updated_at=now() where public.gmail_credentials.status='disconnected' returning org_id into written;
 if written is null then raise exception 'Disconnect the existing Gmail connection first'; end if;
 update public.gmail_oauth_attempts set stored_at=now() where id=a.id;
end $$;

create function public.relay_get_gmail_credential(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();c public.gmail_credentials%rowtype;
begin
 perform public.relay_require_gmail_owner(p_org,uid);
 select * into c from public.gmail_credentials where org_id=p_org and owner_id=uid;
 if not found then return null; end if;
 return jsonb_build_object('ciphertext',c.ciphertext,'expiresAt',c.expires_at,'scope',c.scope,'status',c.status,'version',c.version);
end $$;
create function public.relay_refresh_gmail_credential(p_org uuid,p_version integer,p_ciphertext text,p_expires timestamptz) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();updated uuid;
begin
 perform public.relay_require_gmail_owner(p_org,uid);
 if p_ciphertext is null or length(p_ciphertext) not between 40 and 25000 or p_ciphertext !~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' or p_expires is null or p_expires<=now() or p_expires>now()+interval '1 day' then raise exception 'Invalid credential'; end if;
 update public.gmail_credentials set ciphertext=p_ciphertext,expires_at=p_expires,version=version+1,updated_at=now() where org_id=p_org and owner_id=uid and status='active' and version=p_version returning org_id into updated;
 return updated is not null;
end $$;
create function public.relay_begin_gmail_disconnect(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();c public.gmail_credentials%rowtype;
begin
 perform public.relay_require_gmail_owner(p_org,uid);
 select * into c from public.gmail_credentials where org_id=p_org and owner_id=uid for update;
 if not found or c.status='disconnected' then return null; end if;
 if c.status='active' then update public.gmail_credentials set status='revocation_pending',version=version+1,updated_at=now() where org_id=p_org returning * into c; end if;
 return jsonb_build_object('ciphertext',c.ciphertext,'version',c.version,'status',c.status);
end $$;
-- Only a trusted server can confirm a remote revoke; failed/unknown revocations remain pending.
create function public.relay_finish_gmail_disconnect(p_org uuid,p_version integer) returns boolean language plpgsql security definer set search_path='' as $$
declare updated uuid;
begin
 update public.gmail_credentials set ciphertext=null,expires_at=null,status='disconnected',version=version+1,updated_at=now() where org_id=p_org and status='revocation_pending' and version=p_version returning org_id into updated;
 return updated is not null;
end $$;
create function public.relay_gmail_status(p_org uuid) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();state text;
begin
 if not exists(select 1 from public.memberships where org_id=p_org and user_id=uid) then raise exception 'Workspace unavailable'; end if;
 select status into state from public.gmail_credentials where org_id=p_org;
 return coalesce(state,'not_configured');
end $$;
revoke all on function public.relay_begin_gmail_oauth(uuid,text),public.relay_consume_gmail_oauth(text),public.relay_store_gmail_credential(uuid,text,timestamptz,text),public.relay_get_gmail_credential(uuid),public.relay_refresh_gmail_credential(uuid,integer,text,timestamptz),public.relay_begin_gmail_disconnect(uuid),public.relay_gmail_status(uuid) from public,anon;
grant execute on function public.relay_begin_gmail_oauth(uuid,text),public.relay_consume_gmail_oauth(text),public.relay_store_gmail_credential(uuid,text,timestamptz,text),public.relay_get_gmail_credential(uuid),public.relay_refresh_gmail_credential(uuid,integer,text,timestamptz),public.relay_begin_gmail_disconnect(uuid),public.relay_gmail_status(uuid) to authenticated;
revoke all on function public.relay_finish_gmail_disconnect(uuid,integer) from public,anon,authenticated;
grant execute on function public.relay_finish_gmail_disconnect(uuid,integer) to service_role;

create or replace function public.relay_delete_workspace(p_org uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();role_name text;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select role into role_name from public.memberships where org_id=p_org and user_id=uid for update;
 if role_name is distinct from 'owner' then raise exception 'Owner access required'; end if;
 perform 1 from public.organizations where id=p_org for update;
 if not found then raise exception 'Workspace unavailable'; end if;
 if exists(select 1 from public.external_dispatches where org_id=p_org) then raise exception 'External sandbox records require cleanup first'; end if;
 if exists(select 1 from public.gmail_credentials where org_id=p_org and status<>'disconnected') then raise exception 'Disconnect Gmail before deleting workspace'; end if;
 delete from public.organizations where id=p_org;
end $$;
