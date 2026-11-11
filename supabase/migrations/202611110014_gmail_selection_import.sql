-- Explicitly selected Gmail imports. Inactive and expired selections cannot be imported.
alter table public.cases add column source_kind text not null default 'synthetic' check (source_kind in ('synthetic','gmail'));
alter table public.cases add column expires_at timestamptz;
alter table public.cases add constraint gmail_case_expiry check ((source_kind='gmail' and expires_at is not null) or (source_kind='synthetic' and expires_at is null));
drop policy cases_read_member on public.cases;
create policy cases_read_member on public.cases for select to authenticated using ((expires_at is null or expires_at>now()) and exists(select 1 from public.memberships m where m.org_id=cases.org_id and m.user_id=(select auth.uid())));
create table public.gmail_selections (
 org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id),message_id text not null check(length(message_id) between 1 and 256 and message_id ~ '^[A-Za-z0-9_-]+$'),
 credential_version integer not null,selected_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',
 primary key(org_id,user_id,message_id)
);
alter table public.gmail_selections enable row level security;
revoke all on public.gmail_selections from public,anon,authenticated;
create function public.relay_select_gmail_message(p_org uuid,p_message_id text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();c public.gmail_credentials%rowtype;
begin
 perform public.relay_require_gmail_owner(p_org,uid);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org::text || ':' || uid::text, 0));
 if p_message_id is null or length(p_message_id) not between 1 and 256 or p_message_id !~ '^[A-Za-z0-9_-]+$' then raise exception 'Invalid selection'; end if;
 select * into c from public.gmail_credentials where org_id=p_org and owner_id=uid and status='active' for share;
 if not found then raise exception 'Gmail is not active'; end if;
 delete from public.gmail_selections where org_id=p_org and user_id=uid and expires_at<=now();
 if (select count(*) from public.gmail_selections where org_id=p_org and user_id=uid)>=50 and not exists(select 1 from public.gmail_selections where org_id=p_org and user_id=uid and message_id=p_message_id) then raise exception 'Selection limit reached'; end if;
 insert into public.gmail_selections(org_id,user_id,message_id,credential_version) values(p_org,uid,p_message_id,c.version)
 on conflict(org_id,user_id,message_id) do update set credential_version=excluded.credential_version,selected_at=now(),expires_at=now()+interval '15 minutes';
end $$;
create function public.relay_is_gmail_message_selected(p_org uuid,p_message_id text) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 perform public.relay_require_gmail_owner(p_org,uid);
 return exists(select 1 from public.gmail_selections s join public.gmail_credentials c on c.org_id=s.org_id and c.owner_id=s.user_id where s.org_id=p_org and s.user_id=uid and s.message_id=p_message_id and s.expires_at>now() and c.status='active' and c.version=s.credential_version);
end $$;
revoke all on function public.relay_select_gmail_message(uuid,text),public.relay_is_gmail_message_selected(uuid,text) from public,anon;
grant execute on function public.relay_select_gmail_message(uuid,text),public.relay_is_gmail_message_selected(uuid,text) to authenticated;

-- Only a trusted server can create an imported case, and it rechecks selection,
-- credential generation and ownership inside the transaction.
create function public.relay_import_selected_gmail(p_org uuid,p_user uuid,p_message_id text,p_subject text,p_sender text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.gmail_credentials%rowtype;case_id uuid;
begin
 perform public.relay_require_gmail_owner(p_org,p_user);
 select * into c from public.gmail_credentials where org_id=p_org and owner_id=p_user and status='active' for share;
 if not found or not exists(select 1 from public.gmail_selections s where s.org_id=p_org and s.user_id=p_user and s.message_id=p_message_id and s.expires_at>now() and s.credential_version=c.version) then raise exception 'Selection unavailable'; end if;
 if p_message_id is null or p_message_id !~ '^[A-Za-z0-9_-]+$' or length(p_message_id)>256 or p_subject is null or length(p_subject) not between 1 and 300 or p_sender is null or length(p_sender) not between 1 and 300 or p_body is null or length(p_body) not between 1 and 10000 then raise exception 'Invalid message'; end if;
 insert into public.cases(org_id,customer,subject,message,source_key,source_kind,expires_at) values(p_org,p_sender,p_subject,p_body,'gmail:'||p_message_id,'gmail',now()+interval '30 days')
 on conflict(org_id,source_key) where source_key is not null do nothing returning id into case_id;
 if case_id is null then select id into case_id from public.cases where org_id=p_org and source_key='gmail:'||p_message_id and expires_at>now(); if case_id is null then raise exception 'Expired case awaits cleanup'; end if; return case_id;end if;
 insert into public.audit_events(org_id,case_id,actor_id,event_type) values(p_org,case_id,p_user,'gmail_message_imported');
 return case_id;
end $$;
revoke all on function public.relay_import_selected_gmail(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.relay_import_selected_gmail(uuid,uuid,text,text,text,text) to service_role;

-- Expired Gmail cases must not be modified even through a security-definer RPC.
create function public.relay_guard_expired_case() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.source_kind='gmail' and old.expires_at<=now() then raise exception 'Case has expired'; end if;
 return new;
end $$;
revoke all on function public.relay_guard_expired_case() from public,anon,authenticated;
create trigger relay_guard_expired_case before update on public.cases for each row execute function public.relay_guard_expired_case();
create function public.relay_guard_expired_action() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.cases c where c.id=new.case_id and c.source_kind='gmail' and c.expires_at<=now()) then raise exception 'Case has expired'; end if;
 return new;
end $$;
revoke all on function public.relay_guard_expired_action() from public,anon,authenticated;
create trigger relay_guard_expired_action before insert or update on public.crm_actions for each row execute function public.relay_guard_expired_action();
create function public.relay_purge_expired_gmail_cases() returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 delete from public.cases where source_kind='gmail' and expires_at<=now();get diagnostics removed=row_count;return removed;
end $$;
revoke all on function public.relay_purge_expired_gmail_cases() from public,anon,authenticated;
grant execute on function public.relay_purge_expired_gmail_cases() to service_role;

-- The separate sandbox service is restricted to synthetic fixtures.
create or replace function public.relay_prepare_external_dispatch(p_action uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();a public.crm_actions%rowtype;c public.cases%rowtype;rev bigint;hash text;
begin
 select x.* into a from public.crm_actions x join public.memberships m on m.org_id=x.org_id where x.id=p_action and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Action unavailable'; end if;
 if exists(select 1 from public.external_dispatches where id=a.id) then return a.id;end if;
 if a.state<>'approved' or a.approved_by is null or not exists(select 1 from public.memberships where org_id=a.org_id and user_id=a.approved_by and role in ('owner','operator')) then raise exception 'Approval required';end if;
 select * into c from public.cases where id=a.case_id for update;
 if c.source_kind<>'synthetic' or c.source_key is null then raise exception 'Only synthetic fixture cases are supported';end if;
 if c.ticket_status is distinct from a.from_status then raise exception 'Ticket changed';end if;
 select knowledge_revision into rev from public.organizations where id=a.org_id for share;
 if rev is distinct from a.evidence_revision then raise exception 'Knowledge changed; create a new proposal';end if;
 hash:=encode(pg_catalog.sha256(pg_catalog.convert_to(replace(pg_catalog.json_build_array(a.id::text,a.org_id::text,a.case_id::text,a.from_status,a.to_status)::text,', ',','),'UTF8')),'hex');
 insert into public.external_dispatches(id,org_id,case_id,requested_by,from_status,to_status,payload_hash) values(a.id,a.org_id,a.case_id,uid,a.from_status,a.to_status,hash);
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(a.org_id,a.case_id,uid,'external_action_queued',a.id);return a.id;
end $$;
