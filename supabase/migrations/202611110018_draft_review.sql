-- Human review applies only to the exact saved text and current knowledge revision.
alter table public.cases add column draft_review_state text not null default 'unreviewed' check(draft_review_state in ('unreviewed','approved','rejected'));
alter table public.cases add column draft_reviewed_by uuid references auth.users(id);
alter table public.cases add column draft_reviewed_at timestamptz;
alter table public.cases add column draft_review_revision bigint;
alter table public.cases add constraint draft_review_fields check ((draft_review_state='unreviewed' and draft_reviewed_by is null and draft_reviewed_at is null and draft_review_revision is null) or (draft_review_state in ('approved','rejected') and draft_reviewed_by is not null and draft_reviewed_at is not null and draft_review_revision is not null));
create or replace function public.relay_save_draft(p_case uuid,p_draft text) returns void language plpgsql security definer set search_path='' as $$
declare c public.cases%rowtype; uid uuid:=auth.uid();
begin
 if uid is null or p_draft is null or length(p_draft)>5000 then raise exception 'Invalid draft'; end if;
 select x.* into c from public.cases x join public.memberships m on m.org_id=x.org_id where x.id=p_case and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Case unavailable'; end if;
 if c.draft is distinct from p_draft then
  update public.cases set draft=p_draft,draft_review_state='unreviewed',draft_reviewed_by=null,draft_reviewed_at=null,draft_review_revision=null where id=c.id;
  insert into public.audit_events(org_id,case_id,actor_id,event_type) values(c.org_id,c.id,uid,'draft_saved');
 end if;
end $$;
create function public.relay_review_draft(p_case uuid,p_draft text,p_decision text) returns void language plpgsql security definer set search_path='' as $$
declare c public.cases%rowtype; uid uuid:=auth.uid(); revision bigint;
begin
 if uid is null or p_decision is null or p_decision not in ('approved','rejected') or p_draft is null or length(trim(p_draft))=0 or length(p_draft)>5000 then raise exception 'Invalid review'; end if;
 select x.* into c from public.cases x join public.memberships m on m.org_id=x.org_id where x.id=p_case and m.user_id=uid and m.role in ('owner','operator') for update of x;
 if not found then raise exception 'Case unavailable'; end if;
 if c.draft is distinct from p_draft then raise exception 'Draft changed; save and review current text'; end if;
 select knowledge_revision into revision from public.organizations where id=c.org_id for share;
 if not found then raise exception 'Workspace unavailable'; end if;
 update public.cases set draft_review_state=p_decision,draft_reviewed_by=uid,draft_reviewed_at=now(),draft_review_revision=revision where id=c.id;
 insert into public.audit_events(org_id,case_id,actor_id,event_type) values(c.org_id,c.id,uid,'draft_'||p_decision);
end $$;
revoke all on function public.relay_review_draft(uuid,text,text) from public,anon;
grant execute on function public.relay_review_draft(uuid,text,text) to authenticated;
