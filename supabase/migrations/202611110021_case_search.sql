-- Workspace search uses invoker RLS and literal substring matching, never dynamic SQL.
create function public.relay_search_cases(p_query text,p_offset integer) returns table(id uuid,customer text,subject text,created_at timestamptz,ticket_status text,source_kind text)
language sql stable security invoker set search_path='' as $$
 select c.id,c.customer,c.subject,c.created_at,c.ticket_status,c.source_kind
 from public.cases c
 where p_query is not null and length(p_query)<=200 and p_offset between 0 and 10000
 and (trim(p_query)='' or position(lower(trim(p_query)) in lower(c.customer))>0 or position(lower(trim(p_query)) in lower(c.subject))>0 or position(lower(trim(p_query)) in lower(c.message))>0)
 order by c.created_at desc,c.id desc limit 51 offset greatest(p_offset,0)
$$;
revoke all on function public.relay_search_cases(text,integer) from public,anon;
grant execute on function public.relay_search_cases(text,integer) to authenticated;
