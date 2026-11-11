import { z } from 'zod';
const id=z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/);
const summary=z.object({id,subject:z.string().max(300).optional(),sender:z.string().max(300).optional(),snippet:z.string().max(3000).optional()});
const search=z.object({threads:z.array(z.object({id,messages:z.array(summary).max(100).optional()})).max(20).optional()});
const message=z.object({id,subject:z.string().max(300).optional(),sender:z.string().max(300).optional(),plaintextBody:z.string().max(10000).optional()});
function unwrap(value:unknown):unknown{
 const result=z.object({isError:z.boolean().optional(),structuredContent:z.unknown().optional(),content:z.array(z.object({type:z.string(),text:z.string().optional()})).max(10).optional()}).parse(value);
 if(result.isError)throw Error('Gmail tool failed');
 if(result.structuredContent!==undefined)return result.structuredContent;
 const text=result.content?.filter(block=>block.type==='text'&&typeof block.text==='string');
 if(!text||text.length!==1||!text[0].text)throw Error('Unsupported Gmail response');
 try{return JSON.parse(text[0].text);}catch{throw Error('Unsupported Gmail response');}
}
export type MailSummary={id:string;subject:string;sender:string;snippet:string};
export function parseSearchResults(value:unknown):MailSummary[]{
 const data=search.parse(unwrap(value));const messages=(data.threads??[]).flatMap(thread=>thread.messages??[]).slice(0,50);
 return messages.map(item=>({id:item.id,subject:item.subject?.trim()||'(No subject)',sender:item.sender?.trim()||'(Unknown sender)',snippet:item.snippet??''}));
}
export function parseSelectedMessage(value:unknown,expectedId:string){
 const data=message.parse(unwrap(value));if(data.id!==expectedId)throw Error('Gmail returned a different message');
 const body=(data.plaintextBody??'').replace(/\u0000/g,'').trim();if(!body)throw Error('Selected message has no plain text');
 return {id:data.id,subject:data.subject?.trim()||'(No subject)',sender:data.sender?.trim()||'(Unknown sender)',body};
}
