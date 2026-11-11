-- Knowledge ingestion and a workspace-wide evidence revision.
-- This intentionally invalidates older pending approvals when knowledge changes.
alter table public.organizations add column knowledge_revision bigint not null default 0;
alter table public.crm_actions add column evidence_revision bigint;
update public.crm_actions a set evidence_revision = o.knowledge_revision from public.organizations o where o.id=a.org_id;
alter table public.crm_actions alter column evidence_revision set not null;

create function public.relay_knowledge_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin
 oid := case when TG_OP = 'DELETE' then old.org_id else new.org_id end;
 update public.organizations set knowledge_revision=knowledge_revision+1 where id=oid;
 return case when TG_OP = 'DELETE' then old else new end;
end $$;
revoke all on function public.relay_knowledge_changed() from public, anon, authenticated;
create trigger relay_knowledge_revision after insert or update or delete on public.knowledge_documents for each row execute function public.relay_knowledge_changed();

create function public.relay_action_evidence_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare revision bigint;
begin
 select knowledge_revision into revision from public.organizations where id=new.org_id for share;
 if not found then raise exception 'Workspace unavailable'; end if;
 if TG_OP='INSERT' then new.evidence_revision := revision;
 elsif new.state in ('approved','succeeded') and new.evidence_revision <> revision then
   raise exception 'Knowledge changed; create a new proposal';
 end if;
 return new;
end $$;
revoke all on function public.relay_action_evidence_guard() from public, anon, authenticated;
create trigger relay_action_evidence_guard before insert or update on public.crm_actions for each row execute function public.relay_action_evidence_guard();

-- Only an owner can add documents. Chunks and source locations are validated server-side.
create function public.relay_add_knowledge(p_title text,p_sections jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; entry jsonb; count_added integer:=0; total_chars integer:=0;
begin
 if uid is null or p_title is null or length(trim(p_title)) not between 1 and 160 or jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 100 then raise exception 'Invalid document'; end if;
 select m.org_id into oid from public.memberships m where m.user_id=uid and m.role='owner';
 if oid is null then raise exception 'Owner access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(oid::text, 11));
 if (select count(*) from public.knowledge_documents where org_id=oid)+jsonb_array_length(p_sections)>500 then raise exception 'Workspace knowledge limit reached'; end if;
 for entry in select value from jsonb_array_elements(p_sections) loop
   if jsonb_typeof(entry) <> 'object' or length(coalesce(entry->>'section','')) not between 1 and 80 or length(coalesce(entry->>'content','')) not between 1 and 5000 then raise exception 'Invalid section'; end if;
   total_chars := total_chars + length(entry->>'content');
   if total_chars > 200000 then raise exception 'Document text limit exceeded'; end if;
   insert into public.knowledge_documents(org_id,title,section,content) values(oid,trim(p_title),entry->>'section',entry->>'content');
   count_added := count_added+1;
 end loop;
 return count_added;
end $$;
revoke all on function public.relay_add_knowledge(text,jsonb) from public,anon;
grant execute on function public.relay_add_knowledge(text,jsonb) to authenticated;
