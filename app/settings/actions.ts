"use server";
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
export async function deleteWorkspace(form:FormData){
 const org=z.uuid().safeParse(form.get('orgId'));
 if(!org.success||form.get('confirmation')!=='DELETE')redirect('/settings?error=confirmation');
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)redirect('/login');
 const {error}=await client.rpc('relay_delete_workspace',{p_org:org.data});
 if(error)redirect('/settings?error=deletion');
 revalidatePath('/workspace');redirect('/workspace?deleted=1');
}
