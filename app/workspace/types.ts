export type CaseRecord = {
  id: string;
  customer: string;
  subject: string;
  message: string;
  created_at: string;
  ticket_status: string;
  draft: string;
  draft_review_state: string;
  draft_review_revision: number | null;
  organizations: { knowledge_revision: number } | { knowledge_revision: number }[] | null;
  source_kind: string;
  expires_at: string | null;
};

export type ActionRow = {
  id: string;
  from_status: string;
  to_status: string;
  state: string;
  created_at: string;
};

export type ExternalRow = {
  id: string;
  state: string;
  sync_state: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  action_id: string;
  state: string;
  created_at: string;
  finished_at: string | null;
  failure_code: string | null;
};

export type EventRow = {
  id: number;
  event_type: string;
  created_at: string;
};

export type EvidenceRow = {
  id: string;
  title: string;
  section: string;
  content: string;
  version: number;
};
