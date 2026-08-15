import type { ProximityClass } from '@domain/index';
import type { TravelOverlap } from '../types';

/**
 * Translate a travel overlap into the proximity class the privacy engine reads.
 *
 * The two vocabularies are deliberately separate. Matching cares about the
 * shape of an itinerary overlap; privacy cares about which discoverability
 * surface someone is being found through. This is the one place they meet, so
 * neither has to know about the other's concerns.
 */

const CLASS_FOR: Record<TravelOverlap['kind'], ProximityClass> = {
  same_flight: 'same_flight',
  shared_layover: 'same_terminal',
  same_airport_window: 'same_airport',
  same_city_night: 'same_city',
  overlapping_stay: 'same_dates',
};

/** Rank from closest to loosest — the strongest overlap sets the class. */
const CLOSENESS: ProximityClass[] = [
  'same_flight',
  'same_terminal',
  'same_airport',
  'same_city',
  'same_dates',
  'none',
];

export function proximityForOverlap(o: TravelOverlap): ProximityClass {
  // A layover where the two are in different terminals is not "same terminal".
  if (o.kind === 'shared_layover' && !o.sameTerminal) return 'same_airport';
  return CLASS_FOR[o.kind];
}

/** The closest class across every overlap a pair shares. */
export function proximityFor(overlaps: TravelOverlap[]): ProximityClass {
  let best: ProximityClass = 'none';
  let bestRank = CLOSENESS.length;
  for (const o of overlaps) {
    const c = proximityForOverlap(o);
    const rank = CLOSENESS.indexOf(c);
    if (rank < bestRank) {
      bestRank = rank;
      best = c;
    }
  }
  return best;
}

/** Every distinct proximity class a trip currently puts someone in. */
export function proximityClasses(overlaps: TravelOverlap[]): ProximityClass[] {
  return [...new Set(overlaps.map(proximityForOverlap))];
}
