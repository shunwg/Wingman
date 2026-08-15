import { describe, expect, it } from 'vitest';
import { airportIndex, airportCount, cityByKey, haversineM } from './index';
import { asCityKey, asIata } from '@domain/ids';

/**
 * The dataset's shape is asserted at build time by scripts/verify-dataset.ts.
 * These tests cover the runtime lookup surface instead — the behaviour the
 * matching engine and the trip form actually depend on.
 */

describe('airport index', () => {
  it('loads the large-airport set eagerly', () => {
    expect(airportCount()).toBeGreaterThan(1000);
  });

  it('resolves a known airport with its derived timezone', () => {
    const osl = airportIndex.get(asIata('OSL'));
    expect(osl).toBeDefined();
    expect(osl!.city).toBe('Oslo');
    expect(osl!.countryCode).toBe('NO');
    // The zone is derived from coordinates at build time — the whole layover
    // model rests on this being right.
    expect(osl!.zone).toBe('Europe/Oslo');
  });

  it('derives plausible zones across hemispheres and the date line', () => {
    expect(airportIndex.zone(asIata('SIN'))).toBe('Asia/Singapore');
    expect(airportIndex.zone(asIata('GRU'))).toBe('America/Sao_Paulo');
    expect(airportIndex.zone(asIata('AKL'))).toBe('Pacific/Auckland');
    expect(airportIndex.zone(asIata('LAX'))).toBe('America/Los_Angeles');
  });

  it('groups multi-airport metros onto one city', () => {
    // "We are both in London on Thursday" has to be true across all five.
    const london = airportIndex.city(asIata('LHR'));
    expect(london?.key).toBe('london-gb');
    expect(london?.airports).toEqual(expect.arrayContaining(['LHR', 'LGW', 'LCY', 'STN']));

    // Heathrow and Gatwick must resolve to the same city object.
    expect(airportIndex.city(asIata('LGW'))?.key).toBe(airportIndex.city(asIata('LHR'))?.key);
  });

  it('groups Paris despite the qualifiers in the source municipality', () => {
    // CDG is filed as "Paris (Roissy-en-France, Val-d'Oise)" upstream.
    expect(airportIndex.city(asIata('CDG'))?.key).toBe('paris-fr');
    expect(airportIndex.city(asIata('ORY'))?.key).toBe('paris-fr');
  });

  it('treats Newark as New York, because a traveller does', () => {
    expect(airportIndex.city(asIata('EWR'))?.key).toBe('new-york-us');
  });

  describe('search', () => {
    it('puts an exact IATA match first', () => {
      expect(airportIndex.search('OSL')[0]?.iata).toBe('OSL');
      expect(airportIndex.search('sin')[0]?.iata).toBe('SIN');
    });

    it('ranks a city-name prefix above an incidental substring', () => {
      const hits = airportIndex.search('london', 5);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]!.city).toBe('London');
    });

    it('ignores accents and case', () => {
      const hits = airportIndex.search('zurich');
      expect(hits.map((h) => h.iata)).toContain('ZRH');
    });

    it('refuses to guess from a single character', () => {
      expect(airportIndex.search('o')).toEqual([]);
    });

    it('respects the limit', () => {
      expect(airportIndex.search('a', 3).length).toBeLessThanOrEqual(3);
      expect(airportIndex.search('san', 3).length).toBeLessThanOrEqual(3);
    });
  });

  it('finds the nearest airports to a coordinate', () => {
    // Central Oslo.
    const near = airportIndex.nearest(59.9127, 10.7461, 3);
    expect(near.map((a) => a.iata)).toContain('OSL');
  });

  it('resolves cities by key', () => {
    expect(cityByKey(asCityKey('oslo-no'))?.name).toBe('Oslo');
  });
});

describe('haversine', () => {
  it('measures a known city pair', () => {
    // Oslo → Copenhagen is about 480 km.
    const d = haversineM(59.9139, 10.7522, 55.6761, 12.5683);
    expect(d).toBeGreaterThan(450_000);
    expect(d).toBeLessThan(510_000);
  });

  it('is zero for a point against itself', () => {
    expect(haversineM(59.9, 10.7, 59.9, 10.7)).toBe(0);
  });

  it('is symmetric', () => {
    expect(haversineM(1, 2, 3, 4)).toBe(haversineM(3, 4, 1, 2));
  });
});
