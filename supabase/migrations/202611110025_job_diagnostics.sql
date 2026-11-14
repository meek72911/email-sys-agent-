-- Safe, bounded diagnostics for local database job failures; never store raw errors.
alter table public.action_jobs add column failure_code text check(failure_code in ('authorization_changed','approval_unavailable','ticket_changed','knowledge_changed','external_pending','execution_blocked'));
alter table public.action_jobs add constraint action_jobs_failure_state check(failure_code is null or state='failed');
create function public.relay_finish_failed_local_job(p_job uuid,p_code text) returns void language plpgsql security definer set search_path='' as $$
declare j public.action_jobs%rowtype;
begin
 if p_code is null or p_code not in ('authorization_changed','approval_unavailable','ticket_changed','knowledge_changed','external_pending','execution_blocked') then raise exception 'Invalid failure'; end if;
 update public.action_jobs set state='failed',failure_code=p_code,finished_at=now() where id=p_job and state='queued' returning * into j;
 if not found then raise exception 'Job unavailable'; end if;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(j.org_id,j.case_id,j.requested_by,'action_job_failed',j.action_id);
end $$;
revoke all on function public.relay_finish_failed_local_job(uuid,text) from public,anon,authenticated,service_role;

create or replace function public.relay_run_action_job(p_job uuid) returns text language plpgsql security definer set search_path='' as $$
declare j public.action_jobs%rowtype; a public.crm_actions%rowtype; current_status text; revision bigint;
begin
 select * into j from public.action_jobs where id=p_job for update;
 if not found then raise exception 'Job unavailable'; end if;
 if j.state in ('succeeded','failed') then return j.state; end if;
 select * into a from public.crm_actions where id=j.action_id for update;
 if a.state='succeeded' then update public.action_jobs set state='succeeded',finished_at=now() where id=j.id; return 'succeeded'; end if;
 if not exists(select 1 from public.memberships where org_id=j.org_id and user_id=j.requested_by and role in ('owner','operator')) then
  perform public.relay_finish_failed_local_job(j.id,'authorization_changed');return 'failed';
 end if;
 if a.state<>'approved' or a.approved_by is null or not exists(select 1 from public.memberships where org_id=j.org_id and user_id=a.approved_by and role in ('owner','operator')) then
  perform public.relay_finish_failed_local_job(j.id,'approval_unavailable');return 'failed';
 end if;
 select ticket_status into current_status from public.cases where id=a.case_id for update;
 if current_status is distinct from a.from_status then perform public.relay_finish_failed_local_job(j.id,'ticket_changed');return 'failed'; end if;
 select knowledge_revision into revision from public.organizations where id=j.org_id for share;
 if revision is distinct from a.evidence_revision then perform public.relay_finish_failed_local_job(j.id,'knowledge_changed');return 'failed'; end if;
 if exists(select 1 from public.external_dispatches d where d.id=a.id or (d.case_id=a.case_id and d.state in ('queued','dispatching','needs_reconciliation'))) then
  perform public.relay_finish_failed_local_job(j.id,'external_pending');return 'failed';
 end if;
 begin
  update public.cases set ticket_status=a.to_status where id=a.case_id;
  update public.crm_actions set state='succeeded',executed_at=now() where id=a.id;
 exception when others then
  perform public.relay_finish_failed_local_job(j.id,'execution_blocked');return 'failed';
 end;
 update public.action_jobs set state='succeeded',finished_at=now() where id=j.id;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(j.org_id,j.case_id,j.requested_by,'sandbox_ticket_updated',j.action_id);
 return 'succeeded';
end $$;
