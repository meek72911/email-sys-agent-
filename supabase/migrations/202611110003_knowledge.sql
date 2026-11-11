-- Organization-scoped knowledge. Entries are synthetic; they are not customer records.
create table public.knowledge_documents (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(id) on delete cascade,
 title text not null,
 section text not null,
 content text not null,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 search_vector tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(section,'') || ' ' || coalesce(content,''))) stored
);
create index knowledge_documents_search_idx on public.knowledge_documents using gin(search_vector);
create index knowledge_documents_org_idx on public.knowledge_documents(org_id);
alter table public.knowledge_documents enable row level security;
revoke all on public.knowledge_documents from anon,authenticated;
grant select on public.knowledge_documents to authenticated;
create policy knowledge_read on public.knowledge_documents for select to authenticated using (exists(select 1 from public.memberships m where m.org_id=knowledge_documents.org_id and m.user_id=(select auth.uid())));
create function public.relay_seed_knowledge(p_org uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.knowledge_documents(org_id,title,section,content) values
 (p_org,'Billing adjustments','Verification','Compare the invoice with the signed agreement before correcting a price. Do not promise a refund or credit until the discrepancy is verified.'),
 (p_org,'Account access','Login troubleshooting','Confirm the account email and ask the user to reset their password. Escalate persistent login failures to the support team.'),
 (p_org,'Product support','General requests','Gather the affected feature, steps to reproduce, and expected result before escalating a product issue.');
end $$;
revoke all on function public.relay_seed_knowledge(uuid) from public,anon,authenticated;
create function public.relay_seed_knowledge_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.relay_seed_knowledge(new.id); return new; end $$;
revoke all on function public.relay_seed_knowledge_trigger() from public,anon,authenticated;
create trigger seed_knowledge_after_org after insert on public.organizations for each row execute function public.relay_seed_knowledge_trigger();
do $$ declare o record; begin for o in select id from public.organizations loop perform public.relay_seed_knowledge(o.id); end loop; end $$;
-- Invoker rights retain RLS. A blank query returns no results.
create function public.relay_search_knowledge(p_query text) returns table(id uuid,title text,section text,content text,version integer)
language sql stable security invoker set search_path='' as $$
 select k.id,k.title,k.section,k.content,k.version from public.knowledge_documents k
 where length(trim(coalesce(p_query,''))) between 1 and 200
 and k.search_vector @@ websearch_to_tsquery('english',p_query)
 order by ts_rank(k.search_vector,websearch_to_tsquery('english',p_query)) desc limit 10
$$;
revoke all on function public.relay_search_knowledge(text) from public,anon;
grant execute on function public.relay_search_knowledge(text) to authenticated;
