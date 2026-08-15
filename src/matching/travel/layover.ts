import type { FlightSegment, IataCode, Layover, Minutes, TimeWindow, Trip } from '@domain/index';
import { addMinutes, epoch, minutesBetween } from '@domain/time';
import type { MatchConfig } from '../types';

/**
 * Layovers, and the difference between gross and usable time.
 *
 * A 90-minute connection is not 90 minutes of company. You lose time getting
 * off the aircraft, more if the terminal changes, a great deal more if you have
 * to clear immigration and come back through security, and you have to be back
 * at the gate before boarding closes.
 *
 * Getting this wrong is not a rounding error — it is the difference between an
 * app that suggests a coffee and an app that makes someone miss a flight. Once.
 * After that they delete it. So the buffers are pessimistic and `usableMin` is
 * the only number the rest of the engine is allowed to reason about.
 */

/** Segments in itinerary order. */
export function orderedSegments(trip: Trip): FlightSegment[] {
  return [...trip.segments].sort((a, b) => epoch(a.departUtc) - epoch(b.departUtc));
}

/**
 * Whether a connection stays airside.
 *
 * Approximated from the terminal change, and deliberately conservative: if we
 * cannot tell, we assume the traveller has to re-enter. Overstating available
 * time is the expensive direction of this error, so the model errs toward
 * proposing fewer meets rather than impossible ones.
 */
function staysAirside(arriving: FlightSegment, departing: FlightSegment): boolean {
  if (!arriving.terminalTo || !departing.terminalFrom) return false;
  return arriving.terminalTo === departing.terminalFrom;
}

export function usableMinutes(
  grossMin: Minutes,
  opts: { sameTerminal: boolean; bothAirside: boolean },
  config: MatchConfig,
): Minutes {
  let usable = grossMin - config.disembarkMin - config.boardingBufferMin;
  if (!opts.sameTerminal) usable -= config.terminalChangeMin;
  if (!opts.bothAirside) usable -= config.landsideReentryMin;
  return Math.max(0, Math.round(usable));
}

/** Derive every layover on a trip. */
export function layoversFor(trip: Trip, config: MatchConfig): Layover[] {
  const segs = orderedSegments(trip);
  const out: Layover[] = [];

  for (let i = 0; i < segs.length - 1; i++) {
    const arriving = segs[i]!;
    const departing = segs[i + 1]!;
    if (arriving.to !== departing.from) continue; // an open jaw, not a layover

    const grossMin = minutesBetween(arriving.arriveUtc, departing.departUtc);
    if (grossMin <= 0) continue;

    const sameTerminal = staysAirside(arriving, departing);
    const bothAirside = sameTerminal;

    out.push({
      airport: arriving.to,
      window: { from: arriving.arriveUtc, to: departing.departUtc },
      grossMin,
      usableMin: usableMinutes(grossMin, { sameTerminal, bothAirside }, config),
      bothAirside,
      sameTerminal,
      arrivingSegmentId: arriving.id,
      departingSegmentId: departing.id,
    });
  }

  return out;
}

/** Where someone physically is, and when — the basis for airport overlaps. */
export interface AirportPresence {
  airport: IataCode;
  /** Raw clock presence, gate to gate. */
  window: TimeWindow;
  /**
   * The part of that window actually available to a human being.
   *
   * The buffers are applied **here**, once, by shrinking the window from each
   * end: the front by disembarkation, the back by boarding, plus terminal
   * transit and re-entry where they apply. Two presences are then intersected
   * directly, which is both geometrically correct and avoids the bug of
   * charging the same buffers twice — once per person and again on the overlap.
   */
  usableWindow: TimeWindow | null;
  kind: 'layover' | 'arrival' | 'departure';
  usableMin: Minutes;
  sameTerminal: boolean;
  bothAirside: boolean;
}

/** How long before departure someone is plausibly at the airport. */
const PRE_DEPARTURE_MIN = 120;
/** How long after landing someone is plausibly still there. */
const POST_ARRIVAL_MIN = 75;

/**
 * Every window in which a traveller is at an airport.
 *
 * Includes the two ends of the trip, not just the connections — the original
 * shape of this product was two strangers landing at Oslo within half an hour
 * of each other, and that is an `arrival` presence overlapping a `departure`
 * presence, not a layover.
 */
/** Shrink a window from both ends; null when nothing survives. */
function shrink(w: TimeWindow, frontMin: Minutes, backMin: Minutes): TimeWindow | null {
  const from = addMinutes(w.from, frontMin);
  const to = addMinutes(w.to, -backMin);
  return epoch(to) > epoch(from) ? { from, to } : null;
}

export function airportPresences(trip: Trip, config: MatchConfig): AirportPresence[] {
  const segs = orderedSegments(trip);
  if (segs.length === 0) return [];

  const layovers = layoversFor(trip, config);
  const out: AirportPresence[] = layovers.map((l) => {
    const back =
      config.boardingBufferMin +
      (l.sameTerminal ? 0 : config.terminalChangeMin) +
      (l.bothAirside ? 0 : config.landsideReentryMin);
    const usableWindow = shrink(l.window, config.disembarkMin, back);
    return {
      airport: l.airport,
      window: l.window,
      usableWindow,
      kind: 'layover' as const,
      usableMin: l.usableMin,
      sameTerminal: l.sameTerminal,
      bothAirside: l.bothAirside,
    };
  });

  const layoverAirports = new Set(layovers.map((l) => l.airport));

  const first = segs[0]!;
  const last = segs[segs.length - 1]!;

  const depWindow = { from: addMinutes(first.departUtc, -PRE_DEPARTURE_MIN), to: first.departUtc };
  out.push({
    airport: first.from,
    window: depWindow,
    usableWindow: shrink(depWindow, 0, config.boardingBufferMin),
    kind: 'departure',
    usableMin: Math.max(0, PRE_DEPARTURE_MIN - config.boardingBufferMin),
    sameTerminal: true,
    bothAirside: true,
  });

  if (!layoverAirports.has(last.to)) {
    const arrWindow = { from: last.arriveUtc, to: addMinutes(last.arriveUtc, POST_ARRIVAL_MIN) };
    out.push({
      airport: last.to,
      window: arrWindow,
      // No onward flight to be late for, so only disembarkation is charged.
      usableWindow: shrink(arrWindow, config.disembarkMin, 0),
      kind: 'arrival',
      usableMin: Math.max(0, POST_ARRIVAL_MIN - config.disembarkMin),
      sameTerminal: true,
      bothAirside: true,
    });
  }

  return out;
}
