-- Reviewers can reject a proposal before approval. Row locking serializes rejection
-- with approval and prevents a rejected action from being approved or executed.
alter table public.crm_actions drop constraint crm_actions_state_check;
alter table public.crm_actions add constraint crm_actions_state_check check (state in ('needs_approval','approved','rejected','succeeded','failed'));
create function public.relay_reject_status(p_action uuid,p_from text,p_to text) returns void language plpgsql security definer set search_path='' as $$
declare a public.crm_actions%rowtype; uid uuid:=auth.uid();
begin
 select x.* into a from public.crm_actions x join public.memberships m on m.org_id=x.org_id
 where x.id=p_action and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Action unavailable'; end if;
 if a.state<>'needs_approval' or a.from_status is distinct from p_from or a.to_status is distinct from p_to then raise exception 'Action changed or not awaiting review'; end if;
 update public.crm_actions set state='rejected' where id=a.id;
 insert into public.audit_events(org_id,case_id,actor_id,event_type,action_id) values(a.org_id,a.case_id,uid,'action_rejected',a.id);
end $$;
revoke all on function public.relay_reject_status(uuid,text,text) from public,anon;
grant execute on function public.relay_reject_status(uuid,text,text) to authenticated;
