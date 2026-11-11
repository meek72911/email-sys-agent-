alter table public.knowledge_audit_events drop constraint knowledge_audit_events_event_type_check;
alter table public.knowledge_audit_events add constraint knowledge_audit_events_event_type_check check(event_type in ('knowledge_added','knowledge_replaced','knowledge_deleted'));
create function public.relay_delete_knowledge(p_document uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; current_version integer;
begin
 select org_id into oid from public.memberships where user_id=uid and role='owner' for share;
 if oid is null then raise exception 'Owner access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(oid::text,11));
 select max(version) into current_version from public.knowledge_documents where org_id=oid and document_id=p_document;
 if current_version is null then raise exception 'Document unavailable'; end if;
 delete from public.knowledge_documents where org_id=oid and document_id=p_document;
 insert into public.knowledge_audit_events(org_id,actor_id,document_id,version,event_type) values(oid,uid,p_document,current_version,'knowledge_deleted');
end $$;
revoke all on function public.relay_delete_knowledge(uuid) from public,anon;
grant execute on function public.relay_delete_knowledge(uuid) to authenticated;
