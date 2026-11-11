-- Durable record for the separate, synthetic HTTP CRM. No network I/O runs inside SQL.
create table public.external_dispatches (
 id uuid primary key references public.crm_actions(id) on delete cascade,
 org_id uuid not null references public.organizations(id) on delete cascade,
 case_id uuid not null,
 requested_by uuid not null references auth.users(id),
 from_status text not null,
 to_status text not null,
 payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
 state text not null default 'queued' check (state in ('queued','dispatching','needs_reconciliation','succeeded','failed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (org_id,case_id) references public.cases(org_id,id) on delete cascade
);
alter table public.external_dispatches enable row level security;
revoke all on public.external_dispatches from public,anon,authenticated;
grant select on public.external_dispatches to authenticated,service_role;
create policy external_dispatch_read on public.external_dispatches for select to authenticated using (exists(select 1 from public.memberships m where m.org_id=external_dispatches.org_id and m.user_id=(select auth.uid())));

-- Once a separate CRM dispatch exists, a local CRM update must not race it.
create function public.relay_block_local_after_external() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.state <> 'succeeded' and new.state='succeeded' and exists(select 1 from public.external_dispatches d where d.id=new.id) then
  raise exception 'Action is reserved for external dispatch';
 end if;
 return new;
end $$;
revoke all on function public.relay_block_local_after_external() from public,anon,authenticated;
create trigger relay_external_dispatch_guard before update on public.crm_actions for each row execute function public.relay_block_local_after_external();

create function public.relay_prepare_external_dispatch(p_action uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a public.crm_actions%rowtype; c public.cases%rowtype; rev bigint; hash text;
begin
 select x.* into a from public.crm_actions x join public.memberships m on m.org_id=x.org_id where x.id=p_action and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Action unavailable'; end if;
 if exists(select 1 from public.external_dispatches where id=a.id) then return a.id; end if;
 if a.state<>'approved' or a.approved_by is null or not exists(select 1 from public.memberships where org_id=a.org_id and user_id=a.approved_by and role in ('owner','operator')) then raise exception 'Approval required'; end if;
 select * into c from public.cases where id=a.case_id for update;
 if c.source_key is null then raise exception 'Only synthetic fixture cases are supported'; end if;
 if c.ticket_status is distinct from a.from_status then raise exception 'Ticket changed'; end if;
 select knowledge_revision into rev from public.organizations where id=a.org_id for share;
 if rev is distinct from a.evidence_revision then raise exception 'Knowledge changed; create a new proposal'; end if;
 hash:=encode(pg_catalog.sha256(pg_catalog.convert_to(replace(pg_catalog.json_build_array(a.id::text,a.org_id::text,a.case_id::text,a.from_status,a.to_status)::text,', ',','),'UTF8')),'hex');
 insert into public.external_dispatches(id,org_id,case_id,requested_by,from_status,to_status,payload_hash) values(a.id,a.org_id,a.case_id,uid,a.from_status,a.to_status,hash);
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(a.org_id,a.case_id,uid,'external_action_queued',a.id);
 return a.id;
end $$;
revoke all on function public.relay_prepare_external_dispatch(uuid) from public,anon;
grant execute on function public.relay_prepare_external_dispatch(uuid) to authenticated;

-- Claim is atomic; roles and evidence are checked again immediately before dispatch.
create function public.relay_claim_external_dispatch(p_action uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.external_dispatches%rowtype; a public.crm_actions%rowtype; current_status text; rev bigint;
begin
 select * into d from public.external_dispatches where id=p_action for update;
 if not found then raise exception 'Dispatch unavailable'; end if;
 if d.state<>'queued' then return null; end if;
 select * into a from public.crm_actions where id=d.id for update;
 select ticket_status into current_status from public.cases where id=d.case_id for update;
 select knowledge_revision into rev from public.organizations where id=d.org_id for share;
 if a.state<>'approved' or a.approved_by is null or a.evidence_revision is distinct from rev or current_status is distinct from d.from_status
 or not exists(select 1 from public.memberships where org_id=d.org_id and user_id=d.requested_by and role in ('owner','operator'))
 or not exists(select 1 from public.memberships where org_id=d.org_id and user_id=a.approved_by and role in ('owner','operator')) then
  update public.external_dispatches set state='failed',updated_at=now() where id=d.id;
  insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(d.org_id,d.case_id,d.requested_by,'external_dispatch_rejected',d.id);
  return null;
 end if;
 update public.external_dispatches set state='dispatching',updated_at=now() where id=d.id;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(d.org_id,d.case_id,d.requested_by,'external_dispatch_started',d.id);
 return jsonb_build_object('id',d.id,'payloadHash',d.payload_hash,'state','dispatching');
end $$;
revoke all on function public.relay_claim_external_dispatch(uuid) from public,anon,authenticated;
grant execute on function public.relay_claim_external_dispatch(uuid) to service_role;

-- Only a trusted worker can record an outcome; terminal states never regress.
create function public.relay_mark_external_dispatch(p_action uuid,p_state text,p_hash text) returns text language plpgsql security definer set search_path='' as $$
declare d public.external_dispatches%rowtype;
begin
 if p_state not in ('needs_reconciliation','succeeded','failed') then raise exception 'Invalid state'; end if;
 select * into d from public.external_dispatches where id=p_action for update;
 if not found then raise exception 'Dispatch unavailable'; end if;
 if d.state in ('succeeded','failed') then return d.state; end if;
 if d.state='queued' then raise exception 'Dispatch not claimed'; end if;
 if p_hash is distinct from d.payload_hash then raise exception 'Payload mismatch'; end if;
 update public.external_dispatches set state=p_state,updated_at=now() where id=d.id;
 if p_state in ('succeeded','failed') then insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(d.org_id,d.case_id,d.requested_by,'external_dispatch_'||p_state,d.id); end if;
 return p_state;
end $$;
revoke all on function public.relay_mark_external_dispatch(uuid,text,text) from public,anon,authenticated;
grant execute on function public.relay_mark_external_dispatch(uuid,text,text) to service_role;
