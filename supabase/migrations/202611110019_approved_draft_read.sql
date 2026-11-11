-- Check role, current case visibility, exact approved text and evidence revision
-- within one database statement. Invoker rights preserve table RLS.
create function public.relay_get_approved_draft(p_case uuid,p_expected text) returns text
language sql stable security invoker set search_path='' as $$
 select c.draft from public.cases c
 join public.organizations o on o.id=c.org_id
 join public.memberships m on m.org_id=c.org_id and m.user_id=(select auth.uid())
 where c.id=p_case and m.role in ('owner','operator')
   and p_expected is not null and length(trim(p_expected)) between 1 and 5000
   and c.draft=p_expected and c.draft_review_state='approved'
   and c.draft_review_revision=o.knowledge_revision
 limit 1
$$;
revoke all on function public.relay_get_approved_draft(uuid,text) from public,anon;
grant execute on function public.relay_get_approved_draft(uuid,text) to authenticated;
