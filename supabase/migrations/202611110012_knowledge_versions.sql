-- Each document has a stable group ID; replacing it invalidates all older evidence.
alter table public.knowledge_documents add column document_id uuid not null default gen_random_uuid();
create index knowledge_document_group_idx on public.knowledge_documents(org_id,document_id);

create function public.relay_insert_knowledge_sections(p_org uuid,p_document uuid,p_version integer,p_title text,p_sections jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare entry jsonb; count_added integer:=0; total_chars integer:=0;
begin
 if p_title is null or length(trim(p_title)) not between 1 and 160 or jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 100 then raise exception 'Invalid document'; end if;
 if (select count(*) from public.knowledge_documents where org_id=p_org)+jsonb_array_length(p_sections)>500 then raise exception 'Workspace knowledge limit reached'; end if;
 for entry in select value from jsonb_array_elements(p_sections) loop
  if jsonb_typeof(entry)<>'object' or length(coalesce(entry->>'section','')) not between 1 and 80 or length(coalesce(entry->>'content','')) not between 1 and 5000 then raise exception 'Invalid section'; end if;
  total_chars:=total_chars+length(entry->>'content');
  if total_chars>200000 then raise exception 'Document text limit exceeded'; end if;
  insert into public.knowledge_documents(org_id,document_id,version,title,section,content) values(p_org,p_document,p_version,trim(p_title),entry->>'section',entry->>'content');
  count_added:=count_added+1;
 end loop;
 return count_added;
end $$;
revoke all on function public.relay_insert_knowledge_sections(uuid,uuid,integer,text,jsonb) from public,anon,authenticated;

create or replace function public.relay_add_knowledge(p_title text,p_sections jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid;
begin
 select org_id into oid from public.memberships where user_id=uid and role='owner' for share;
 if oid is null then raise exception 'Owner access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(oid::text,11));
 return public.relay_insert_knowledge_sections(oid,gen_random_uuid(),1,p_title,p_sections);
end $$;

create function public.relay_replace_knowledge(p_document uuid,p_title text,p_sections jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; next_version integer;
begin
 select org_id into oid from public.memberships where user_id=uid and role='owner' for share;
 if oid is null then raise exception 'Owner access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(oid::text,11));
 select max(version)+1 into next_version from public.knowledge_documents where org_id=oid and document_id=p_document;
 if next_version is null then raise exception 'Document unavailable'; end if;
 delete from public.knowledge_documents where org_id=oid and document_id=p_document;
 return public.relay_insert_knowledge_sections(oid,p_document,next_version,p_title,p_sections);
end $$;
revoke all on function public.relay_replace_knowledge(uuid,text,jsonb) from public,anon;
grant execute on function public.relay_replace_knowledge(uuid,text,jsonb) to authenticated;

-- Preserve RLS while returning stable document IDs with matching sections.
drop function public.relay_search_knowledge(text);
create function public.relay_search_knowledge(p_query text) returns table(id uuid,document_id uuid,title text,section text,content text,version integer)
language sql stable security invoker set search_path='' as $$
 select k.id,k.document_id,k.title,k.section,k.content,k.version from public.knowledge_documents k
 where length(trim(coalesce(p_query,''))) between 1 and 200 and k.search_vector @@ websearch_to_tsquery('english',p_query)
 order by ts_rank(k.search_vector,websearch_to_tsquery('english',p_query)) desc limit 10
$$;
revoke all on function public.relay_search_knowledge(text) from public,anon;
grant execute on function public.relay_search_knowledge(text) to authenticated;
