import { describe, expect, it } from 'vitest';
import { MATCH_CONFIG_V1 } from '../config';
import { classifyOverlap, strongest } from '../travel/overlap';
import { layoversFor, usableMinutes } from '../travel/layover';
import { NOW, openPerson, segment, stay, stubAirports, trip } from '../__fixtures__/world';

const cfg = MATCH_CONFIG_V1;
const kinds = (o: ReturnType<typeof classifyOverlap>) => o.map((x) => x.kind);

const ada = openPerson('ada');
const bo = openPerson('bo');

describe('same flight', () => {
  it('is found when both are on the same long leg', () => {
    const a = trip(ada, [segment('SQ317', 'LHR', 'SIN', '2026-09-02T11:00:00Z', '2026-09-02T23:45:00Z')]);
    const b = trip(bo, [segment('SQ317', 'LHR', 'SIN', '2026-09-02T11:00:00Z', '2026-09-02T23:45:00Z')]);

    const out = classifyOverlap(a, b, stubAirports, cfg);
    expect(kinds(out)).toContain('same_flight');
    expect(strongest(out)?.kind).toBe('same_flight');
  });

  it('is ignored on a short hop — 50 minutes is not a social occasion', () => {
    const a = trip(ada, [segment('SK451', 'OSL', 'CPH', '2026-09-02T09:00:00Z', '2026-09-02T09:50:00Z')]);
    const b = trip(bo, [segment('SK451', 'OSL', 'CPH', '2026-09-02T09:00:00Z', '2026-09-02T09:50:00Z')]);
    expect(kinds(classifyOverlap(a, b, stubAirports, cfg))).not.toContain('same_flight');
  });

  it('is not claimed for the same flight number on a different day', () => {
    const a = trip(ada, [segment('SQ317', 'LHR', 'SIN', '2026-09-02T11:00:00Z', '2026-09-02T23:45:00Z')]);
    const b = trip(bo, [segment('SQ317', 'LHR', 'SIN', '2026-09-03T11:00:00Z', '2026-09-03T23:45:00Z')]);
    expect(kinds(classifyOverlap(a, b, stubAirports, cfg))).not.toContain('same_flight');
  });
});

describe('layovers', () => {
  it('computes usable time, not gross connection time', () => {
    // A four-hour connection in the same terminal.
    const t = trip(ada, [
      segment('AY1', 'OSL', 'LHR', '2026-09-02T06:00:00Z', '2026-09-02T08:00:00Z', { to: 'T3' }),
      segment('AY2', 'LHR', 'SIN', '2026-09-02T12:00:00Z', '2026-09-03T02:00:00Z', { from: 'T3' }),
    ]);
    const [l] = layoversFor(t, cfg);
    expect(l!.grossMin).toBe(240);
    // 240 − 15 disembark − 35 boarding = 190.
    expect(l!.usableMin).toBe(190);
    expect(l!.sameTerminal).toBe(true);
  });

  it('charges for a terminal change and the landside re-entry it implies', () => {
    const t = trip(ada, [
      segment('AY1', 'OSL', 'LHR', '2026-09-02T06:00:00Z', '2026-09-02T08:00:00Z', { to: 'T3' }),
      segment('AY2', 'LHR', 'SIN', '2026-09-02T12:00:00Z', '2026-09-03T02:00:00Z', { from: 'T5' }),
    ]);
    const [l] = layoversFor(t, cfg);
    expect(l!.sameTerminal).toBe(false);
    // 240 − 15 − 35 − 25 terminal change − 60 re-entry = 105.
    expect(l!.usableMin).toBe(105);
  });

  it('is conservative when terminals are unknown', () => {
    // Overstating available time is the expensive direction of this error.
    const t = trip(ada, [
      segment('AY1', 'OSL', 'LHR', '2026-09-02T06:00:00Z', '2026-09-02T08:00:00Z'),
      segment('AY2', 'LHR', 'SIN', '2026-09-02T12:00:00Z', '2026-09-03T02:00:00Z'),
    ]);
    expect(layoversFor(t, cfg)[0]!.sameTerminal).toBe(false);
  });

  it('never goes negative on a tight connection', () => {
    expect(usableMinutes(40, { sameTerminal: false, bothAirside: false }, cfg)).toBe(0);
  });

  it('finds a shared layover between two travellers', () => {
    const a = trip(ada, [
      segment('AY1', 'OSL', 'LHR', '2026-09-02T06:00:00Z', '2026-09-02T08:00:00Z', { to: 'T3' }),
      segment('AY2', 'LHR', 'SIN', '2026-09-02T12:00:00Z', '2026-09-03T02:00:00Z', { from: 'T3' }),
    ]);
    const b = trip(bo, [
      segment('BA9', 'CPH', 'LHR', '2026-09-02T07:00:00Z', '2026-09-02T09:00:00Z', { to: 'T3' }),
      segment('BA10', 'LHR', 'NRT', '2026-09-02T13:00:00Z', '2026-09-03T06:00:00Z', { from: 'T3' }),
    ]);

    const out = classifyOverlap(a, b, stubAirports, cfg);
    const layover = out.find((o) => o.kind === 'shared_layover');
    expect(layover).toBeDefined();
    if (layover?.kind === 'shared_layover') {
      expect(layover.airport).toBe('LHR');
      expect(layover.usableMin).toBeGreaterThan(0);
      // Bounded by the shared window (09:00–12:00), not either person's own.
      expect(layover.usableMin).toBeLessThanOrEqual(180);
    }
  });

  it('drops a shared layover too short to be worth anything', () => {
    const a = trip(ada, [
      segment('AY1', 'OSL', 'LHR', '2026-09-02T06:00:00Z', '2026-09-02T08:00:00Z', { to: 'T3' }),
      segment('AY2', 'LHR', 'SIN', '2026-09-02T09:00:00Z', '2026-09-02T22:00:00Z', { from: 'T3' }),
    ]);
    const b = trip(bo, [
      segment('BA9', 'CPH', 'LHR', '2026-09-02T07:40:00Z', '2026-09-02T08:40:00Z', { to: 'T3' }),
      segment('BA10', 'LHR', 'NRT', '2026-09-02T09:30:00Z', '2026-09-03T02:00:00Z', { from: 'T3' }),
    ]);
    expect(kinds(classifyOverlap(a, b, stubAirports, cfg))).not.toContain('shared_layover');
  });
});

describe('same airport window', () => {
  it('matches an arrival against a departure — the shared-transfer case', () => {
    // Ada lands at OSL; Bo is at OSL waiting to leave. This is the original
    // shape of the product: two strangers heading the same way at once.
    const a = trip(ada, [segment('DY1305', 'CPH', 'OSL', '2026-09-02T20:00:00Z', '2026-09-02T21:10:00Z')]);
    const b = trip(bo, [segment('SK273', 'OSL', 'LHR', '2026-09-02T23:00:00Z', '2026-09-03T00:30:00Z')]);

    const out = classifyOverlap(a, b, stubAirports, cfg);
    const w = out.find((o) => o.kind === 'same_airport_window');
    expect(w).toBeDefined();
    if (w?.kind === 'same_airport_window') {
      expect(w.airport).toBe('OSL');
      // Ada is out of the aircraft at 21:25; Bo must be at his gate by 22:25.
      expect(w.usableMin).toBe(60);
    }
  });

  it('finds nothing when the buffers eat the gap', () => {
    // Same pair, but Bo leaves an hour earlier. He has to be at the gate before
    // she has collected herself, so there is genuinely no time — and saying so
    // is better than proposing a coffee that makes someone miss a flight.
    const a = trip(ada, [segment('DY1305', 'CPH', 'OSL', '2026-09-02T20:00:00Z', '2026-09-02T21:10:00Z')]);
    const b = trip(bo, [segment('SK273', 'OSL', 'LHR', '2026-09-02T22:00:00Z', '2026-09-02T23:30:00Z')]);
    expect(kinds(classifyOverlap(a, b, stubAirports, cfg))).not.toContain('same_airport_window');
  });

  it('does not match two people at the same airport hours apart', () => {
    const a = trip(ada, [segment('DY1305', 'CPH', 'OSL', '2026-09-02T06:00:00Z', '2026-09-02T07:10:00Z')]);
    const b = trip(bo, [segment('SK273', 'OSL', 'LHR', '2026-09-02T22:00:00Z', '2026-09-02T23:30:00Z')]);
    expect(kinds(classifyOverlap(a, b, stubAirports, cfg))).not.toContain('same_airport_window');
  });
});

describe('cities', () => {
  it('finds a shared night from the local calendar, not from UTC', () => {
    const a = trip(
      ada,
      [segment('SQ317', 'LHR', 'SIN', '2026-09-02T11:00:00Z', '2026-09-02T23:45:00Z')],
      [stay('singapore-sg', '2026-09-03', '2026-09-06', '2026-09-02T23:45:00Z', '2026-09-06T10:00:00Z')],
    );
    const b = trip(
      bo,
      [segment('BA11', 'LHR', 'SIN', '2026-09-02T09:00:00Z', '2026-09-02T21:00:00Z')],
      [stay('singapore-sg', '2026-09-03', '2026-09-05', '2026-09-02T21:00:00Z', '2026-09-05T08:00:00Z')],
    );

    const out = classifyOverlap(a, b, stubAirports, cfg);
    const night = out.find((o) => o.kind === 'same_city_night');
    expect(night).toBeDefined();
    if (night?.kind === 'same_city_night') {
      // 23:45Z on the 2nd is already the 3rd in Singapore (UTC+8).
      expect(night.night).toBe('2026-09-03');
    }
  });

  it('groups a city across its airports', () => {
    // One lands at Heathrow, the other at Gatwick. Still London.
    const a = trip(
      ada,
      [segment('SK801', 'OSL', 'LHR', '2026-09-02T08:00:00Z', '2026-09-02T10:00:00Z')],
      [stay('london-gb', '2026-09-02', '2026-09-04', '2026-09-02T10:00:00Z', '2026-09-04T18:00:00Z')],
    );
    const b = trip(
      bo,
      [segment('DY1801', 'CPH', 'LGW', '2026-09-02T09:00:00Z', '2026-09-02T11:00:00Z')],
      [stay('london-gb', '2026-09-03', '2026-09-05', '2026-09-02T11:00:00Z', '2026-09-05T09:00:00Z')],
    );

    expect(kinds(classifyOverlap(a, b, stubAirports, cfg))).toContain('overlapping_stay');
  });

  it('counts overlapping days inclusively', () => {
    const a = trip(ada, [], [stay('singapore-sg', '2026-09-03', '2026-09-06', '2026-09-03T00:00:00Z', '2026-09-06T00:00:00Z')]);
    const b = trip(bo, [], [stay('singapore-sg', '2026-09-05', '2026-09-09', '2026-09-05T00:00:00Z', '2026-09-09T00:00:00Z')]);
    const o = classifyOverlap(a, b, stubAirports, cfg).find((x) => x.kind === 'overlapping_stay');
    // 5th and 6th.
    if (o?.kind === 'overlapping_stay') expect(o.days).toBe(2);
  });

  it('finds nothing when the stays do not touch', () => {
    const a = trip(ada, [], [stay('singapore-sg', '2026-09-01', '2026-09-03', '2026-09-01T00:00:00Z', '2026-09-03T00:00:00Z')]);
    const b = trip(bo, [], [stay('singapore-sg', '2026-09-10', '2026-09-12', '2026-09-10T00:00:00Z', '2026-09-12T00:00:00Z')]);
    expect(classifyOverlap(a, b, stubAirports, cfg)).toEqual([]);
  });
});

describe('the date line', () => {
  it('handles a flight that lands "yesterday"', () => {
    // NRT → LAX crosses the line: departs the 3rd, lands the 2nd local.
    const a = trip(
      ada,
      [segment('NH106', 'NRT', 'LAX', '2026-09-03T08:00:00Z', '2026-09-03T17:30:00Z')],
      [stay('los-angeles-us', '2026-09-03', '2026-09-05', '2026-09-03T17:30:00Z', '2026-09-05T20:00:00Z')],
    );
    const b = trip(
      bo,
      [segment('UA32', 'SIN', 'LAX', '2026-09-03T10:00:00Z', '2026-09-03T22:00:00Z')],
      [stay('los-angeles-us', '2026-09-03', '2026-09-06', '2026-09-03T22:00:00Z', '2026-09-06T12:00:00Z')],
    );

    const out = classifyOverlap(a, b, stubAirports, cfg);
    const night = out.find((o) => o.kind === 'same_city_night');
    expect(night).toBeDefined();
    if (night?.kind === 'same_city_night') {
      // 22:00Z is 15:00 in Los Angeles on the 3rd.
      expect(night.night).toBe('2026-09-03');
    }
  });

  it('handles a UTC+13 destination', () => {
    const a = trip(ada, [], [stay('auckland-nz', '2026-09-04', '2026-09-08', '2026-09-03T12:00:00Z', '2026-09-08T00:00:00Z')]);
    const b = trip(bo, [], [stay('auckland-nz', '2026-09-04', '2026-09-06', '2026-09-03T20:00:00Z', '2026-09-06T00:00:00Z')]);
    const out = classifyOverlap(a, b, stubAirports, cfg);
    expect(kinds(out)).toContain('same_city_night');
  });
});

describe('strongest overlap', () => {
  it('leads with the flight when a pair shares several things', () => {
    const segs = [segment('SQ317', 'LHR', 'SIN', '2026-09-02T11:00:00Z', '2026-09-02T23:45:00Z')];
    const stays = [stay('singapore-sg', '2026-09-03', '2026-09-06', '2026-09-02T23:45:00Z', '2026-09-06T10:00:00Z')];
    const a = trip(ada, segs, stays);
    const b = trip(bo, [...segs], [...stays]);

    const out = classifyOverlap(a, b, stubAirports, cfg);
    expect(out.length).toBeGreaterThan(1);
    expect(strongest(out)?.kind).toBe('same_flight');
  });
});

it('is stable — classification does not depend on argument order', () => {
  const a = trip(ada, [
    segment('AY1', 'OSL', 'LHR', '2026-09-02T06:00:00Z', '2026-09-02T08:00:00Z', { to: 'T3' }),
    segment('AY2', 'LHR', 'SIN', '2026-09-02T12:00:00Z', '2026-09-03T02:00:00Z', { from: 'T3' }),
  ]);
  const b = trip(bo, [
    segment('BA9', 'CPH', 'LHR', '2026-09-02T07:00:00Z', '2026-09-02T09:00:00Z', { to: 'T3' }),
    segment('BA10', 'LHR', 'NRT', '2026-09-02T13:00:00Z', '2026-09-03T06:00:00Z', { from: 'T3' }),
  ]);

  expect(kinds(classifyOverlap(a, b, stubAirports, cfg)).sort()).toEqual(
    kinds(classifyOverlap(b, a, stubAirports, cfg)).sort(),
  );
  expect(NOW).toBeDefined();
});
