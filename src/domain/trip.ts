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
  createdAt: ISODateTime;
}

/** First departure across all segments — the trip's start instant. */
export function tripStart(t: Trip): ISODateTime | undefined {
  return t.segments.map((s) => s.departUtc).sort()[0];
}

/** Last arrival across all segments — the trip's end instant. */
export function tripEnd(t: Trip): ISODateTime | undefined {
  return t.segments.map((s) => s.arriveUtc).sort().at(-1);
}
