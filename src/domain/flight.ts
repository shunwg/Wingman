import type { IataCode, SegmentId } from './ids';
import type { ISODateTime, Minutes, TimeWindow } from './time';

/** Where a piece of flight data came from. Reaches the UI, which softens low confidence. */
export type DataSource =
  | 'aerodatabox'
  | 'aviationstack'
  | 'opensky'
  | 'bundled'
  | 'synthetic'
  | 'manual';

/**
 * One leg. Times are UTC instants; the local wall clock is rendered from the
 * airport's zone at display time and never stored.
 */
export interface FlightSegment {
  id: SegmentId;
  /** Marketing flight number, e.g. `SK4489`. */
  flightNo: string;
  carrier: string;
  from: IataCode;
  to: IataCode;
  departUtc: ISODateTime;
  arriveUtc: ISODateTime;
  terminalFrom?: string;
  terminalTo?: string;
  source: DataSource;
  /**
   * 0–1. Anything below ~0.6 is rendered in a softer treatment rather than in
   * confident monospace — the interface should not lie with typography about
   * a time it guessed.
   */
  confidence: number;
}

/**
 * The gap between two consecutive segments at one airport.
 *
 * `usableMin` is the number that matters and the reason this type exists.
 * Gross connection time is not meetable time: you lose it to disembarkation,
 * immigration if you clear it, re-screening if you leave airside, the walk if
 * the terminal changes, and boarding at the far end. A 90-minute layover with
 * a terminal change is not a coffee.
 */
export interface Layover {
  airport: IataCode;
  window: TimeWindow;
  grossMin: Minutes;
  usableMin: Minutes;
  /** False when the traveller must clear immigration or re-enter security. */
  bothAirside: boolean;
  sameTerminal: boolean;
  arrivingSegmentId: SegmentId;
  departingSegmentId: SegmentId;
}

export type FlightPhase = 'scheduled' | 'boarding' | 'departed' | 'airborne' | 'landed' | 'cancelled';

export interface LiveFlightStatus {
  segmentId: SegmentId;
  phase: FlightPhase;
  delayMin: Minutes;
  gate?: string;
  position?: { lat: number; lon: number; altitudeM: number };
  observedAt: ISODateTime;
  source: DataSource;
}
