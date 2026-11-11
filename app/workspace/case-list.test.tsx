// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CaseList from './case-list';
const cases=[{id:'one',customer:'Ada',subject:'Invoice question',message:'Please review my invoice.',ticket_status:'open'},{id:'two',customer:'Ravi',subject:'Cannot sign in',message:'I cannot log in.',ticket_status:'pending'}];
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('case list',()=>{
 it('filters by message and reports empty results',()=>{
  render(<CaseList cases={cases} selectedId="one"/>);const search=screen.getByRole('searchbox',{name:/Search requests/i});
  fireEvent.change(search,{target:{value:'log in'}});expect(screen.getByRole('link',{name:/Ravi/})).toBeTruthy();expect(screen.queryByRole('link',{name:/Ada/})).toBeNull();
  fireEvent.change(search,{target:{value:'nothing matches'}});expect(screen.getByText('No matching requests.')).toBeTruthy();
 });
 it('supports slash search and j/k focus without hijacking typing',()=>{
  render(<CaseList cases={cases} selectedId="one"/>);fireEvent.keyDown(window,{key:'/'});expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  (document.activeElement as HTMLElement).blur();fireEvent.keyDown(window,{key:'j'});expect(document.activeElement).toBe(screen.getByRole('link',{name:/Ada/}));
  fireEvent.keyDown(window,{key:'j'});expect(document.activeElement).toBe(screen.getByRole('link',{name:/Ravi/}));
  fireEvent.keyDown(window,{key:'k'});expect(document.activeElement).toBe(screen.getByRole('link',{name:/Ada/}));
 });
 it('asks before discarding an edited draft when changing cases',()=>{
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);const draft=document.createElement('textarea');draft.id='draft';draft.defaultValue='original';draft.value='edited';document.body.appendChild(draft);
  render(<CaseList cases={cases} selectedId="one"/>);const event=new MouseEvent('click',{bubbles:true,cancelable:true});screen.getByRole('link',{name:/Ravi/}).dispatchEvent(event);
  expect(confirm).toHaveBeenCalledOnce();expect(event.defaultPrevented).toBe(true);draft.remove();
 });
});
