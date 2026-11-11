import { extractText, getDocumentProxy } from 'unpdf';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export type Section = { section: string; content: string };

/** Extract text only; original files are never served or executed. */
export async function extractDocument(file: File): Promise<Section[]> {
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw new Error('Use a file up to 2 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  let pages: string[];
  if (name.endsWith('.pdf')) {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('File does not have a PDF signature.');
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > 50) throw new Error('PDFs may contain at most 50 pages.');
    const extracted = await extractText(pdf);
    pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    if (pages.length!==pdf.numPages || pages.some(page=>!page.trim())) throw new Error('PDF contains a blank or image-only page. OCR is not supported.');
  } else if (name.endsWith('.txt')) {
    if (bytes.includes(0)) throw new Error('Text file contains unsupported binary data.');
    try { pages = [new TextDecoder('utf-8', { fatal: true }).decode(bytes)]; }
    catch { throw new Error('Text files must use UTF-8 encoding.'); }
  } else throw new Error('Only PDF and UTF-8 text files are supported.');
  const sections: Section[] = [];
  pages.forEach((raw, index) => {
    const page = raw.replace(/\u0000/g, '').trim();
    // Do not invent OCR text for image-only pages.
    for (let offset = 0; offset < page.length; offset += 4000) {
      sections.push({ section: pages.length > 1 ? `Page ${index + 1}, part ${Math.floor(offset / 4000) + 1}` : `Part ${Math.floor(offset / 4000) + 1}`, content: page.slice(offset, offset + 4000) });
    }
  });
  if (!sections.length) throw new Error('No text found. Scanned PDFs need OCR, which is not supported.');
  if (sections.length > 100 || sections.reduce((sum, section) => sum + section.content.length, 0) > 200000) throw new Error('Document contains too much text.');
  return sections;
}
