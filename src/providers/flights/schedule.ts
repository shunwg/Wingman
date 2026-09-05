import type { IataCode } from '@domain/index';
import { asIata, localTime, type ISODateTime } from '@domain/index';
import { airportIndex } from '@data/airports/index';

/**
 * The bundled schedule.
 *
 * The flights the seed cast is on, as a daily timetable: local departure and
 * arrival wall clocks, terminals where known. Enough for "type SK1465 and it
 * fills itself in" to be true for every flight in the demo, and the same
 * shape a live adapter will produce, so the form never learns where a
 * schedule came from.
 */
export interface ScheduledFlight {
  flightNo: string;
  carrier: string;
  from: IataCode;
  to: IataCode;
  /** Local to `from` / `to`, 'HH:MM'. */
  departLocal: string;
  arriveLocal: string;
  terminalFrom?: string;
  terminalTo?: string;
  /** Lands the day after it leaves. */
  overnight: boolean;
}

/** A sample instant per flight; the local wall clock is what the schedule keeps. */
const SAMPLE: [string, string, string, string, string, string, string?, string?][] = [
  ['SQ317', 'SQ', 'LHR', 'SIN', '2026-09-02T20:00:00Z', '2026-09-03T09:00:00Z', 'T2', 'T3'],
  ['SK1465', 'SK', 'OSL', 'CPH', '2026-09-18T06:40:00Z', '2026-09-18T08:00:00Z', undefined, 'T3'],
  ['BA767', 'BA', 'OSL', 'LHR', '2026-10-06T09:15:00Z', '2026-10-06T10:35:00Z', undefined, 'T5'],
  ['AI161', 'AI', 'DEL', 'LHR', '2026-09-02T09:00:00Z', '2026-09-02T16:00:00Z', undefined, 'T2'],
  ['BA75', 'BA', 'LHR', 'ACC', '2026-09-02T21:30:00Z', '2026-09-03T03:30:00Z', 'T2', undefined],
  ['TK1979', 'TK', 'IST', 'LHR', '2026-09-02T15:00:00Z', '2026-09-02T17:00:00Z', undefined, 'T5'],
  ['BA43', 'BA', 'LHR', 'DXB', '2026-09-02T22:00:00Z', '2026-09-03T06:00:00Z', 'T2', undefined],
  ['EK354', 'EK', 'DXB', 'SIN', '2026-09-03T01:00:00Z', '2026-09-03T09:15:00Z', undefined, 'T3'],
  ['SK975', 'SK', 'OSL', 'SIN', '2026-09-02T21:00:00Z', '2026-09-03T09:20:00Z', undefined, 'T3'],
  ['TP1356', 'TP', 'LIS', 'LHR', '2026-09-02T09:30:00Z', '2026-09-02T11:20:00Z', undefined, 'T2'],
  ['BA55', 'BA', 'LHR', 'JNB', '2026-09-02T21:15:00Z', '2026-09-03T08:30:00Z', 'T2', undefined],
  ['AF254', 'AF', 'CDG', 'SIN', '2026-09-02T22:30:00Z', '2026-09-03T10:40:00Z', undefined, 'T1'],
  ['SK973', 'SK', 'OSL', 'SIN', '2026-09-03T10:00:00Z', '2026-09-03T22:10:00Z', undefined, 'T3'],
  ['SK1461', 'SK', 'OSL', 'CPH', '2026-09-18T07:10:00Z', '2026-09-18T08:30:00Z', undefined, 'T3'],
  ['DY936', 'DY', 'OSL', 'CPH', '2026-09-18T05:55:00Z', '2026-09-18T07:15:00Z', undefined, 'T2'],
  ['AF1080', 'AF', 'CDG', 'LHR', '2026-10-06T08:00:00Z', '2026-10-06T08:25:00Z', undefined, 'T4'],
  ['LO279', 'LO', 'WAW', 'LHR', '2026-10-06T06:30:00Z', '2026-10-06T08:40:00Z', undefined, 'T2'],
];

export const SCHEDULE: ScheduledFlight[] = SAMPLE.map(([no, carrier, from, to, dep, arr, tFrom, tTo]) => {
  const f = asIata(from);
  const t = asIata(to);
  const fromZone = airportIndex.zone(f)!;
  const toZone = airportIndex.zone(t)!;
  return {
    flightNo: no,
    carrier,
    from: f,
    to: t,
    departLocal: localTime(dep as ISODateTime, fromZone),
    arriveLocal: localTime(arr as ISODateTime, toZone),
    ...(tFrom ? { terminalFrom: tFrom } : {}),
    ...(tTo ? { terminalTo: tTo } : {}),
    overnight: dep.slice(0, 10) !== arr.slice(0, 10) && localTime(arr as ISODateTime, toZone) < localTime(dep as ISODateTime, fromZone),
  };
});

export const normaliseFlightNo = (s: string): string => s.replace(/\s+/g, '').toUpperCase();

export const scheduled = (flightNo: string): ScheduledFlight | undefined =>
  SCHEDULE.find((f) => f.flightNo === normaliseFlightNo(flightNo));
