-- Workspace-level audit records for knowledge changes; document contents are not logged.
create table public.knowledge_audit_events (
 id bigint generated always as identity primary key,
 org_id uuid not null references public.organizations(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 document_id uuid not null,
 version integer not null check(version>0),
 event_type text not null check(event_type in ('knowledge_added','knowledge_replaced')),
 created_at timestamptz not null default now()
);
alter table public.knowledge_audit_events enable row level security;
revoke all on public.knowledge_audit_events from public,anon,authenticated;
grant select on public.knowledge_audit_events to authenticated;
create policy knowledge_audit_read on public.knowledge_audit_events for select to authenticated using (exists(select 1 from public.memberships m where m.org_id=knowledge_audit_events.org_id and m.user_id=(select auth.uid())));

create or replace function public.relay_add_knowledge(p_title text,p_sections jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; doc uuid:=gen_random_uuid(); added integer;
begin
 select org_id into oid from public.memberships where user_id=uid and role='owner' for share;
 if oid is null then raise exception 'Owner access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(oid::text,11));
 added:=public.relay_insert_knowledge_sections(oid,doc,1,p_title,p_sections);
 insert into public.knowledge_audit_events(org_id,actor_id,document_id,version,event_type) values(oid,uid,doc,1,'knowledge_added');
 return added;
end $$;
create or replace function public.relay_replace_knowledge(p_document uuid,p_title text,p_sections jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; next_version integer; added integer;
begin
 select org_id into oid from public.memberships where user_id=uid and role='owner' for share;
 if oid is null then raise exception 'Owner access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(oid::text,11));
 select max(version)+1 into next_version from public.knowledge_documents where org_id=oid and document_id=p_document;
 if next_version is null then raise exception 'Document unavailable'; end if;
 delete from public.knowledge_documents where org_id=oid and document_id=p_document;
 added:=public.relay_insert_knowledge_sections(oid,p_document,next_version,p_title,p_sections);
 insert into public.knowledge_audit_events(org_id,actor_id,document_id,version,event_type) values(oid,uid,p_document,next_version,'knowledge_replaced');
 return added;
end $$;
