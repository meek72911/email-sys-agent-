import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { gmailImportEnabled } from '@/lib/gmail/import-config';
import Mailbox from './mailbox';
export default async function GmailPage(){
 const client=await supabase();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const {data:member,error:memberError}=await client.from('memberships').select('role').eq('user_id',user.id).maybeSingle();
 return <main className="content-page"><p><Link href="/connections">← Connections</Link></p><h1>Gmail import</h1>{!memberError&&member?.role==='owner'&&gmailImportEnabled()?<Mailbox/>:<p>Gmail import is unavailable until an owner completes connection, access review and retention setup.</p>}</main>;
}
