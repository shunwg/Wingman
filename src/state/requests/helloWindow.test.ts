import { describe, expect, it } from 'vitest';
import type { FlightSegment, ISODateTime } from '@domain/index';
import { asIata, asSegmentId } from '@domain/ids';
import { helloWindow } from './helloWindow';

const t = (s: string) => s as ISODateTime;
const now = t('2026-09-02T16:30:00Z');

const sq317 = {
  id: asSegmentId('seg_sq317'),
  flightNo: 'SQ317',
  from: asIata('LHR'),
  to: asIata('SIN'),
  departUtc: t('2026-09-02T20:00:00Z'),
  arriveUtc: t('2026-09-03T09:00:00Z'),
} as FlightSegment;

const sameFlight = {
  kind: 'same_flight' as const,
  segmentId: asSegmentId('seg_sq317'),
  theirSegmentId: asSegmentId('x'),
  flightNo: 'SQ317',
  durationMin: 780,
};

describe('helloWindow — what a hello is about, taken from how two trips touch', () => {
  it('asks about the landing for a ride in, not the next ninety minutes in London', () => {
    const h = helloWindow(sameFlight, 'ride_share', [sq317], now);
    expect(h.window).toEqual({ from: '2026-09-03T09:30:00.000Z', to: '2026-09-03T11:30:00.000Z' });
    expect(String(h.airport)).toBe('SIN');
  });

  it('asks about before boarding for a coffee at the gate', () => {
    const h = helloWindow(sameFlight, 'gate_coffee', [sq317], now);
    expect(h.window).toEqual({ from: '2026-09-02T18:00:00.000Z', to: '2026-09-02T19:30:00.000Z' });
    expect(String(h.airport)).toBe('LHR');
  });

  it('never starts before now', () => {
    const late = t('2026-09-02T18:45:00Z');
    expect(helloWindow(sameFlight, 'gate_coffee', [sq317], late).window.from).toBe(late);
  });

  it('uses the shared window at an airport, from now on', () => {
    const h = helloWindow(
      {
        kind: 'same_airport_window',
        airport: asIata('LHR'),
        window: { from: t('2026-09-02T16:00:00Z'), to: t('2026-09-02T19:20:00Z') },
        usableMin: 120,
        sameTerminal: 'same',
        bothAirside: true,
      },
      'gate_coffee',
      [sq317],
      now,
    );
    expect(h.window).toEqual({ from: now, to: t('2026-09-02T19:20:00Z') });
    expect(String(h.airport)).toBe('LHR');
  });

  it('falls back to the next ninety minutes when the overlap says nothing about time', () => {
    const h = helloWindow(
      { kind: 'overlapping_stay', cityKey: 'singapore-sg' as never, overlap: { from: '2026-09-03' as never, to: '2026-09-05' as never }, days: 3 },
      'meal',
      [sq317],
      now,
    );
    expect(h.window).toEqual({ from: now, to: '2026-09-02T18:00:00.000Z' });
    expect(h.airport).toBeUndefined();
  });

  it('falls back too when the window it would use has already gone', () => {
    const after = t('2026-09-02T19:45:00Z');
    expect(helloWindow(sameFlight, 'gate_coffee', [sq317], after).window.from).toBe(after);
  });
});
