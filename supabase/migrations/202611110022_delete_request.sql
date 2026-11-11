-- Keep a minimal workspace-level deletion record while removing case data.
create table public.workspace_audit_events (
 id bigint generated always as identity primary key,
 org_id uuid not null references public.organizations(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 event_type text not null check(event_type='request_deleted'),
 source_kind text not null check(source_kind in ('manual','gmail')),
 created_at timestamptz not null default now()
);
alter table public.workspace_audit_events enable row level security;
revoke all on public.workspace_audit_events from public,anon,authenticated;
grant select on public.workspace_audit_events to authenticated;
create policy workspace_audit_read on public.workspace_audit_events for select to authenticated using (exists(select 1 from public.memberships m where m.org_id=workspace_audit_events.org_id and m.user_id=(select auth.uid())));

create function public.relay_delete_request(p_case uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); c public.cases%rowtype;
begin
 select x.* into c from public.cases x join public.memberships m on m.org_id=x.org_id where x.id=p_case and m.user_id=uid and m.role='owner' for update of x for share of m;
 if not found then raise exception 'Request unavailable'; end if;
 if c.source_kind not in ('manual','gmail') then raise exception 'Only manual or imported requests can be deleted'; end if;
 if exists(select 1 from public.external_dispatches d where d.case_id=c.id and d.org_id=c.org_id) then raise exception 'External dispatch requires reconciliation'; end if;
 insert into public.workspace_audit_events(org_id,actor_id,event_type,source_kind) values(c.org_id,uid,'request_deleted',c.source_kind);
 delete from public.cases where id=c.id;
end $$;
revoke all on function public.relay_delete_request(uuid) from public,anon;
grant execute on function public.relay_delete_request(uuid) to authenticated;
