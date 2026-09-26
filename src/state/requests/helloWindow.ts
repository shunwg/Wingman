import type { FlightSegment, IataCode, MeetKind, TimeWindow } from '@domain/index';
import { addMinutes, epoch, type ISODateTime } from '@domain/time';
import type { TravelOverlap } from '@matching/index';

/**
 * What a hello is about: when, and at which airport.
 *
 * Every hello used to ask about "the next ninety minutes", whatever the
 * overlap. So "share the ride in" to someone on tonight's SQ317 asked about
 * the next hour and a half in London, for a taxi at Changi tomorrow — and any
 * time suggested inside that window was a London time for a Singapore car.
 *
 * The overlap already knows. Two people on one flight meet before boarding for
 * a coffee and after landing for a ride in; two people with an hour at the same
 * airport meet in that hour. Only when the overlap carries no time at all does
 * the old ninety minutes remain, and never a window that has already started.
 */

/** Kinds that happen after landing on a shared flight rather than before boarding. */
const AFTER_LANDING: ReadonlySet<MeetKind> = new Set<MeetKind>(['ride_share', 'meal', 'drinks']);

export interface HelloWindow {
  window: TimeWindow;
  /** The airport it happens at, when the overlap names one — a plan needs an anchor. */
  airport?: IataCode;
}

export function helloWindow(
  overlap: TravelOverlap,
  kind: MeetKind,
  mySegments: readonly FlightSegment[],
  now: ISODateTime,
): HelloWindow {
  const fallback: HelloWindow = { window: { from: now, to: addMinutes(now, 90) } };
  const fromNow = (w: TimeWindow): TimeWindow | null => {
    const from = epoch(w.from) > epoch(now) ? w.from : now;
    return epoch(w.to) > epoch(from) ? { from, to: w.to } : null;
  };

  switch (overlap.kind) {
    case 'same_flight': {
      const seg = mySegments.find((s) => String(s.id) === String(overlap.segmentId));
      if (!seg) return fallback;
      if (AFTER_LANDING.has(kind)) {
        const w = fromNow({ from: addMinutes(seg.arriveUtc, 30), to: addMinutes(seg.arriveUtc, 150) });
        return w ? { window: w, airport: seg.to } : fallback;
      }
      const w = fromNow({ from: addMinutes(seg.departUtc, -120), to: addMinutes(seg.departUtc, -30) });
      return w ? { window: w, airport: seg.from } : { ...fallback, airport: seg.from };
    }
    case 'shared_layover':
    case 'same_airport_window': {
      const w = fromNow(overlap.window);
      return w ? { window: w, airport: overlap.airport } : { ...fallback, airport: overlap.airport };
    }
    case 'same_city_night': {
      const w = fromNow({ from: overlap.bothLandedBy, to: addMinutes(overlap.bothLandedBy, 240) });
      return w ? { window: w } : fallback;
    }
    case 'overlapping_stay':
      return fallback;
  }
}
