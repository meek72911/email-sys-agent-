-- Preserve failed attempts and assign each explicit retry a fresh idempotency key.
alter table public.action_jobs drop constraint action_jobs_action_id_key;
create unique index action_jobs_one_queued on public.action_jobs(action_id) where state='queued';
create or replace function public.relay_enqueue_action(p_action uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a public.crm_actions%rowtype; jid uuid;
begin
 select x.* into a from public.crm_actions x join public.memberships m on m.org_id=x.org_id where x.id=p_action and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Action unavailable'; end if;
 select id into jid from public.action_jobs where action_id=a.id and state in ('queued','succeeded') order by created_at desc,id desc limit 1;
 if jid is not null then return jid; end if;
 if exists(select 1 from public.action_jobs where action_id=a.id and state='failed') then raise exception 'Use explicit retry'; end if;
 if a.state<>'approved' or a.approved_by is null then raise exception 'Approval required'; end if;
 insert into public.action_jobs(org_id,action_id,case_id,requested_by) values(a.org_id,a.id,a.case_id,uid) returning id into jid;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(a.org_id,a.case_id,uid,'action_queued',a.id);
 return jid;
end $$;

-- Only failed local database actions can be retried. Never retry an external dispatch.
create function public.relay_retry_action_job(p_job uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); j public.action_jobs%rowtype; a public.crm_actions%rowtype; c public.cases%rowtype; revision bigint; next_id uuid;
begin
 select x.* into j from public.action_jobs x join public.memberships m on m.org_id=x.org_id where x.id=p_job and m.user_id=uid and m.role in ('owner','operator') for update of x for share of m;
 if not found then raise exception 'Job unavailable'; end if;
 if j.state<>'failed' then raise exception 'Job is not eligible for retry'; end if;
 select * into a from public.crm_actions where id=j.action_id for update;
 if not found or a.state<>'approved' or a.approved_by is null or not exists(select 1 from public.memberships where org_id=j.org_id and user_id=a.approved_by and role in ('owner','operator')) then raise exception 'Approval unavailable'; end if;
 select * into c from public.cases where id=j.case_id and org_id=j.org_id for update;
 if not found or (c.expires_at is not null and c.expires_at<=now()) or c.ticket_status is distinct from a.from_status then raise exception 'Request changed or unavailable'; end if;
 select knowledge_revision into revision from public.organizations where id=j.org_id for share;
 if revision is distinct from a.evidence_revision then raise exception 'Knowledge changed; create a new proposal'; end if;
 if exists(select 1 from public.external_dispatches d where d.id=a.id or (d.case_id=a.case_id and d.state in ('queued','dispatching','needs_reconciliation'))) then raise exception 'External dispatch requires reconciliation'; end if;
 if exists(select 1 from public.action_jobs where action_id=a.id and state='queued') then raise exception 'A retry is already queued'; end if;
 insert into public.action_jobs(org_id,action_id,case_id,requested_by) values(j.org_id,j.action_id,j.case_id,uid) returning id into next_id;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(j.org_id,j.case_id,uid,'action_retry_queued',j.action_id);
 return next_id;
end $$;
revoke all on function public.relay_retry_action_job(uuid) from public,anon;
grant execute on function public.relay_retry_action_job(uuid) to authenticated;
