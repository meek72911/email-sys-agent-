import { describe,expect,it,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('next/navigation',()=>({redirect:()=>{throw Error('redirect');}}));
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
import { supabase } from '@/lib/supabase';
import Activity from './page';
const caseEvent={id:1,case_id:'case-1',actor_id:'u',event_type:'action_rejected',created_at:'2026-11-10T00:00:00Z'};
const knowledgeEvent={id:1,document_id:'doc-1',actor_id:'u',event_type:'knowledge_replaced',version:2,created_at:'2026-11-11T00:00:00Z'};
describe('workspace activity',()=>{
 it('combines case and knowledge history in time order with links',async()=>{
  vi.mocked(supabase).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})},from:(table:string)=>({select:()=>({order:()=>({limit:async()=>({data:table==='audit_events'?[caseEvent]:[knowledgeEvent],error:null})})})})} as never);
  const html=renderToStaticMarkup(await Activity());expect(html).toContain('Knowledge document replaced');expect(html).toContain('Version 2');expect(html).toContain('/knowledge#knowledge-doc-1');expect(html).toContain('Action rejected');expect(html.indexOf('Knowledge document replaced')).toBeLessThan(html.indexOf('Action rejected'));
 });
 it('reports partial activity failures without hiding available entries',async()=>{
  vi.mocked(supabase).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})},from:(table:string)=>({select:()=>({order:()=>({limit:async()=>table==='audit_events'?{data:[caseEvent],error:null}:{data:null,error:{}}})})})} as never);
  const html=renderToStaticMarkup(await Activity());expect(html).toContain('Some activity is unavailable');expect(html).toContain('Action rejected');
 });
});
