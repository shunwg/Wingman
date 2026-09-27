import { describe, expect, it } from 'vitest';
import { airportIndex } from '@data/airports';
import { asPersonId, asTripId, buildTripFromEntry, type TripEntry } from '@domain/index';
import type { ISODateTime } from '@domain/time';
import { needsForTrip } from './rides';

const entry = {
  segments: [{ from: 'OSL', to: 'CPH', date: '2026-09-18', departLocal: '08:40', arriveLocal: '10:00', flightNo: 'SK1465' }],
  stay: { until: '2026-09-20', areaLabel: 'Indre By' },
} as unknown as TripEntry;

describe('needsForTrip — back to the airport on a day with no time', () => {
  it('looks across the whole leaving day, so a 15:00 car is found', () => {
    const trip = buildTripFromEntry(entry, airportIndex, {
      tripId: asTripId('t1'),
      personId: asPersonId('you'),
      now: '2026-09-02T16:30:00Z' as ISODateTime,
    });
    const back = needsForTrip(trip).filter((n) => n.direction === 'to_airport' && String(n.airportIata) === 'CPH');
    expect(back).toHaveLength(1);
    // 15:00 local in Copenhagen is 13:00Z; the old window ended at 10:00Z.
    const at = Date.parse('2026-09-20T13:00:00Z');
    expect(Date.parse(String(back[0]!.window.from))).toBeLessThanOrEqual(at);
    expect(Date.parse(String(back[0]!.window.to))).toBeGreaterThanOrEqual(at);
  });
});
