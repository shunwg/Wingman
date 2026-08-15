import type { CityKey, IataCode } from './ids';
import type { PublicPlace } from './meet';
import type { Redacted } from './person';
import type { MeetKind } from './intent';

/**
 * Constructors and narrowing helpers.
 *
 * Types stop wrong *shapes*. These stop wrong *values* — the cases where the
 * shape is fine and the content is the problem.
 */

const PUBLIC_KINDS: ReadonlySet<PublicPlace['kind']> = new Set([
  'gate',
  'lounge',
  'terminal_landmark',
  'cafe',
  'restaurant',
  'taxi_rank',
  'station',
  'hotel_lobby',
]);

/**
 * The only sanctioned way to build a meeting point.
 *
 * Every meet happens on public ground. Not as a guideline in a help article —
 * as the only thing this constructor will produce. Somebody's flat cannot be
 * expressed as a `PublicPlace`, so it cannot reach a `Meet`.
 */
export function makePublicPlace(input: {
  kind: PublicPlace['kind'];
  label: string;
  airportIata?: IataCode;
  cityKey?: CityKey;
  lat?: number;
  lon?: number;
}): PublicPlace {
  if (!PUBLIC_KINDS.has(input.kind)) {
    throw new Error(`Meets happen on public ground. Refused place kind: ${String(input.kind)}`);
  }
  if (!input.label.trim()) {
    throw new Error('A meeting point needs a label someone can actually navigate to.');
  }
  if (!input.airportIata && !input.cityKey) {
    throw new Error('A meeting point must be anchored to an airport or a city.');
  }
  return { ...input, isPublicGround: true };
}

export const isPublicPlace = (v: unknown): v is PublicPlace =>
  typeof v === 'object' &&
  v !== null &&
  (v as PublicPlace).isPublicGround === true &&
  PUBLIC_KINDS.has((v as PublicPlace).kind);

/** Narrow a possibly-withheld field to its value. */
export function visible<T>(v: T | Redacted): v is T {
  return !(typeof v === 'object' && v !== null && (v as Redacted).__redacted === true);
}

/** Read a possibly-withheld field, with a fallback for the withheld case. */
export function orElse<T>(v: T | Redacted, fallback: T): T {
  return visible(v) ? v : fallback;
}

/**
 * Kinds that need the two people to be airside together. Used by the layover
 * rules — a landside coffee during an airside connection is not a thing.
 */
export const AIRSIDE_KINDS: ReadonlySet<MeetKind> = new Set<MeetKind>([
  'gate_coffee',
  'lounge',
  'terminal_walk',
]);

/** Kinds that only make sense once you have left the airport. */
export const CITY_KINDS: ReadonlySet<MeetKind> = new Set<MeetKind>([
  'meal',
  'drinks',
  'coworking',
]);

export function exhaustive(v: never, context: string): never {
  throw new Error(`Unhandled case in ${context}: ${JSON.stringify(v)}`);
}
