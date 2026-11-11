import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHmac,randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { mkdtemp,rm,rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

// Isolated test double: no customer data, no Supabase connection, no model calls.
const user={id:'00000000-0000-4000-8000-000000000001',email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
const caseId='00000000-0000-4000-8000-000000000002',orgId='00000000-0000-4000-8000-000000000003';
const sample={id:caseId,customer:'Synthetic customer',subject:'Invoice and login',message:'Our invoice is ₹18,500 and login fails.',created_at:'2026-01-01T00:00:00Z',ticket_status:'open',draft:'',draft_review_state:'unreviewed',draft_review_revision:null,organizations:{knowledge_revision:1},source_kind:'synthetic',expires_at:null};
const second={id:'00000000-0000-4000-8000-000000000004',customer:'Another customer',subject:'Export question',message:'The export is unavailable.',created_at:'2025-12-01T00:00:00Z',ticket_status:'open',draft:'A different saved draft.',draft_review_state:'unreviewed',draft_review_revision:null,organizations:{knowledge_revision:1},source_kind:'synthetic',expires_at:null};
let actions=[],events=[];const now=Math.floor(Date.now()/1000);const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const unsigned=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:user.id,email:user.email,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600});const jwt=unsigned+'.'+createHmac('sha256','synthetic-test-only-secret').update(unsigned).digest('base64url');
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let s='';for await(const chunk of req){s+=chunk;if(s.length>20000)throw Error('oversized');}return JSON.parse(s||'{}');}
const backend=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');const path=url.pathname;
 if(path==='/auth/v1/token'&&req.method==='POST'){const data=await body(req);return data.email===user.email&&data.password==='synthetic-test-only'?json(res,200,{access_token:jwt,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,expires_at:now+3600,user}):json(res,400,{error:'invalid credentials'});}
 if(path==='/auth/v1/user'&&req.method==='GET')return req.headers.authorization===`Bearer ${jwt}`?json(res,200,user):json(res,401,{message:'unauthorized'});
 if(path==='/auth/v1/logout')return json(res,200,{});
 if(!String(req.headers.authorization??'').includes(jwt))return json(res,401,{message:'unauthorized'});
 if(req.method==='GET'&&path.startsWith('/rest/v1/')){
  const table=path.slice('/rest/v1/'.length);let rows;
  if(table==='cases')rows=[sample,second];else if(table==='memberships')rows=[{org_id:orgId,user_id:user.id,role:'owner'}];else if(table==='crm_actions')rows=actions;else if(table==='audit_events')rows=events;else if(table==='action_jobs'||table==='external_dispatches')rows=[];else return json(res,404,{message:'unknown table'});
  const id=url.searchParams.get('id');if(id?.startsWith('eq.'))rows=rows.filter(row=>row.id===id.slice(3));const caseFilter=url.searchParams.get('case_id');if(caseFilter?.startsWith('eq.'))rows=rows.filter(row=>row.case_id===caseFilter.slice(3));
  return json(res,200,rows);
 }
 if(req.method==='POST'&&path.startsWith('/rest/v1/rpc/')){
  const name=path.split('/').at(-1),input=await body(req);let result=null;
  if(name==='relay_save_draft'){if(sample.draft!==input.p_draft){sample.draft_review_state='unreviewed';sample.draft_review_revision=null;}sample.draft=input.p_draft;events.unshift({id:events.length+1,case_id:caseId,actor_id:user.id,event_type:'draft_saved',created_at:new Date().toISOString()});}
  else if(name==='relay_get_approved_draft'){result=input.p_case===caseId&&input.p_expected===sample.draft&&sample.draft_review_state==='approved'&&sample.draft_review_revision===sample.organizations.knowledge_revision?sample.draft:null;}
  else if(name==='relay_review_draft'){if(input.p_draft!==sample.draft||!['approved','rejected'].includes(input.p_decision))return json(res,400,{message:'draft changed'});sample.draft_review_state=input.p_decision;sample.draft_review_revision=1;events.unshift({id:events.length+1,case_id:caseId,actor_id:user.id,event_type:'draft_'+input.p_decision,created_at:new Date().toISOString()});}
  else if(name==='relay_propose_status'){if(input.p_status===sample.ticket_status)return json(res,400,{message:'unchanged'});const action={id:randomUUID(),case_id:caseId,from_status:sample.ticket_status,to_status:input.p_status,state:'needs_approval',created_at:new Date().toISOString()};actions.unshift(action);result=action.id;}
  else if(name==='relay_reject_status'){const action=actions.find(x=>x.id===input.p_action);if(!action||action.state!=='needs_approval'||action.from_status!==input.p_from||action.to_status!==input.p_to)return json(res,400,{message:'invalid review'});action.state='rejected';events.unshift({id:events.length+1,case_id:caseId,actor_id:user.id,event_type:'action_rejected',created_at:new Date().toISOString()});}
  else if(name==='relay_approve_status'){const action=actions.find(x=>x.id===input.p_action);if(!action||action.state!=='needs_approval'||action.from_status!==input.p_from||action.to_status!==input.p_to)return json(res,400,{message:'invalid approval'});action.state='approved';}
  else if(name==='relay_execute_status'){const action=actions.find(x=>x.id===input.p_action);if(!action||!['approved','succeeded'].includes(action.state))return json(res,400,{message:'approval required'});if(action.state==='approved'){sample.ticket_status=action.to_status;action.state='succeeded';events.unshift({id:events.length+1,case_id:caseId,actor_id:user.id,event_type:'sandbox_ticket_updated',created_at:new Date().toISOString()});}result='succeeded';}
  else return json(res,404,{message:'unknown function'});
  return json(res,200,result);
 }
 return json(res,404,{message:'unknown route'});
}catch{return json(res,500,{message:'test backend error'});}});
let child,browser,tempDir;let output='';
try{
 backend.listen(0,'127.0.0.1');await once(backend,'listening');const backendUrl=`http://127.0.0.1:${backend.address().port}`;
 const probe=http.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const appPort=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 tempDir=await mkdtemp(join(tmpdir(),'relay-e2e-'));
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p',String(appPort),'-H','127.0.0.1'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:backendUrl,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-key',OPENAI_API_KEY:'',RELAY_ENABLE_DURABLE_JOBS:'false'},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
 const base=`http://127.0.0.1:${appPort}`;let ready=false;
 for(let i=0;i<120;i++){if(child.exitCode!==null)break;try{const r=await fetch(base+'/login');if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 if(!ready)throw Error('App did not start: '+output.slice(-3000));
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto(base+'/workspace');await page.waitForURL('**/login');
 await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill('synthetic-test-only');await page.getByRole('button',{name:'Sign in'}).click();
 await page.waitForURL('**/workspace');await page.getByRole('heading',{name:'Invoice and login'}).waitFor();await page.getByText('Synthetic request',{exact:false}).waitFor();
 await page.getByLabel('Search requests').fill('login');assert.equal(await page.getByRole('link',{name:/Synthetic customer/}).count(),1);
 await page.getByLabel('Search requests').fill('no match');await page.getByText('No matching requests.').waitFor();await page.getByLabel('Search requests').fill('');
 await page.locator('#draft').fill('We will verify the details.');await page.getByRole('button',{name:'Save draft'}).click();await page.waitForURL('**/workspace?case=*');await page.waitForTimeout(100);
 assert.equal(await page.locator('#draft').inputValue(),'We will verify the details.');
 await page.getByRole('button',{name:'Approve saved draft'}).click();await page.getByText('Review: approved',{exact:false}).waitFor();
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'Copy approved draft'}).click();await page.getByText('Draft copied.',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'We will verify the details.');
 await page.getByRole('button',{name:'Reject saved draft'}).click();await page.getByText('Review: rejected',{exact:false}).waitFor();
 await page.getByRole('link',{name:/Another customer/}).click();await page.getByRole('heading',{name:'Export question'}).waitFor();assert.equal(await page.locator('#draft').inputValue(),'A different saved draft.');
 await page.getByRole('link',{name:/Synthetic customer/}).click();await page.getByRole('heading',{name:'Invoice and login'}).waitFor();assert.equal(await page.locator('#draft').inputValue(),'We will verify the details.');
 await page.locator('#draft').fill('Unsaved edit');page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('link',{name:/Another customer/}).click();assert.equal(await page.getByRole('heading',{name:'Invoice and login'}).count(),1);await page.locator('#draft').fill('We will verify the details.');
 await page.getByRole('button',{name:'Review change'}).click();await page.getByRole('button',{name:'Approve exact change'}).waitFor();assert.equal(sample.ticket_status,'open');
 await page.getByRole('button',{name:'Reject change'}).click();await page.getByText('action rejected',{exact:false}).waitFor();assert.equal(sample.ticket_status,'open');
 await page.getByRole('button',{name:'Review change'}).click();await page.getByRole('button',{name:'Approve exact change'}).waitFor();
 await page.getByRole('button',{name:'Approve exact change'}).click();await page.getByRole('button',{name:'Execute sandbox change now'}).waitFor();assert.equal(sample.ticket_status,'open');
 await page.getByRole('button',{name:'Execute sandbox change now'}).click();await page.getByText('sandbox ticket updated',{exact:false}).waitFor();assert.equal(sample.ticket_status,'pending');assert.equal(await page.locator('#status').inputValue(),'open');
 await page.screenshot({path:join(tempDir,'workspace-desktop.png'),fullPage:true});await page.setViewportSize({width:375,height:812});await page.screenshot({path:join(tempDir,'workspace-mobile.png'),fullPage:true});
 const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].map(el=>({tag:el.tagName,cls:el.className,right:Math.round(el.getBoundingClientRect().right)})).filter(el=>el.right>innerWidth+1).slice(0,12)}));if(overflow.scroll>overflow.width)console.log('Overflow:',JSON.stringify(overflow));assert.equal(overflow.scroll>overflow.width,false);
 console.log('Passed mock browser workflow: sign-in, search, draft, rejection, proposal, approval, execution, audit and mobile overflow.');
 console.log(`Temporary screenshots: ${tempDir}`);
 // Screenshots contain only synthetic data. Set RELAY_KEEP_TEST_SCREENSHOTS=1 to retain them.
} finally {
 if(browser)await browser.close();if(child){child.kill();await Promise.race([once(child,'exit').catch(()=>{}),new Promise(resolve=>setTimeout(resolve,3000))]);}await new Promise(resolve=>backend.close(resolve));if(tempDir&&process.env.RELAY_KEEP_TEST_SCREENSHOTS!=='1'){await Promise.all(['workspace-desktop.png','workspace-mobile.png'].map(file=>rm(join(tempDir,file),{force:true})));await rmdir(tempDir);}
}
