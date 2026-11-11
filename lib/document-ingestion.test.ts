import { describe, expect, it } from 'vitest';
import { extractDocument, MAX_UPLOAD_BYTES } from './document-ingestion';
describe('document ingestion', () => {
  it('extracts text with a source location', async () => {
    const result = await extractDocument(new File(['Billing policy: check agreement first.'], 'policy.txt', {type:'text/plain'}));
    expect(result).toEqual([{ section:'Part 1', content:'Billing policy: check agreement first.' }]);
  });
  it('rejects binary content, mismatched PDF signatures and oversized uploads', async () => {
    await expect(extractDocument(new File([new Uint8Array([65,0,66])], 'bad.txt'))).rejects.toThrow(/binary/);
    await expect(extractDocument(new File(['not a pdf'], 'bad.pdf'))).rejects.toThrow(/signature/);
    await expect(extractDocument(new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'large.txt'))).rejects.toThrow(/2 MB/);
  });
  it('rejects unsupported and empty files instead of fabricating text', async () => {
    await expect(extractDocument(new File(['x'], 'policy.html'))).rejects.toThrow(/Only PDF/);
    await expect(extractDocument(new File(['  '], 'empty.txt'))).rejects.toThrow(/No text/);
  });
});
