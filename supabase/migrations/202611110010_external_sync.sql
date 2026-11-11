-- Reconcile confirmed external outcomes to the local case without changing
-- a ticket while another external action is awaiting a result.
alter table public.external_dispatches add column sync_state text not null default 'pending' check (sync_state in ('pending','synced','conflict'));
create unique index external_one_inflight_per_case on public.external_dispatches(case_id) where state in ('queued','dispatching','needs_reconciliation');

create function public.relay_guard_case_during_external() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.ticket_status is distinct from old.ticket_status and exists(select 1 from public.external_dispatches d where d.case_id=old.id and d.state in ('queued','dispatching','needs_reconciliation')) then
  raise exception 'Ticket has an external action awaiting a result';
 end if;
 return new;
end $$;
revoke all on function public.relay_guard_case_during_external() from public,anon,authenticated;
create trigger relay_guard_case_during_external before update of ticket_status on public.cases for each row execute function public.relay_guard_case_during_external();

create or replace function public.relay_block_local_after_external() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.state <> 'succeeded' and new.state='succeeded' and exists(select 1 from public.external_dispatches d where d.id=new.id and d.state<>'succeeded') then
  raise exception 'Action is reserved for external dispatch';
 end if;
 return new;
end $$;

-- A confirmed provider receipt is historical fact, even if knowledge changed while
-- the request was in flight. New proposals still bind the latest knowledge revision.
create or replace function public.relay_action_evidence_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare revision bigint; confirmed boolean:=false;
begin
 select knowledge_revision into revision from public.organizations where id=new.org_id for share;
 if not found then raise exception 'Workspace unavailable'; end if;
 if TG_OP='INSERT' then new.evidence_revision := revision;
 elsif new.state in ('approved','succeeded') and new.evidence_revision <> revision then
  if new.state='succeeded' then select exists(select 1 from public.external_dispatches d where d.id=new.id and d.state='succeeded') into confirmed; end if;
  if not confirmed then raise exception 'Knowledge changed; create a new proposal'; end if;
 end if;
 return new;
end $$;

create or replace function public.relay_mark_external_dispatch(p_action uuid,p_state text,p_hash text) returns text language plpgsql security definer set search_path='' as $$
declare d public.external_dispatches%rowtype; a public.crm_actions%rowtype; changed uuid;
begin
 if p_state is null or p_state not in ('needs_reconciliation','succeeded','failed') then raise exception 'Invalid state'; end if;
 select * into d from public.external_dispatches where id=p_action for update;
 if not found then raise exception 'Dispatch unavailable'; end if;
 if d.state in ('succeeded','failed') then return d.state; end if;
 if d.state='queued' then raise exception 'Dispatch not claimed'; end if;
 if p_hash is distinct from d.payload_hash then raise exception 'Payload mismatch'; end if;
 -- Serialize with local action execution before recording a provider outcome.
 select * into a from public.crm_actions where id=d.id for update;
 update public.external_dispatches set state=p_state,updated_at=now() where id=d.id;
 if p_state='succeeded' then
  update public.cases set ticket_status=d.to_status where id=d.case_id and ticket_status=d.from_status returning id into changed;
  if changed is not null then
   update public.crm_actions set state='succeeded',executed_at=now() where id=d.id and state='approved';
   update public.external_dispatches set sync_state='synced' where id=d.id;
  else
   -- The CRM result is still success; the local mismatch needs review.
   update public.external_dispatches set sync_state='conflict' where id=d.id;
  end if;
 end if;
 if p_state in ('succeeded','failed') then insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(d.org_id,d.case_id,d.requested_by,'external_dispatch_'||p_state,d.id); end if;
 return p_state;
end $$;
revoke all on function public.relay_mark_external_dispatch(uuid,text,text) from public,anon,authenticated;
grant execute on function public.relay_mark_external_dispatch(uuid,text,text) to service_role;
