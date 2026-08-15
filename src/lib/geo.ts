/**
 * Geodesy. Shared by the airport index and the matching engine, which is why it
 * lives in lib rather than in either of them — matching may not import from
 * data, and data must not import from matching.
 */

const EARTH_M = 6_371_000;
const rad = Math.PI / 180;

/** Great-circle distance in metres. */
export function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_M * Math.asin(Math.sqrt(s)));
}

export const haversineKm = (aLat: number, aLon: number, bLat: number, bLon: number): number =>
  haversineM(aLat, aLon, bLat, bLon) / 1000;

/**
 * Rough block time for a great-circle distance, in minutes.
 *
 * Used by the synthetic schedule generator so a demo anywhere in the world
 * produces plausible flight times without an API key. Cruise speed with a fixed
 * allowance for taxi, climb and descent.
 */
export function blockTimeMin(km: number): number {
  const CRUISE_KMH = 820;
  const GROUND_ALLOWANCE_MIN = 35;
  return Math.round((km / CRUISE_KMH) * 60 + GROUND_ALLOWANCE_MIN);
}
