"use client";
import { useActionState } from 'react';
import Link from 'next/link';
import { searchGmail,importGmail,type SearchState,type ImportState } from './actions';
import type { MailSummary } from '@/lib/gmail/response';
function ImportButton({item}:{item:MailSummary}){
 const [state,action,pending]=useActionState<ImportState,FormData>(importGmail,{});
 return <div><h3>{item.subject}</h3><p>{item.sender}</p><p>{item.snippet}</p><form action={action}><input type="hidden" name="messageId" value={item.id}/><button disabled={pending}>Import this message</button></form>{state.error&&<p role="alert">{state.error}</p>}{state.caseId&&<p role="status">Imported. <Link href={'/workspace?case='+encodeURIComponent(state.caseId)}>Open case</Link></p>}</div>;
}
export default function Mailbox(){
 const [state,action,pending]=useActionState<SearchState,FormData>(searchGmail,{});
 return <><p>Gmail read-only permission covers the whole mailbox. Search runs only when you submit it. Results show up to 50 messages from the first 20 matching threads; some messages in a matching thread may not match every search term. Check the sender and subject before importing. Import copies the selected message into the workspace for members to view; explicit analysis may send its text to OpenAI. Attachments and HTML are not imported.</p><p>Imported messages become eligible for cleanup after 30 days. Deletion depends on the configured retention worker.</p><form action={action}><label htmlFor="query">Gmail search</label><input id="query" name="query" maxLength={200} required/><button disabled={pending}>Search Gmail</button></form>{state.error&&<p role="alert">{state.error}</p>}{state.results&&(state.results.length?state.results.map(item=><ImportButton key={item.id} item={item}/>):<p>No messages returned.</p>)}</>;
}
