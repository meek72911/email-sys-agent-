import { describe,expect,it,vi } from 'vitest';
vi.mock('unpdf',()=>({getDocumentProxy:vi.fn(),extractText:vi.fn()}));
import { extractText,getDocumentProxy } from 'unpdf';
import { extractDocument } from './document-ingestion';
describe('PDF page coverage',()=>{
 it('rejects a partly image-only PDF instead of indexing an incomplete document',async()=>{
  vi.mocked(getDocumentProxy).mockResolvedValue({numPages:2} as never);
  vi.mocked(extractText).mockResolvedValue({totalPages:2,text:['Text present','   ']} as never);
  await expect(extractDocument(new File(['%PDF-test'],'policy.pdf'))).rejects.toThrow(/blank or image-only/);
 });
 it('preserves page locations for text-based PDF pages',async()=>{
  vi.mocked(getDocumentProxy).mockResolvedValue({numPages:2} as never);
  vi.mocked(extractText).mockResolvedValue({totalPages:2,text:['First page','Second page']} as never);
  expect(await extractDocument(new File(['%PDF-test'],'policy.pdf'))).toEqual([{section:'Page 1, part 1',content:'First page'},{section:'Page 2, part 1',content:'Second page'}]);
 });
});
