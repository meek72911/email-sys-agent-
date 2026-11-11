-- Server-wide daily reservation cap in addition to each workspace's cap.
create table public.analysis_global_usage (
 usage_day date primary key,
 calls integer not null check (calls between 1 and 100)
);
alter table public.analysis_global_usage enable row level security;
revoke all on public.analysis_global_usage from public,anon,authenticated;
create or replace function public.relay_reserve_analysis(p_case uuid) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; used integer; global_used integer; today date:=(now() at time zone 'UTC')::date;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select c.org_id into oid from public.cases c join public.memberships m on m.org_id=c.org_id where c.id=p_case and m.user_id=uid and m.role in ('owner','operator');
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
revoke all on function public.relay_reserve_analysis(uuid) from public,anon;
grant execute on function public.relay_reserve_analysis(uuid) to authenticated;
