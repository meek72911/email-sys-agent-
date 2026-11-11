-- Manual intake provides a real workspace entry point before mailbox integration.
alter table public.cases drop constraint cases_source_kind_check;
alter table public.cases add constraint cases_source_kind_check check(source_kind in ('synthetic','gmail','manual'));
alter table public.cases drop constraint gmail_case_expiry;
alter table public.cases add constraint gmail_case_expiry check ((source_kind='gmail' and expires_at is not null) or (source_kind in ('synthetic','manual') and expires_at is null));
create function public.relay_create_manual_case(p_customer text,p_subject text,p_message text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; cid uuid;
begin
 if uid is null or p_customer is null or length(trim(p_customer)) not between 1 and 300 or p_subject is null or length(trim(p_subject)) not between 1 and 300 or p_message is null or length(trim(p_message)) not between 1 and 10000 then raise exception 'Invalid request'; end if;
 select org_id into oid from public.memberships where user_id=uid and role in ('owner','operator') for share;
 if oid is null then raise exception 'Workspace access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(oid::text,20));
 if (select count(*) from public.cases where org_id=oid and source_kind='manual')>=200 then raise exception 'Manual request limit reached'; end if;
 insert into public.cases(org_id,customer,subject,message,source_kind) values(oid,trim(p_customer),trim(p_subject),trim(p_message),'manual') returning id into cid;
 insert into public.audit_events(org_id,case_id,actor_id,event_type) values(oid,cid,uid,'manual_case_created');
 return cid;
end $$;
revoke all on function public.relay_create_manual_case(text,text,text) from public,anon;
grant execute on function public.relay_create_manual_case(text,text,text) to authenticated;
