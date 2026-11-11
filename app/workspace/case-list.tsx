"use client";
import { useEffect,useMemo,useRef,useState } from 'react';
type CaseItem={id:string;customer:string;subject:string;message:string;ticket_status:string};
export default function CaseList({cases,selectedId,canWrite}:{cases:CaseItem[];selectedId?:string;canWrite:boolean}){
 const [query,setQuery]=useState('');const searchRef=useRef<HTMLInputElement>(null);const listRef=useRef<HTMLDivElement>(null);
 const filtered=useMemo(()=>{const value=query.trim().toLocaleLowerCase();return value?cases.filter(c=>`${c.customer} ${c.subject} ${c.message}`.toLocaleLowerCase().includes(value)):cases;},[cases,query]);
 useEffect(()=>{
  function onKey(event:KeyboardEvent){
   const target=event.target;if(target instanceof HTMLElement && (target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName)))return;
   if(event.key==='/'&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();searchRef.current?.focus();return;}
   if(!['j','k'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;
   const links=Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-case]')??[]);if(!links.length)return;
   const current=links.indexOf(document.activeElement as HTMLAnchorElement);const next=current<0?Math.max(0,links.findIndex(link=>link.dataset.case===selectedId)):Math.min(links.length-1,Math.max(0,current+(event.key==='j'?1:-1)));
   event.preventDefault();links[next]?.focus();
  }
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 },[selectedId,filtered]);
 function guardUnsaved(event:React.MouseEvent<HTMLAnchorElement>){
  const field=document.getElementById('draft');if(field instanceof HTMLTextAreaElement&&field.value!==field.defaultValue&&!window.confirm('Discard unsaved changes to this draft?'))event.preventDefault();
 }
 return <div className="inbox-list"><div className="inbox-title"><div><h1>Inbox</h1><p>Workspace requests</p></div><span className="count">{filtered.length}</span></div>{canWrite&&<p><a href="/cases/new" onClick={guardUnsaved}>Add request</a></p>}<label className="search-label" htmlFor="case-search">Search requests <span aria-hidden="true">/</span></label><input ref={searchRef} id="case-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name, subject or message" autoComplete="off"/><div className="case-list" ref={listRef} aria-label="Customer requests">{filtered.length?filtered.map(item=><a key={item.id} href={'/workspace?case='+encodeURIComponent(item.id)} data-case={item.id} onClick={guardUnsaved} aria-current={item.id===selectedId?'page':undefined} className={'case'+(item.id===selectedId?' selected':'')}><span className="case-heading"><strong>{item.customer}</strong><span className="status-chip">{item.ticket_status}</span></span><span className="case-subject">{item.subject}</span><span className="case-preview">{item.message}</span></a>):<p className="empty-state">No matching requests.</p>}</div><p className="keyboard-hint">Press / to search. Use j and k to focus a request, then Enter to open it.</p></div>;
}
