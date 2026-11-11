"use client";
import { useActionState } from 'react';
import { createManualCase,type IntakeState } from './actions';
export default function IntakeForm(){
 const [state,action,pending]=useActionState<IntakeState,FormData>(createManualCase,{});
 return <form action={action}><label htmlFor="customer">Customer name or identifier</label><input id="customer" name="customer" required maxLength={300}/><label htmlFor="subject">Subject</label><input id="subject" name="subject" required maxLength={300}/><label htmlFor="message">Customer message</label><textarea id="message" name="message" required rows={10} maxLength={10000}/><p>This request is stored in your workspace and visible to its members until an owner deletes the request or workspace. Running AI analysis is a separate action.</p>{state.error&&<p role="alert">{state.error}</p>}<button disabled={pending}>{pending?'Adding request…':'Add request'}</button></form>;
}
