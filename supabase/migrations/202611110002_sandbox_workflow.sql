-- Synthetic CRM review workflow. Run after 202611110001_initial.sql.
-- Changes to tickets and actions are only exposed through the functions below.
alter table public.cases add column ticket_status text not null default 'open' check (ticket_status in ('open','pending','resolved'));
alter table public.cases add column draft text not null default '';
create table public.crm_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  case_id uuid not null,
  from_status text not null,
  to_status text not null check (to_status in ('open','pending','resolved')),
  state text not null default 'needs_approval' check (state in ('needs_approval','approved','succeeded','failed')),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  executed_at timestamptz,
  foreign key (org_id,case_id) references public.cases(org_id,id) on delete cascade
);
create table public.audit_events (
 id bigint generated always as identity primary key,
 org_id uuid not null references public.organizations(id) on delete cascade,
 case_id uuid not null,
 actor_id uuid not null references auth.users(id),
 event_type text not null,
 action_id uuid references public.crm_actions(id) on delete set null,
 created_at timestamptz not null default now(),
 foreign key (org_id,case_id) references public.cases(org_id,id) on delete cascade
);
alter table public.crm_actions enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.crm_actions,public.audit_events from anon,authenticated;
grant select on public.crm_actions,public.audit_events to authenticated;
create policy actions_read on public.crm_actions for select to authenticated using (exists(select 1 from public.memberships m where m.org_id=crm_actions.org_id and m.user_id=(select auth.uid())));
create policy audit_read on public.audit_events for select to authenticated using (exists(select 1 from public.memberships m where m.org_id=audit_events.org_id and m.user_id=(select auth.uid())));

create function public.relay_save_draft(p_case uuid,p_draft text) returns void language plpgsql security definer set search_path='' as $$
declare c public.cases%rowtype; uid uuid:=auth.uid();
begin
 if uid is null or p_draft is null or length(p_draft)>5000 then raise exception 'Invalid draft'; end if;
 select x.* into c from public.cases x join public.memberships m on m.org_id=x.org_id where x.id=p_case and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Case unavailable'; end if;
 update public.cases set draft=p_draft where id=c.id;
 insert into public.audit_events(org_id,case_id,actor_id,event_type) values(c.org_id,c.id,uid,'draft_saved');
end $$;
create function public.relay_propose_status(p_case uuid,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.cases%rowtype; aid uuid; uid uuid:=auth.uid();
begin
 if uid is null or p_status is null or p_status not in ('open','pending','resolved') then raise exception 'Invalid status'; end if;
 select x.* into c from public.cases x join public.memberships m on m.org_id=x.org_id where x.id=p_case and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Case unavailable'; end if;
 if c.ticket_status=p_status then raise exception 'Status unchanged'; end if;
 insert into public.crm_actions(org_id,case_id,from_status,to_status,created_by) values(c.org_id,c.id,c.ticket_status,p_status,uid) returning id into aid;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(c.org_id,c.id,uid,'action_proposed',aid);
 return aid;
end $$;
create function public.relay_approve_status(p_action uuid,p_from text,p_to text) returns void language plpgsql security definer set search_path='' as $$
declare a public.crm_actions%rowtype; uid uuid:=auth.uid(); current_status text;
begin
 select x.* into a from public.crm_actions x join public.memberships m on m.org_id=x.org_id where x.id=p_action and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Action unavailable'; end if;
 if a.state <> 'needs_approval' or a.from_status is distinct from p_from or a.to_status is distinct from p_to then raise exception 'Action changed or not awaiting approval'; end if;
 select ticket_status into current_status from public.cases where id=a.case_id for update;
 if current_status is distinct from a.from_status then raise exception 'Ticket changed; create a new proposal'; end if;
 update public.crm_actions set state='approved',approved_by=uid,approved_at=now() where id=a.id;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(a.org_id,a.case_id,uid,'action_approved',a.id);
end $$;
create function public.relay_execute_status(p_action uuid) returns text language plpgsql security definer set search_path='' as $$
declare a public.crm_actions%rowtype; uid uuid:=auth.uid(); current_status text;
begin
 select x.* into a from public.crm_actions x join public.memberships m on m.org_id=x.org_id where x.id=p_action and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Action unavailable'; end if;
 if a.state='succeeded' then return 'succeeded'; end if;
 if a.state <> 'approved' or a.approved_by is null then raise exception 'Approval required'; end if;
 select ticket_status into current_status from public.cases where id=a.case_id for update;
 if current_status is distinct from a.from_status then raise exception 'Ticket changed; create a new proposal'; end if;
 update public.cases set ticket_status=a.to_status where id=a.case_id;
 update public.crm_actions set state='succeeded',executed_at=now() where id=a.id;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(a.org_id,a.case_id,uid,'sandbox_ticket_updated',a.id);
 return 'succeeded';
end $$;
revoke all on function public.relay_save_draft(uuid,text),public.relay_propose_status(uuid,text),public.relay_approve_status(uuid,text,text),public.relay_execute_status(uuid) from public,anon;
grant execute on function public.relay_save_draft(uuid,text),public.relay_propose_status(uuid,text),public.relay_approve_status(uuid,text,text),public.relay_execute_status(uuid) to authenticated;
