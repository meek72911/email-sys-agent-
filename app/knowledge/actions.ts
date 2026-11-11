"use server";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { extractDocument } from '@/lib/document-ingestion';
async function saveKnowledge(form:FormData,replace:boolean){
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)redirect('/login');
 const file=form.get('file');const doc=replace?z.uuid().safeParse(form.get('documentId')):null;let errorMessage='';
 if(!(file instanceof File))errorMessage='Choose a PDF or text file.';
 else if(replace&&!doc?.success)errorMessage='Invalid document.';
 else {
  try {
   const sections=await extractDocument(file);
   const result=replace&&doc?.success?await client.rpc('relay_replace_knowledge',{p_document:doc.data,p_title:file.name.slice(0,160),p_sections:sections}):await client.rpc('relay_add_knowledge',{p_title:file.name.slice(0,160),p_sections:sections});
   if(result.error)errorMessage='Could not save document. Confirm owner access, workspace limits and database migrations.';
  }catch(error){errorMessage=error instanceof Error?error.message:'Document could not be read.';}
 }
 revalidatePath('/knowledge');revalidatePath('/workspace');
 redirect(errorMessage?'/knowledge?error='+encodeURIComponent(errorMessage):'/knowledge?'+(replace?'replaced=1':'uploaded=1'));
}
export async function uploadKnowledge(form:FormData){return saveKnowledge(form,false);}
export async function replaceKnowledge(form:FormData){return saveKnowledge(form,true);}

export async function deleteKnowledge(form:FormData){
 const doc=z.uuid().safeParse(form.get('documentId'));if(!doc.success||form.get('confirmation')!=='DELETE')redirect('/knowledge?error='+encodeURIComponent('Type DELETE to confirm document removal.'));
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)redirect('/login');
 const {error}=await client.rpc('relay_delete_knowledge',{p_document:doc.data});
 if(error)redirect('/knowledge?error='+encodeURIComponent('Could not delete document. Check owner access and database setup.'));
 revalidatePath('/knowledge');revalidatePath('/workspace');revalidatePath('/activity');redirect('/knowledge?deleted=1');
}
