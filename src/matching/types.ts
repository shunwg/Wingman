import type {
  AirportIndex,
  CityKey,
  DateRange,
  IataCode,
  ISODate,
  ISODateTime,
  IntentAxis,
  MeetKind,
  Minutes,
  Person,
  PersonId,
  RedactedPerson,
  SegmentId,
  TimeWindow,
  Trip,
} from '@domain/index';
import type { BucketedCount } from '@lib/bucket';

/**
 * How two itineraries touch.
 *
 * This is the spine of the product. Everything downstream — which meets are
 * possible, how a candidate is ranked, what the card says — is derived from the
 * shape of the overlap rather than from anything about the people.
 */
export type TravelOverlap =
  | {
      kind: 'same_flight';
      segmentId: SegmentId;
      theirSegmentId: SegmentId;
      flightNo: string;
      durationMin: Minutes;
    }
  | {
      kind: 'shared_layover';
      airport: IataCode;
      window: TimeWindow;
      bothAirside: boolean;
      sameTerminal: boolean;
      /** Gross minutes minus the buffers. The honest number. */
      usableMin: Minutes;
    }
  | {
      kind: 'same_airport_window';
      airport: IataCode;
      window: TimeWindow;
      usableMin: Minutes;
      /**
       * Carried here for the same reason as on a layover: two people at one
       * airport in different terminals are not two people who can have a
       * coffee. An earlier version omitted this and cheerfully proposed a meet
       * across Heathrow T5 and T2 with 85 minutes to spare.
       */
      sameTerminal: boolean;
      bothAirside: boolean;
    }
  | {
      kind: 'same_city_night';
      cityKey: CityKey;
      night: ISODate;
      bothLandedBy: ISODateTime;
    }
  | {
      kind: 'overlapping_stay';
      cityKey: CityKey;
      overlap: DateRange;
      days: number;
    };

export type OverlapKind = TravelOverlap['kind'];

export interface MatchConfig {
  /** Minutes lost to disembarkation before a layover is usable. */
  disembarkMin: Minutes;
  /** Extra loss when the traveller must clear immigration or re-screen. */
  landsideReentryMin: Minutes;
  /** Extra loss when the connection changes terminal. */
  terminalChangeMin: Minutes;
  /** Minutes before departure the traveller must be back at the gate. */
  boardingBufferMin: Minutes;
  /** A layover shorter than this is not a meet, whatever the kind. */
  minUsableMin: Minutes;
  /** Minimum flight length before an onboard meet is worth proposing. */
  minSameFlightMin: Minutes;
  /** Ideal duration per meet kind — feeds the temporal-slack signal. */
  idealMin: Record<MeetKind, Minutes>;
  weights: Record<SignalName, number>;
  /** How much a repeatedly-shown-and-ignored candidate is penalised. */
  fatiguePenalty: number;
  /** Maximum candidates returned. */
  limit: number;
}

export type SignalName =
  | 'overlapStrength'
  | 'temporalSlack'
  | 'intentAlignment'
  | 'topicalAffinity'
  | 'circleProximity'
  | 'reciprocityPrior'
  | 'fairness';

/** One person plus the trip that puts them near you. */
export interface PoolEntry {
  person: Person;
  trip: Trip;
  /** Circles this person belongs to, for scope and affinity. */
  circleIds?: string[];
  /** Their historical response rate, 0–1 — conduct, never desirability. */
  responseRate?: number;
}

export interface MatchInput {
  me: Person;
  myTrip: Trip;
  myCircleIds?: string[];
  pool: PoolEntry[];
  /** Injected. The engine never reads the clock. */
  now: ISODateTime;
  airports: AirportIndex;
  /** Injected, never imported inside an algorithm file. */
  config: MatchConfig;
  /** How often each candidate has been shown and ignored. */
  seenCounts?: Record<string, number>;
  /** Candidates with an open or refused request — filtered out. */
  requestHistory?: RequestHistory;
}

export interface RequestHistory {
  /** People with a live request in either direction. */
  active: PersonId[];
  /**
   * People who declined.
   *
   * A single list rather than a per-overlap map, deliberately. Someone who says
   * no to a coffee at the gate should not reappear the same evening under the
   * heading of dinner in town — re-asking in a different guise is not
   * persistence, it is the behaviour that makes people delete the app.
   *
   * Scope is the caller's decision: the state layer populates this from the
   * current trip, so a decline does not follow someone around forever.
   */
  denied: PersonId[];
}

export interface RouteReceiptLine {
  label: string;
  value: string;
  /** Rendered in mono when true — times, distances, money. */
  mono?: boolean;
}

/**
 * Why this person is here, in sentences.
 *
 * The user sees reasons; they never see the score. Handing someone a number
 * that grades a stranger is both unpleasant and misleading — it implies a
 * precision the model does not have.
 */
export interface RouteReceipt {
  headline: string;
  lines: RouteReceiptLine[];
  /** e.g. "You could get a coffee at the gate." */
  suggestion: string;
}

export interface Candidate {
  person: RedactedPerson;
  /** The strongest overlap — what the card leads with. */
  overlap: TravelOverlap;
  allOverlaps: TravelOverlap[];
  /** Kinds that survived geometry AND both people's openness. */
  proposableKinds: MeetKind[];
  intentFit: Record<IntentAxis, number>;
  /** ORDERING ONLY. Never rendered, never returned to the user. */
  score: number;
  signals: Record<SignalName, number>;
  receipt: RouteReceipt;
}

/**
 * Who was filtered out, and roughly why.
 *
 * Counts only, always bucketed, never identities — an exact "2 people hidden"
 * on a four-passenger flight identifies both of them.
 */
export interface SuppressionSummary {
  byPrivacy: BucketedCount;
  byIntent: BucketedCount;
  byCircle: BucketedCount;
  byAssurance: BucketedCount;
  byFeasibility: BucketedCount;
}

/** Powers the board's context strip. */
export interface TravelContextSummary {
  onYourFlight: number;
  inYourLayover: number;
  inYourCity: number;
  overlappingDates: number;
  /** e.g. "Singapore, Thursday night" */
  nextContextLabel?: string;
}

export interface MatchResult {
  candidates: Candidate[];
  suppressed: SuppressionSummary;
  context: TravelContextSummary;
}

export type Relaxation =
  | { kind: 'widen_days'; days: number }
  | { kind: 'allow_shorter_layovers'; minUsableMin: Minutes }
  | { kind: 'drop_circle_scope' }
  | { kind: 'broaden_meet_kinds' };

export interface RelaxationOutcome {
  relaxation: Relaxation;
  before: number;
  after: number;
  /** Honest sentence: "±2 days would put 4 more people in range." */
  label: string;
}
