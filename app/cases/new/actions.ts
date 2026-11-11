"use server";
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
const input=z.object({customer:z.string().trim().min(1).max(300),subject:z.string().trim().min(1).max(300),message:z.string().trim().min(1).max(10000)});
export type IntakeState={error?:string};
export async function createManualCase(_state:IntakeState,form:FormData):Promise<IntakeState>{
 const parsed=input.safeParse({customer:form.get('customer'),subject:form.get('subject'),message:form.get('message')});
 if(!parsed.success)return {error:'Enter a customer, subject and message within the displayed limits.'};
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)redirect('/login');
 const {data,error}=await client.rpc('relay_create_manual_case',{p_customer:parsed.data.customer,p_subject:parsed.data.subject,p_message:parsed.data.message});
 if(error||!z.uuid().safeParse(data).success)return {error:'Could not add the request. Check your role, workspace limit and database setup.'};
 revalidatePath('/workspace');redirect('/workspace?case='+encodeURIComponent(data));
}
