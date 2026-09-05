import type { ISODate } from '@domain/index';
import { scheduled, type ScheduledFlight } from './schedule';

/**
 * Flight data, degrading rather than failing.
 *
 *   live provider → fresh cache → stale cache (flagged) → bundled schedule →
 *   synthetic → manual entry
 *
 * Today only two rungs exist — bundled and manual — and the shape is the
 * contract a live adapter drops into behind. With no API keys at all the app
 * works completely; a key improves accuracy, it never unlocks a feature.
 */
export type Resolved =
  | { status: 'bundled'; flight: ScheduledFlight }
  | { status: 'unknown' };

export function resolveFlight(flightNo: string, _date?: ISODate): Promise<Resolved> {
  const flight = scheduled(flightNo);
  return Promise.resolve(flight ? { status: 'bundled', flight } : { status: 'unknown' });
}
