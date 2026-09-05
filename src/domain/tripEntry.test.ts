import { describe, expect, it } from 'vitest';
import { airportIndex } from '@data/airports';
import { asPersonId, asTripId } from './ids';
import type { ISODateTime } from './time';
import { buildTripFromEntry, validateTripEntry, type TripEntry } from './tripEntry';

const NOW = '2026-09-02T16:30:00Z' as ISODateTime;
const ids = { tripId: asTripId('t_test'), personId: asPersonId('you'), now: NOW };

const oslCph = {
  segments: [
    { from: 'OSL', to: 'CPH', date: '2026-09-18', departLocal: '08:40', arriveLocal: '10:00', flightNo: 'SK1465' },
  ],
  stay: { until: '2026-09-20', areaLabel: 'Indre By' },
} as unknown as TripEntry;

const seg = (patch: object) => ({ ...oslCph, segments: [{ ...oslCph.segments[0]!, ...patch }] }) as TripEntry;

describe('buildTripFromEntry', () => {
  it('reproduces the seed SK1465 instants', () => {
    const t = buildTripFromEntry(oslCph, airportIndex, ids);
    expect(t.segments[0]!.departUtc).toBe('2026-09-18T06:40:00Z');
    expect(t.segments[0]!.arriveUtc).toBe('2026-09-18T08:00:00Z');
    expect(t.segments[0]!.flightNo).toBe('SK1465');
    expect(t.segments[0]!.carrier).toBe('SK');
    expect(t.segments[0]!.source).toBe('manual');
    expect(t.stays[0]!.destination?.label).toBe('Indre By');
    expect(t.stays[0]!.dates).toEqual({ from: '2026-09-18', to: '2026-09-20' });
    expect(t.stays[0]!.cityKey).toBe('copenhagen-dk');
    expect(t.visibility.listing).toBe('listed');
    expect(t.layovers).toEqual([]);
    expect(t.id).toBe('t_test');
  });

  it('rolls an overnight arrival to the next local date', () => {
    const t = buildTripFromEntry(
      { segments: [{ from: 'LHR', to: 'SIN', date: '2026-09-02', departLocal: '21:00', arriveLocal: '17:00', flightNo: 'SQ317' }] } as unknown as TripEntry,
      airportIndex,
      ids,
    );
    expect(t.segments[0]!.departUtc).toBe('2026-09-02T20:00:00Z');
    expect(t.segments[0]!.arriveUtc).toBe('2026-09-03T09:00:00Z');
    expect(t.stays).toEqual([]);
  });

  it('uses the city centroid and city name when no area is named', () => {
    const t = buildTripFromEntry({ ...oslCph, stay: { until: '2026-09-20' } } as TripEntry, airportIndex, ids);
    const city = airportIndex.city(oslCph.segments[0]!.to)!;
    expect(t.stays[0]!.destination).toEqual({ lat: city.lat, lon: city.lon, label: city.name });
  });

  it('names a segment by its airports when no flight number is given', () => {
    const t = buildTripFromEntry(seg({ flightNo: undefined }), airportIndex, ids);
    expect(t.segments[0]!.flightNo).toBe('OSL–CPH');
    expect(t.segments[0]!.carrier).toBe('');
  });
});

describe('validateTripEntry', () => {
  it('passes a good entry', () => {
    expect(validateTripEntry(oslCph, airportIndex, NOW)).toEqual([]);
  });

  it.each([
    ['unknown airport', seg({ to: 'ZZZ' }), 'to'],
    ['same airport', seg({ to: 'OSL' }), 'to'],
    ['in the past', seg({ date: '2026-08-01' }), 'date'],
    ['bad time', seg({ departLocal: '25:00' }), 'departLocal'],
    ['stay before arrival', { ...oslCph, stay: { until: '2026-09-17' } } as TripEntry, 'stay.until'],
    ['bad flight number', seg({ flightNo: 'S' }), 'flightNo'],
  ])('%s → error on %s', (_name, entry, field) => {
    expect(validateTripEntry(entry, airportIndex, NOW).map((e) => e.field)).toContain(field);
  });

  it('chains two segments and rejects a broken chain', () => {
    const second = { from: 'CPH', to: 'LHR', date: '2026-09-18', departLocal: '12:00', arriveLocal: '13:00' };
    const two = { ...oslCph, segments: [oslCph.segments[0]!, second] } as unknown as TripEntry;
    expect(validateTripEntry(two, airportIndex, NOW)).toEqual([]);
    const broken = { ...two, segments: [two.segments[0]!, { ...second, from: 'ARN' }] } as unknown as TripEntry;
    expect(validateTripEntry(broken, airportIndex, NOW).map((e) => e.field)).toContain('segments.1.from');
    const early = { ...two, segments: [two.segments[0]!, { ...second, departLocal: '09:00' }] } as unknown as TripEntry;
    expect(validateTripEntry(early, airportIndex, NOW).map((e) => e.field)).toContain('segments.1.departLocal');
  });
});
