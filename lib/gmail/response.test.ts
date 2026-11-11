import { describe,it,expect } from 'vitest';
import { parseSearchResults,parseSelectedMessage } from './response';
describe('Gmail connector responses',()=>{
 it('extracts message summaries from structured or JSON text results',()=>{
  const data={threads:[{id:'thread1',messages:[{id:'msg1',subject:'Hello',sender:'A',snippet:'Preview',htmlBody:'ignore'}]}]};
  expect(parseSearchResults({structuredContent:data})).toEqual([{id:'msg1',subject:'Hello',sender:'A',snippet:'Preview'}]);
  expect(parseSearchResults({content:[{type:'text',text:JSON.stringify(data)}]})).toHaveLength(1);
 });
 it('rejects errors, malformed content and mismatched messages',()=>{
  expect(()=>parseSearchResults({isError:true,structuredContent:{}})).toThrow();
  expect(()=>parseSearchResults({content:[{type:'text',text:'bad'}]})).toThrow();
  expect(()=>parseSelectedMessage({structuredContent:{id:'other',plaintextBody:'text'}},'msg1')).toThrow();
  expect(()=>parseSelectedMessage({structuredContent:{id:'msg1',htmlBody:'<b>only html</b>'}},'msg1')).toThrow();
  expect(()=>parseSelectedMessage({structuredContent:{id:'msg1',plaintextBody:'x'.repeat(10001)}},'msg1')).toThrow();
 });
 it('keeps untrusted markup as plain text and ignores HTML',()=>{
  expect(parseSelectedMessage({structuredContent:{id:'msg1',plaintextBody:'<script>bad()</script>',htmlBody:'ignored'}},'msg1').body).toBe('<script>bad()</script>');
 });
});
