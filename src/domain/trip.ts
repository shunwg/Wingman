import type { CityKey, PersonId, TripId } from './ids';
import type { FlightSegment, Layover } from './flight';
import type { DateRange, ISODateTime } from './time';
import type { IntentProfile, MeetKind } from './intent';

/**
 * Time on the ground in a city, between arriving and leaving again.
 *
 * Separate from the flights because the interesting social window is usually
 * the stay, not the flight — "I'm in Singapore Tuesday to Friday" is the claim
 * most meets are built on.
 */
export interface StayWindow {
  cityKey: CityKey;
  dates: DateRange;
  arriveUtc: ISODateTime;
  departUtc: ISODateTime;
  /** Neighbourhood-level only. Wingman never stores a street address. */
  areaLabel?: string;
  /**
   * Roughly where you are headed once you land.
   *
   * This is what makes "share the ride in" answerable: two people landing at
   * Changi are only useful to each other if they are going the same way
   * afterwards, and the airport tells you nothing about that.
   *
   * Deliberately coarse, and the type is the enforcement. A street address
   * would make this a tracking database; a neighbourhood centroid answers
   * "are we going the same way" and nothing narrower. Anything precise enough
   * to find someone's door does not belong in this field.
   */
  destination?: { lat: number; lon: number; label: string };
}

/**
 * Per-trip overrides on top of the profile's standing privacy policy.
 *
 * The reason this exists: people are not equally open on every trip. A work
 * trip to a client city and a weekend away are different postures, and forcing
 * one global setting means everyone sets it to the most cautious value and the
 * product stops working.
 */
export interface TripVisibility {
  /** `hidden` removes the trip from matching entirely, without deleting it. */
  listing: 'listed' | 'hidden';
  /** Narrow the standing openTo set for this trip only. Undefined = inherit. */
  openTo?: MeetKind[];
  /** Restrict this trip to specific circles, e.g. an alumni-only conference. */
  onlyCircleIds?: string[];
  /** Override the standing discoverability surfaces for this trip only. */
  discoverability?: Partial<{
    onFlight: boolean;
    inTerminal: boolean;
    inCity: boolean;
  }>;
}

/**
 * How a trip ended, socially.
 *
 * Its presence is what closes a trip — there is no separate `status` field that
 * could disagree with it. Once you have arranged to meet someone for a journey,
 * that journey stops producing suggestions: you found who you were looking for,
 * and a board that keeps offering alternatives is quietly asking you to trade
 * up on a person you already said yes to.
 */
export interface TripOutcome {
  settledWith: PersonId;
  at: ISODateTime;
}

export interface Trip {
  id: TripId;
  personId: PersonId;
  label?: string;
  segments: FlightSegment[];
  /** Derived from segments at construction; stored so matching stays cheap. */
  layovers: Layover[];
  stays: StayWindow[];
  visibility: TripVisibility;
  /** Per-trip intent override. Undefined = inherit the profile's. */
  intent?: Partial<IntentProfile>;
  /** Absent means still open. Present means this trip is done looking. */
  outcome?: TripOutcome;
  createdAt: ISODateTime;
}

/** A trip still looking for someone: listed, and not already settled. */
export function tripIsOpen(t: Trip): boolean {
  return !t.outcome && t.visibility.listing === 'listed';
}

/**
 * The flight code a trip is known by — "SQ317", or a city when there is no
 * flight. Short enough for a chip, and the stable half of the label.
 */
export function tripCode(t: Trip): string {
  const first = t.segments[0];
  if (first) return first.flightNo;
  const stay = t.stays[0];
  return stay ? String(stay.cityKey).split('-')[0]!.toUpperCase() : 'TRIP';
}

/** Where the trip ends up — the last arrival airport, or the city stayed in. */
export function tripDestination(t: Trip): string | undefined {
  const last = t.segments.at(-1);
  if (last) return String(last.to);
  const stay = t.stays[0];
  if (!stay) return undefined;
  const city = String(stay.cityKey).split('-')[0]!;
  return city.charAt(0).toUpperCase() + city.slice(1);
}

/**
 * "SQ317 → SIN" — the label a suggestion is tagged with.
 *
 * The flight number alone identifies the journey but does not *describe* it: a
 * board tagged SQ317 / SK1465 / BA767 makes you remember which is which, and
 * remembering is exactly the work a label should be doing for you. The
 * destination is the half people actually think in — "the Singapore trip" — so
 * it earns the extra six characters.
 */
export function tripLabel(t: Trip): string {
  const code = tripCode(t);
  const to = tripDestination(t);
  return to && to !== code ? `${code} → ${to}` : code;
}

/** First departure across all segments — the trip's start instant. */
export function tripStart(t: Trip): ISODateTime | undefined {
  return t.segments.map((s) => s.departUtc).sort()[0];
}

/** Last arrival across all segments — the trip's end instant. */
export function tripEnd(t: Trip): ISODateTime | undefined {
  return t.segments.map((s) => s.arriveUtc).sort().at(-1);
}
