import { z } from 'zod';

// Extraction represents what the customer said, not verified business records.
export const extractionSchema = z.strictObject({
  issues: z.array(z.strictObject({
    category: z.enum(['billing', 'access', 'product', 'other']),
    summary: z.string().min(1).max(300),
    sourceQuote: z.string().min(1).max(1000),
  })).max(12),
  claims: z.array(z.strictObject({
    kind: z.enum(['amount', 'date', 'other']),
    value: z.string().min(1).max(300),
    sourceQuote: z.string().min(1).max(1000),
  })).max(30),
});
export type Extraction = z.infer<typeof extractionSchema>;

function amountHasCompleteOccurrence(message:string,quote:string,value:string):boolean {
  let quoteAt=message.indexOf(quote);
  while(quoteAt!==-1){
    let valueAt=quote.indexOf(value);
    while(valueAt!==-1){
      const start=quoteAt+valueAt,end=start+value.length;
      const before=message[start-1]??'',beforeBefore=message[start-2]??'';
      const after=message[end]??'',afterAfter=message[end+1]??'';
      const cutStart=/[0-9,]/.test(before)||(before==='.'&&/[0-9]/.test(beforeBefore));
      const cutEnd=/[0-9,]/.test(after)||(after==='.'&&/[0-9]/.test(afterAfter));
      if(!cutStart&&!cutEnd)return true;
      valueAt=quote.indexOf(value,valueAt+1);
    }
    quoteAt=message.indexOf(quote,quoteAt+1);
  }
  return false;
}
export function validateExtraction(input: unknown, originalMessage: string): Extraction {
  const result = extractionSchema.parse(input);
  for (const entry of [...result.issues, ...result.claims]) {
    if (!originalMessage.includes(entry.sourceQuote)) {
      throw new Error('Extraction contains a source quote not present in the original message');
    }
  }
  for (const claim of result.claims) {
    if (!claim.sourceQuote.includes(claim.value)) throw new Error('Claim value is not present in its source quote');
    if (claim.kind==='amount' && !/[0-9]/.test(claim.value)) throw new Error('Amount must contain a digit');
    if (claim.kind==='amount' && !amountHasCompleteOccurrence(originalMessage,claim.sourceQuote,claim.value)) throw new Error('Amount is only part of a larger number');
  }
  return result;
}
