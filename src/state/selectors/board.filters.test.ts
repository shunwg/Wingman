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

describe('the lens', () => {
  const withOverlap = (id: string, kind: string, conference = false) =>
    cand(id, 'Energy', {
      overlap: { kind } as never,
      person: {
        id: asPersonId(id),
        professional: { industry: 'Energy' },
        circles: conference ? [{ circleId: 'gridweek', kind: 'conference', shortName: 'GW', crestSeed: 'x' }] : [],
      } as never,
    });
  const list = [
    withOverlap('f', 'same_flight'),
    withOverlap('l', 'shared_layover'),
    withOverlap('w', 'same_airport_window', true),
    withOverlap('c', 'same_city_night', true),
  ];
  it('same flight, same airport, same event narrow by why-now; for you keeps all', () => {
    const ids = (lens: 'all' | 'same_flight' | 'same_airport' | 'same_event') =>
      applyBoardFilters(list, { ...NO_FILTERS, lens }, genderOf).map((c) => String(c.person.id));
    expect(ids('all')).toEqual(['f', 'l', 'w', 'c']);
    expect(ids('same_flight')).toEqual(['f']);
    expect(ids('same_airport')).toEqual(['l', 'w']);
    expect(ids('same_event')).toEqual(['w', 'c']);
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
