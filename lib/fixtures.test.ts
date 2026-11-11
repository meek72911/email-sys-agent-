import { describe, expect, it } from 'vitest';
import data from '../fixtures/cases.v1.json';
describe('synthetic evaluation set', () => {
 it('contains 50 unique, categorized fixtures with the required distribution', () => {
  expect(data.fixtures).toHaveLength(50);
  expect(new Set(data.fixtures.map(item=>item.id)).size).toBe(50);
  expect(Object.fromEntries(['single','multi','missing','ambiguous','injection','unsupported'].map(group=>[group,data.fixtures.filter(item=>item.group===group).length]))).toEqual({single:12,multi:12,missing:8,ambiguous:6,injection:6,unsupported:6});
 });
 it('uses claims that actually appear in the source and marks them unverified', () => {
  for(const item of data.fixtures) for(const claim of item.expectedClaims){ expect(item.message).toContain(claim.source); expect(claim.status).toBe('unverified'); }
 });
});
