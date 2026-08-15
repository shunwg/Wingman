import type { AirportIndex, ISODate, Trip } from '@domain/index';
import { intersectDates, intersectWindows, localDate, minutesBetween, windowLengthMin } from '@domain/time';
import type { MatchConfig, TravelOverlap } from '../types';
import { airportPresences, inSameTerminal, orderedSegments } from './layover';

/**
 * Classify how two itineraries touch.
 *
 * Five shapes, checked strongest first. A pair can produce several — two people
 * on the same flight to Singapore who are both then in the city for three days
 * have a `same_flight`, a `same_city_night` and an `overlapping_stay`. The card
 * leads with the strongest and the rest become supporting detail.
 */

/** Ordered strongest first — used to pick what the card leads with. */
export const OVERLAP_RANK: Record<TravelOverlap['kind'], number> = {
  same_flight: 5,
  shared_layover: 4,
  same_airport_window: 3,
  same_city_night: 2,
  overlapping_stay: 1,
};

export function strongest(overlaps: TravelOverlap[]): TravelOverlap | undefined {
  return [...overlaps].sort((a, b) => OVERLAP_RANK[b.kind] - OVERLAP_RANK[a.kind])[0];
}

export function classifyOverlap(
  a: Trip,
  b: Trip,
  airports: AirportIndex,
  config: MatchConfig,
): TravelOverlap[] {
  const out: TravelOverlap[] = [];

  /* ── 1. Same flight ─────────────────────────────────────────────────────
     The strongest signal there is: a shared, bounded, unavoidable few hours. */
  for (const sa of orderedSegments(a)) {
    for (const sb of orderedSegments(b)) {
      if (sa.flightNo !== sb.flightNo) continue;
      if (sa.from !== sb.from || sa.to !== sb.to) continue;
      if (sa.departUtc !== sb.departUtc) continue;

      const durationMin = minutesBetween(sa.departUtc, sa.arriveUtc);
      if (durationMin < config.minSameFlightMin) continue; // a short hop is not an occasion

      out.push({
        kind: 'same_flight',
        segmentId: sa.id,
        theirSegmentId: sb.id,
        flightNo: sa.flightNo,
        durationMin,
      });
    }
  }

  /* ── 2 & 3. Shared time at an airport ───────────────────────────────────
     Two layovers meeting is the classic case; an arrival meeting a departure
     is the shared-transfer case this product started as. */
  const pa = airportPresences(a, config);
  const pb = airportPresences(b, config);

  for (const x of pa) {
    for (const y of pb) {
      if (x.airport !== y.airport) continue;
      if (!x.usableWindow || !y.usableWindow) continue;

      // Each side's window has already been shrunk by its own buffers, so the
      // shared time is simply where the two usable windows meet. Applying the
      // buffers again here would charge them twice.
      const window = intersectWindows(x.usableWindow, y.usableWindow);
      if (!window) continue;

      const usableMin = windowLengthMin(window);
      if (usableMin < config.minUsableMin) continue;

      // Two questions, not one: are they each staying put, and are they in the
      // same place as each other. Only the second decides whether a meet is
      // physically possible between *them*.
      const sameTerminal = x.sameTerminal && y.sameTerminal && inSameTerminal(x, y);
      const bothAirside = x.bothAirside && y.bothAirside;

      if (x.kind === 'layover' && y.kind === 'layover') {
        out.push({
          kind: 'shared_layover',
          airport: x.airport,
          window,
          bothAirside,
          sameTerminal,
          usableMin,
        });
      } else {
        out.push({
          kind: 'same_airport_window',
          airport: x.airport,
          window,
          usableMin,
          sameTerminal,
          bothAirside,
        });
      }
    }
  }

  /* ── 4 & 5. Time in the same city ───────────────────────────────────────
     Grouped by city rather than airport, because "we are both in London on
     Thursday" has to be true across Heathrow, Gatwick, City and Stansted. */
  for (const sa of a.stays) {
    for (const sb of b.stays) {
      if (sa.cityKey !== sb.cityKey) continue;

      const dates = intersectDates(sa.dates, sb.dates);
      if (!dates) continue;

      // A shared night: both have landed, and the local calendar date matches.
      const zone = airports.cityZone(sa.cityKey);
      const bothLandedBy = sa.arriveUtc > sb.arriveUtc ? sa.arriveUtc : sb.arriveUtc;
      const night: ISODate = zone ? localDate(bothLandedBy, zone) : dates.from;

      const stillBothPresent =
        bothLandedBy < sa.departUtc && bothLandedBy < sb.departUtc;

      if (stillBothPresent && night >= dates.from && night <= dates.to) {
        out.push({ kind: 'same_city_night', cityKey: sa.cityKey, night, bothLandedBy });
      }

      const days = daysInclusive(dates.from, dates.to);
      if (days >= 1) {
        out.push({ kind: 'overlapping_stay', cityKey: sa.cityKey, overlap: dates, days });
      }
    }
  }

  return out;
}

function daysInclusive(from: ISODate, to: ISODate): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}
