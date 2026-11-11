import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { canOperate } from '@/lib/roles';
import IntakeForm from './intake-form';
export default async function NewCase(){
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)redirect('/login');
 const {data:member,error}=await client.from('memberships').select('role').eq('user_id',user.id).maybeSingle();
 return <main className="content-page"><p><Link href="/workspace">← Inbox</Link></p><h1>Add a request</h1>{!error&&canOperate(member?.role)?<IntakeForm/>:<p>Only workspace owners and operators can add requests. Create a workspace first if you do not have one.</p>}</main>;
}
