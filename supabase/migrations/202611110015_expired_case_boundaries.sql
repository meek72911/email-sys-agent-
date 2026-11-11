-- Case-related metadata follows the same expiry visibility as its case.
drop policy actions_read on public.crm_actions;
create policy actions_read on public.crm_actions for select to authenticated using (exists(select 1 from public.cases c where c.id=crm_actions.case_id and c.org_id=crm_actions.org_id));
drop policy audit_read on public.audit_events;
create policy audit_read on public.audit_events for select to authenticated using (exists(select 1 from public.cases c where c.id=audit_events.case_id and c.org_id=audit_events.org_id));
drop policy jobs_read on public.action_jobs;
create policy jobs_read on public.action_jobs for select to authenticated using (exists(select 1 from public.cases c where c.id=action_jobs.case_id and c.org_id=action_jobs.org_id));
drop policy external_dispatch_read on public.external_dispatches;
create policy external_dispatch_read on public.external_dispatches for select to authenticated using (exists(select 1 from public.cases c where c.id=external_dispatches.case_id and c.org_id=external_dispatches.org_id));

-- Guard queues independently of the UI and of security-definer callers.
create trigger relay_guard_expired_job before insert or update on public.action_jobs for each row execute function public.relay_guard_expired_action();

-- Expired Gmail content must never consume quota or begin a paid analysis.
create or replace function public.relay_reserve_analysis(p_case uuid) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; used integer; global_used integer; today date:=(now() at time zone 'UTC')::date;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select c.org_id into oid from public.cases c join public.memberships m on m.org_id=c.org_id where c.id=p_case and m.user_id=uid and m.role in ('owner','operator') and (c.expires_at is null or c.expires_at>now());
 if oid is null then raise exception 'Case unavailable'; end if;
 insert into public.analysis_usage(org_id,usage_day,calls) values(oid,today,1)
 on conflict (org_id,usage_day) do update set calls=public.analysis_usage.calls+1 where public.analysis_usage.calls<10 returning calls into used;
 if used is null then raise exception 'Daily analysis limit reached'; end if;
 insert into public.analysis_global_usage(usage_day,calls) values(today,1)
 on conflict (usage_day) do update set calls=public.analysis_global_usage.calls+1 where public.analysis_global_usage.calls<100 returning calls into global_used;
 if global_used is null then raise exception 'Global daily analysis limit reached'; end if;
 insert into public.audit_events(org_id,case_id,actor_id,event_type) values(oid,p_case,uid,'analysis_requested');
 return 10-used;
end $$;
