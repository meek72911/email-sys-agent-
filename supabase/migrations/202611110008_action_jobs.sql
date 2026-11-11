-- Durable sandbox queue: jobs contain IDs and an authorized actor, never credentials.
create table public.action_jobs (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(id) on delete cascade,
 action_id uuid not null unique references public.crm_actions(id) on delete cascade,
 case_id uuid not null,
 requested_by uuid not null references auth.users(id),
 state text not null default 'queued' check (state in ('queued','succeeded','failed')),
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 foreign key (org_id,case_id) references public.cases(org_id,id) on delete cascade
);
alter table public.action_jobs enable row level security;
revoke all on public.action_jobs from public,anon,authenticated;
grant select on public.action_jobs to authenticated;
create policy jobs_read on public.action_jobs for select to authenticated using (exists(select 1 from public.memberships m where m.org_id=action_jobs.org_id and m.user_id=(select auth.uid())));

create function public.relay_enqueue_action(p_action uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a public.crm_actions%rowtype; jid uuid;
begin
 select x.* into a from public.crm_actions x join public.memberships m on m.org_id=x.org_id where x.id=p_action and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Action unavailable'; end if;
 select id into jid from public.action_jobs where action_id=a.id;
 if jid is not null then return jid; end if;
 if a.state<>'approved' or a.approved_by is null then raise exception 'Approval required'; end if;
 insert into public.action_jobs(org_id,action_id,case_id,requested_by) values(a.org_id,a.id,a.case_id,uid) returning id into jid;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(a.org_id,a.case_id,uid,'action_queued',a.id);
 return jid;
end $$;
revoke all on function public.relay_enqueue_action(uuid) from public,anon;
grant execute on function public.relay_enqueue_action(uuid) to authenticated;

-- Called only by trusted server workers. Every write and the job result commit atomically.
create function public.relay_run_action_job(p_job uuid) returns text language plpgsql security definer set search_path='' as $$
declare j public.action_jobs%rowtype; a public.crm_actions%rowtype; current_status text; authorized boolean;
begin
 select * into j from public.action_jobs where id=p_job for update;
 if not found then raise exception 'Job unavailable'; end if;
 if j.state in ('succeeded','failed') then return j.state; end if;
 select * into a from public.crm_actions where id=j.action_id for update;
 select exists(select 1 from public.memberships where org_id=j.org_id and user_id=j.requested_by and role in ('owner','operator')) into authorized;
 -- A separately completed action is an idempotent success only for this exact action ID.
 if a.state='succeeded' then
  update public.action_jobs set state='succeeded',finished_at=now() where id=j.id;
  return 'succeeded';
 end if;
 if not authorized or a.state<>'approved' or a.approved_by is null or not exists(select 1 from public.memberships where org_id=j.org_id and user_id=a.approved_by and role in ('owner','operator')) then
  update public.action_jobs set state='failed',finished_at=now() where id=j.id;
  insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(j.org_id,j.case_id,j.requested_by,'action_job_failed',j.action_id);
  return 'failed';
 end if;
 select ticket_status into current_status from public.cases where id=a.case_id for update;
 if current_status is distinct from a.from_status then
  update public.action_jobs set state='failed',finished_at=now() where id=j.id;
  insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(j.org_id,j.case_id,j.requested_by,'action_job_failed',j.action_id);
  return 'failed';
 end if;
 -- The evidence trigger can reject a stale action; its exception rolls back the write block.
 begin
  update public.cases set ticket_status=a.to_status where id=a.case_id;
  update public.crm_actions set state='succeeded',executed_at=now() where id=a.id;
 exception when others then
  update public.action_jobs set state='failed',finished_at=now() where id=j.id;
  insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(j.org_id,j.case_id,j.requested_by,'action_job_failed',j.action_id);
  return 'failed';
 end;
 update public.action_jobs set state='succeeded',finished_at=now() where id=j.id;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(j.org_id,j.case_id,j.requested_by,'sandbox_ticket_updated',j.action_id);
 return 'succeeded';
end $$;
revoke all on function public.relay_run_action_job(uuid) from public,anon,authenticated;
grant execute on function public.relay_run_action_job(uuid) to service_role;
