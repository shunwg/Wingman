import type { CityKey, IataCode, MeetId, PersonId } from './ids';
import type { Meet, MeetOrigin, PublicPlace } from './meet';
import type { Redacted } from './person';
import type { MeetKind } from './intent';
import type { TimeWindow } from './time';

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

/**
 * Meet kinds that more than two people can share.
 *
 * Every kind is listed in one of the two sets below, deliberately, with no
 * default — so adding a ninth `MeetKind` breaks the exhaustiveness test in
 * guards.test.ts rather than silently inheriting whichever answer was easier.
 *
 * A car, a table and a desk hold a group. The airside kinds do not, because
 * they are bounded by a layover and a gate bench; and a business introduction
 * is between two people by definition — three makes it a meeting, which is a
 * different thing with different consent.
 */
export const GROUP_KINDS: ReadonlySet<MeetKind> = new Set<MeetKind>([
  'ride_share',
  'meal',
  'drinks',
  'coworking',
]);

/** Meet kinds that are between exactly two people. */
export const PAIR_ONLY_KINDS: ReadonlySet<MeetKind> = new Set<MeetKind>([
  'gate_coffee',
  'lounge',
  'terminal_walk',
  'business_intro',
]);

/**
 * The only sanctioned way to build a meet.
 *
 * `Meet.participants` used to be a `[PersonId, PersonId]` tuple, and the tuple
 * was doing real work: it made "three people at a gate coffee" unrepresentable.
 * Widening it so a taxi can exist would have thrown that away, so the invariant
 * moved here instead of disappearing — the same trade `makePublicPlace()` makes,
 * where the type cannot express the rule and the constructor refuses to build
 * the value.
 */
export function makeMeet(input: {
  id: MeetId;
  participants: PersonId[];
  kind: MeetKind;
  origin: MeetOrigin;
  place: PublicPlace;
  window: TimeWindow;
}): Meet {
  const { participants: people, kind } = input;
  if (people.length < 2) {
    throw new Error(`A meet is at least two people. Got ${people.length}.`);
  }
  if (new Set(people.map(String)).size !== people.length) {
    throw new Error('The same person cannot be in a meet twice.');
  }
  if (!GROUP_KINDS.has(kind) && people.length > 2) {
    throw new Error(`A ${kind} is between two people. Got ${people.length}.`);
  }
  return {
    id: input.id,
    participants: [...people],
    origin: input.origin,
    kind,
    place: input.place,
    window: input.window,
    status: 'scheduled',
    checkIns: {},
    guardianSessionIds: [],
    ratingIds: [],
  };
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
