import type { CircleId, IataCode, PersonId, RideId, TripId } from './ids';
import type { ISODateTime, TimeWindow } from './time';
import type { AudienceRule } from './privacy';
import { looksLikeAddress } from './guards';

/**
 * A shared car, to or from an airport.
 *
 * Why this is its own object and not a `Meet`: a `Meet` is two people who
 * agreed to be somewhere, and a car is three or four people, a finite number of
 * seats, a fare to divide, a host, and a door that may be open, circle-locked or
 * code-locked. Four people splitting a fare is not six pairwise meets — the last
 * seat, the single pickup time and the one group room all stop making sense the
 * moment you model a group as pairs.
 *
 * A ride hangs off a `Trip` rather than standing alone, because the person who
 * wants one always already has the flight in the system. `ride_share` was
 * already one of the `MeetKind`s a trip opens to; this is that intention made
 * into something you can actually offer and take a seat in.
 *
 * The direction matters and is stored, not inferred. `ride_share` used to be
 * documented as "landside, shared transfer into town" — one direction, as though
 * the only interesting car is the one leaving the airport. Getting to a 06:40
 * departure is the half people actually dread.
 */

export type RideDirection = 'to_airport' | 'from_airport';

/**
 * The end of the ride that is not the airport.
 *
 * Deliberately coarse, and the type is the enforcement — the same decision, for
 * the same reason, as `StayWindow.destination`. A neighbourhood centroid answers
 * "are we going the same way" and nothing narrower. A street address would make
 * this a tracking database, so it cannot be represented here at all.
 */
export interface RidePoint {
  lat: number;
  lon: number;
  /** Somewhere a driver and a passenger both recognise — "Fontainebleau". */
  label: string;
}

/**
 * Who may take a seat, and who seats themselves.
 *
 * Three doors, because "anyone", "my cohort" and "the people I sent a link to"
 * are genuinely different postures and collapsing them into one setting means
 * everyone picks the most cautious value and the car never fills.
 *
 * The attribute filters live in `rules`, which is the *same* `AudienceRule` the
 * privacy engine compiles for a profile. "Women only" on a car is therefore the
 * same rule, evaluated by the same code, as "women only" on a profile — one
 * privacy model rather than a second, subtly different one that drifts.
 */
export type RideAudience =
  /**
   * Anyone satisfying `rules` may ask. The host confirms each claim, because
   * "anyone who matches" on a fully open car puts a stranger in a car with you,
   * and the car is the one surface where this product should stay conservative.
   */
  | { kind: 'open'; rules: AudienceRule }
  /**
   * Members of these circles seat themselves — they have already been admitted
   * to something. An empty list admits **nobody**: `f64b42d` fixed exactly this
   * bug at profile level, where circles-only with zero circles made someone
   * visible to everyone, and `makeRide()` refuses it here rather than letting it
   * be written once and discovered later.
   */
  | { kind: 'circles'; circleIds: CircleId[]; rules?: AudienceRule }
  /** Only whoever holds the code, and they seat themselves. */
  | { kind: 'invite'; rules?: AudienceRule };

/**
 * A seat's lifecycle.
 *
 * `declined` and `withdrawn` are distinct states rather than a deletion, for the
 * same reason `MeetRequestStatus` keeps `denied`: the system has to tell "asked
 * and refused" from "never asked", even where the passenger is shown neither.
 */
export type RideClaimStatus =
  | 'requested'
  | 'confirmed'
  | 'declined'
  | 'withdrawn'
  /**
   * The host took the seat back after granting it.
   *
   * Distinct from `declined` (never granted) and from `withdrawn` (the
   * passenger pulled out), because a host who changes her mind about somebody
   * she already said yes to is the case this feature most needs to support and
   * the one a shared status would have hidden. A car is not a café: you cannot
   * walk out of it, so the decision has to stay reversible right up to the
   * kerb.
   */
  | 'removed_by_host'
  | 'expired'
  | 'revoked_by_policy';

/**
 * Statuses that occupy a seat.
 *
 * Only `confirmed`, and the reason is a leak rather than a preference. When a
 * pending request also consumed a seat, the seat count became an oracle for a
 * refusal: seats drop with no new face in the car, so somebody asked — and
 * then seats go back *up*, which says the host declined them. That is the one
 * fact `claimantView()` exists to keep private, and with a 2–4 seat car the
 * number is permanently inside the band `lib/bucket.ts` was written to
 * suppress. An adversarial persona found it by arithmetic alone.
 *
 * What it costs: two people can ask for the same last seat and one is
 * disappointed. That is a real cost, it is visible and explainable, and it is
 * strictly better than leaking a decline to the person declined.
 */
const LIVE_CLAIM: ReadonlySet<RideClaimStatus> = new Set<RideClaimStatus>(['confirmed']);

export interface RideClaimEvent {
  at: ISODateTime;
  by: PersonId | 'system';
  from: RideClaimStatus;
  to: RideClaimStatus;
  note?: string;
}

export interface RideClaim {
  personId: PersonId;
  status: RideClaimStatus;
  askedAt: ISODateTime;
  /** Append-only. The seat FSM's only source of truth. */
  history: RideClaimEvent[];
  /** <=200 chars, optional — "happy to meet at the rank at 14:10". */
  note?: string;
}

/**
 * The ride's own lifecycle.
 *
 * There is deliberately no `full`. Full is `seatsLeft(ride) === 0`, computed on
 * read: a stored `full` is derived state that a withdrawal would silently
 * falsify, and rule 2 exists because exactly that kind of staleness is how a
 * visibility bug becomes a privacy incident.
 */
export type RideStatus = 'open' | 'confirmed' | 'departed' | 'completed' | 'cancelled';

export interface RideEvent {
  at: ISODateTime;
  by: PersonId | 'system';
  from: RideStatus;
  to: RideStatus;
}

export interface RideFare {
  /** The whole car, in minor units — 15000 is €150.00. */
  amountMinor: number;
  /** ISO 4217, upper case. */
  currency: string;
}

/** A spot and a car, not a message thread. */
export const PICKUP_NOTE_CAP = 160;

export interface Ride {
  id: RideId;
  hostPersonId: PersonId;
  /** The host's trip this car belongs to. A ride cannot outlive its trip. */
  tripId: TripId;
  direction: RideDirection;
  /** The airport end, whichever end of the journey that is. */
  airportIata: IataCode;
  /** The other end. */
  point: RidePoint;
  /** The pickup window, UTC — local only at the render edge. */
  window: TimeWindow;
  /** Seats in the car, including the host's own. */
  seatsTotal: number;
  /** Append-only. These are facts about who asked, not derived state. */
  claims: RideClaim[];
  audience: RideAudience;
  /** Present for the `invite` door: six characters, the circle-invite format. */
  inviteCode?: string;
  /** What the host said about money. A stated intention, never a transaction. */
  fareSplit: 'even' | 'host_pays';
  /**
   * What the whole car should cost, as the host guesses it. Minor units and an
   * ISO 4217 code. Optional because a host often does not know until the
   * driver quotes — and a car with no number is still a car worth sharing.
   *
   * It exists because "cheaper split three ways than two" is the entire pitch
   * of a shared cab, and until v9 the app could say *that* it would be split
   * but never *what* anyone would pay.
   */
  fare?: RideFare;
  /**
   * The exact spot and the car — "Rank door 12, white estate, plate ends 4R".
   *
   * Shown to the people in the car and nobody else. Gated on being confirmed,
   * not on the car filling: a car that never fills still has passengers who
   * need to know where to stand.
   */
  pickupNote?: string;
  status: RideStatus;
  /** Append-only. The ride FSM's only source of truth. */
  history: RideEvent[];
  createdAt: ISODateTime;
  /** Pinned to the end of the pickup window. */
  expiresAt: ISODateTime;
}

/**
 * The only sanctioned way to open a car.
 *
 * Same idiom as `makePublicPlace()`: the shape is fine and the *content* is what
 * can be wrong, so the constructor refuses the wrong content rather than leaving
 * a comment asking callers not to write it.
 */
export function makeRide(input: {
  id: RideId;
  hostPersonId: PersonId;
  tripId: TripId;
  direction: RideDirection;
  airportIata: IataCode;
  point: RidePoint;
  window: TimeWindow;
  seatsTotal: number;
  audience: RideAudience;
  createdAt: ISODateTime;
  inviteCode?: string;
  fareSplit?: Ride['fareSplit'];
  fare?: RideFare;
  pickupNote?: string;
}): Ride {
  if (input.seatsTotal < 2) {
    throw new Error('A shared car needs room for at least one passenger besides the host.');
  }
  if (input.window.to <= input.window.from) {
    throw new Error('A pickup window that ends before it starts cannot be met.');
  }
  if (!input.point.label.trim()) {
    throw new Error('A pickup point needs a label someone can navigate to; a lat/lon alone is not a place.');
  }
  if (looksLikeAddress(input.point.label)) {
    throw new Error('A pickup point is a neighbourhood, never an address.');
  }
  if (input.audience.kind === 'circles' && input.audience.circleIds.length === 0) {
    throw new Error('A circles-only car with no circles admits nobody. Name a circle, or open the car.');
  }
  if (input.fare) assertFare(input.fare);
  const note = input.pickupNote?.trim();
  if (note && note.length > PICKUP_NOTE_CAP) {
    throw new Error(`A pickup note is a spot and a car, at most ${PICKUP_NOTE_CAP} characters.`);
  }
  if (note && looksLikeAddress(note)) {
    throw new Error('A pickup note names a public spot, never an address.');
  }
  return {
    id: input.id,
    hostPersonId: input.hostPersonId,
    tripId: input.tripId,
    direction: input.direction,
    airportIata: input.airportIata,
    point: input.point,
    window: input.window,
    seatsTotal: input.seatsTotal,
    claims: [],
    audience: input.audience,
    ...(input.inviteCode ? { inviteCode: input.inviteCode } : {}),
    fareSplit: input.fareSplit ?? 'even',
    ...(input.fare ? { fare: { amountMinor: input.fare.amountMinor, currency: input.fare.currency } } : {}),
    ...(note ? { pickupNote: note } : {}),
    status: 'open',
    history: [],
    createdAt: input.createdAt,
    expiresAt: input.window.to,
  };
}

/** Refuses an estimate nobody could pay: zero, negative, fractional, or in no currency. */
export function assertFare(fare: RideFare): void {
  if (!Number.isInteger(fare.amountMinor) || fare.amountMinor <= 0) {
    throw new Error('A fare estimate is a positive whole number of minor units.');
  }
  if (!/^[A-Z]{3}$/.test(fare.currency)) {
    throw new Error(`A currency is a three-letter ISO code, not ${JSON.stringify(fare.currency)}.`);
  }
}

/**
 * Each person's share of the estimate, with `people` in the car.
 *
 * Rounded *up* to a whole unit: quoting someone €33 for a €100 car split three
 * ways is quoting them less than they will pay, and the one thing a number on
 * this screen must never do is get cheaper at the kerb. `host_pays` is nothing
 * each; no estimate, or nobody in the car, is unknown rather than zero.
 */
export function fareEach(r: Ride, people: number): number | undefined {
  if (r.fareSplit === 'host_pays') return 0;
  if (!r.fare || people <= 0) return undefined;
  return Math.ceil(r.fare.amountMinor / people / 100) * 100;
}

/** Seats still available. The host occupies one; live claims take the rest. */
export function seatsLeft(r: Ride): number {
  const taken = r.claims.filter((c) => LIVE_CLAIM.has(c.status)).length;
  return Math.max(0, r.seatsTotal - 1 - taken);
}

/** Seats asked for and not yet settled. The host's view only. */
export function seatsPending(r: Ride): number {
  return r.claims.filter((c) => c.status === 'requested').length;
}

/**
 * A person's newest seat in this car.
 *
 * A person can hold several claims on one car over time — asked, withdrew,
 * asked again. Reading the *first* one is how a removed passenger came back in
 * through a link, and how the host's second "take the seat back" landed on a
 * finished claim and quietly did nothing.
 */
export function latestClaim(r: Ride, personId: PersonId | string): RideClaim | undefined {
  for (let i = r.claims.length - 1; i >= 0; i--) {
    const c = r.claims[i]!;
    if (String(c.personId) === String(personId)) return c;
  }
  return undefined;
}

/**
 * Who is in the car's room: the host and everyone with a confirmed seat.
 *
 * Derived from the car on every read. The room used to store its member list
 * when it opened and never shrink it, so a passenger who left — or whom the
 * host removed — kept reading and posting where the others arranged the
 * pickup. Rule 2: a stored copy of a derived thing is where two facts disagree.
 *
 * One exception, deliberately: when the car is called off, the people who were
 * in it stay, so they can read that it is off.
 */
export function roomMembers(r: Ride): PersonId[] {
  const inCar = r.claims.filter(
    (c) =>
      c.status === 'confirmed' ||
      // Ended by the host's call-off — not by a hide, which the system writes.
      // Treating both alike let a rider someone had hidden back into the room
      // the moment the car was called off.
      (r.status === 'cancelled' &&
        c.status === 'revoked_by_policy' &&
        c.history.at(-1)?.from === 'confirmed' &&
        String(c.history.at(-1)?.by) === String(r.hostPersonId)),
  );
  return [r.hostPersonId, ...new Set(inCar.map((c) => c.personId))];
}

/** Everyone who is actually in the car, host first. */
export function riders(r: Ride): PersonId[] {
  return [r.hostPersonId, ...r.claims.filter((c) => c.status === 'confirmed').map((c) => c.personId)];
}

/** Whether a seat can still be asked for at `now`. Never stored. */
export function rideIsJoinable(r: Ride, now: ISODateTime): boolean {
  if (r.status !== 'open' && r.status !== 'confirmed') return false;
  if (now >= r.expiresAt) return false;
  return seatsLeft(r) > 0;
}

/**
 * Whether two people are going the same way.
 *
 * Trivial, and named anyway: `a === b` at a call site reads as a typo, and the
 * one thing this comparison must never quietly become is "both are at CDG".
 */
export function sharesDirection(a: RideDirection, b: RideDirection): boolean {
  return a === b;
}

/** Who seats themselves, and who waits for the host. */
export function seatsAutomatically(a: RideAudience): boolean {
  return a.kind !== 'open';
}

/** "CDG → Fontainebleau", in travel order. */
export function rideRoute(r: Ride): { from: string; to: string } {
  return r.direction === 'from_airport'
    ? { from: String(r.airportIata), to: r.point.label }
    : { from: r.point.label, to: String(r.airportIata) };
}
