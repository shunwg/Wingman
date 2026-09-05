import { describe, expect, it } from 'vitest';
import { asPersonId } from '@domain/index';
import { NO_FILTERS } from '../store';
import { applyBoardFilters, industriesOn, type BoardCandidate } from './board';

const cand = (id: string, industry?: string, extra: Partial<BoardCandidate> = {}): BoardCandidate =>
  ({
    person: {
      id: asPersonId(id),
      professional: industry ? { industry } : { __redacted: true, reason: 'not_yet_accepted' },
      circles: [],
    },
    viaTripId: 't1',
    ...extra,
  }) as unknown as BoardCandidate;

const genderOf = () => undefined;

describe('applyBoardFilters', () => {
  const list = [cand('a', 'Energy'), cand('b', 'Software'), cand('c', 'Energy'), cand('d')];

  it('layout never changes membership', () => {
    expect(applyBoardFilters(list, { ...NO_FILTERS, layout: 'row' }, genderOf)).toHaveLength(4);
  });

  it('industry narrows, and a withheld industry never matches a filter', () => {
    const out = applyBoardFilters(list, { ...NO_FILTERS, industry: 'Energy' }, genderOf);
    expect(out.map((c) => String(c.person.id))).toEqual(['a', 'c']);
  });

  it('saved shows only saved people', () => {
    const out = applyBoardFilters(list, { ...NO_FILTERS, savedOnly: true }, genderOf, ['b', 'd']);
    expect(out.map((c) => String(c.person.id))).toEqual(['b', 'd']);
  });
});

describe('industriesOn', () => {
  it('counts what the ladder released, most common first, capped', () => {
    const list = [cand('a', 'Energy'), cand('b', 'Software'), cand('c', 'Energy'), cand('d'), cand('e', 'Law')];
    expect(industriesOn(list, 2)).toEqual([
      { name: 'Energy', n: 2 },
      { name: 'Law', n: 1 },
    ]);
  });
});
