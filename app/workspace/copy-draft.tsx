"use client";
import { useState } from 'react';
import { getApprovedDraft } from './actions';
export default function CopyDraft({caseId,savedDraft}:{caseId:string;savedDraft:string}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function copy(){
  const field=document.getElementById('draft');
  if(!(field instanceof HTMLTextAreaElement)||field.value!==savedDraft){setMessage('Save and review your edits before copying.');return;}
  setBusy(true);setMessage('');
  try{const result=await getApprovedDraft(caseId,savedDraft);if(!result.ok){setMessage('Draft or knowledge changed. Refresh and review again.');return;}if(field.value!==savedDraft){setMessage('Save and review your edits before copying.');return;}if(!navigator.clipboard?.writeText){setMessage('Clipboard unavailable. Select and copy the draft manually.');return;}await navigator.clipboard.writeText(result.draft);setMessage('Draft copied. Paste it into your email and review before sending.');}
  catch{setMessage('Could not copy. Check clipboard permission and try again.');}finally{setBusy(false);}
 }
 return <div><button type="button" className="secondary" onClick={copy} disabled={busy}>{busy?'Checking draft…':'Copy approved draft'}</button>{message&&<p role="status">{message}</p>}</div>;
}
