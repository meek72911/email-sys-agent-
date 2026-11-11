import { z } from 'zod';
export const groundedDraftSchema=z.strictObject({
 sentences:z.array(z.strictObject({text:z.string().min(1).max(600),sourceIds:z.array(z.uuid()).min(1).max(3)})).min(1).max(8),
});
export type GroundedDraft=z.infer<typeof groundedDraftSchema>;
export function validateDraft(value:unknown,allowedIds:string[]):GroundedDraft {
 const result=groundedDraftSchema.parse(value); const allowed=new Set(allowedIds);
 for(const sentence of result.sentences) for(const id of sentence.sourceIds) if(!allowed.has(id)) throw new Error('Draft cites an unavailable source');
 return result;
}
