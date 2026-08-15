import type { AssuranceLevel, Gender, IntentAxis, ProximityClass } from '@domain/index';
import type { SegmentFacets, ViewerSegment } from '../types';

/**
 * Population estimates for audience segments.
 *
 * These are *priors*, not measurements. In a client-only build there is no
 * server to ask how many ID-verified women are in your terminal, so the numbers
 * come from a base population scaled by independent facet fractions.
 *
 * Two rules follow from them being estimates, and both are enforced downstream:
 * the UI always says "about", and every figure passes through `lib/bucket.ts`
 * before it is rendered. An estimate presented as a precise count is a lie, and
 * a small precise count next to a facet tuple is a deanonymisation.
 *
 * When this becomes a real service, this file is the only thing that changes.
 */

/** Rough active-traveller population reachable through the app at all. */
const BASE_POPULATION = 12_000;

/** How many of that population are in each proximity class at a given moment. */
const PROXIMITY_FRACTION: Record<ProximityClass, number> = {
  same_flight: 0.0015,
  same_terminal: 0.006,
  same_airport: 0.012,
  same_city: 0.05,
  same_dates: 0.11,
  none: 1,
};

const GENDER_FRACTION: Record<Gender, number> = {
  woman: 0.44,
  man: 0.5,
  nonbinary: 0.02,
  undisclosed: 0.04,
};

/** Share of people who have reached *at least* each assurance level. */
const ASSURANCE_AT_LEAST: Record<AssuranceLevel, number> = {
  0: 1,
  1: 0.72,
  2: 0.38,
  3: 0.21,
};

/** Share at exactly a level — the difference between adjacent cumulative shares. */
function assuranceExactly(level: AssuranceLevel): number {
  const next = (level + 1) as AssuranceLevel;
  const above = ASSURANCE_AT_LEAST[next] ?? 0;
  return Math.max(0, ASSURANCE_AT_LEAST[level] - above);
}

const INTENT_FRACTION = (intents: IntentAxis[]): number => {
  const social = intents.includes('social');
  const professional = intents.includes('professional');
  if (social && professional) return 0.34;
  if (professional) return 0.28;
  return 0.38;
};

/** Share of the population sharing at least one circle with you. */
const CIRCLE_FRACTION = 0.03;

/** Share carrying a specific required stamp kind. */
const STAMP_FRACTION = 0.3;

export function estimateSize(f: SegmentFacets): number {
  // Non-app channels are individuals, not populations.
  if (f.channel !== 'app') return 1;

  let n = BASE_POPULATION * PROXIMITY_FRACTION[f.proximity];

  if (f.gender !== '*') n *= GENDER_FRACTION[f.gender];
  if (f.assurance !== '*') n *= assuranceExactly(f.assurance);
  if (f.intents !== '*') n *= INTENT_FRACTION(f.intents);
  if (f.circleIds !== '*') n *= f.circleIds.length > 0 ? CIRCLE_FRACTION : 1 - CIRCLE_FRACTION;
  if (f.stampKinds !== '*') n *= f.stampKinds.length > 0 ? STAMP_FRACTION : 1 - STAMP_FRACTION;

  return Math.round(n);
}

/** Fill in `estimatedSize` across a segment list. */
export function withEstimates(segments: ViewerSegment[]): ViewerSegment[] {
  return segments.map((s) =>
    s.facets.channel === 'app' ? { ...s, estimatedSize: estimateSize(s.facets) } : s,
  );
}

export const basePopulation = (): number => BASE_POPULATION;
