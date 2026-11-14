export function jobFailureMessage(code:string|null|undefined):string{
 const messages:Record<string,string>={
  authorization_changed:'The person who queued this action no longer has permission. An operator can retry after access is restored.',
  approval_unavailable:'The approval or approver is no longer eligible. Review access and create a new proposal if needed.',
  ticket_changed:'The ticket changed. Create and review a new proposal.',
  knowledge_changed:'The knowledge changed. Create and review a new proposal.',
  external_pending:'A separate sandbox action needs review or reconciliation before a local retry.',
  execution_blocked:'The database blocked the action. Review the ticket and action before retrying.',
 };
 return messages[code??'']??'The action failed. Review the ticket, approval and current evidence.';
}
export function mayRetryJob(code:string|null|undefined):boolean{return !['ticket_changed','knowledge_changed','external_pending'].includes(code??'');}
