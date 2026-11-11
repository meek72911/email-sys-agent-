-- Owner-only workspace deletion. Authentication account remains intact.
-- External CRM records require coordinated cleanup; fail closed until supported.
create function public.relay_delete_workspace(p_org uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); role_name text;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select role into role_name from public.memberships where org_id=p_org and user_id=uid for update;
 if role_name is distinct from 'owner' then raise exception 'Owner access required'; end if;
 perform 1 from public.organizations where id=p_org for update;
 if not found then raise exception 'Workspace unavailable'; end if;
 if exists(select 1 from public.external_dispatches where org_id=p_org) then raise exception 'External sandbox records require cleanup first'; end if;
 delete from public.organizations where id=p_org;
end $$;
revoke all on function public.relay_delete_workspace(uuid) from public,anon;
grant execute on function public.relay_delete_workspace(uuid) to authenticated;
