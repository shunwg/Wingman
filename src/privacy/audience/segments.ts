import type { AssuranceLevel, Gender, IntentAxis, ProximityClass, StampKind } from '@domain/index';
import { hashString } from '@lib/rng';
import type {
  CompiledPolicy,
  ReferencedFacet,
  SegmentFacets,
  ViewerChannel,
  ViewerSegment,
} from '../types';

/**
 * Bounding the audience lattice.
 *
 * "Who can see me right now" looks unanswerable — you cannot enumerate a global
 * population, and you certainly cannot evaluate a policy against every person
 * on earth.
 *
 * The move that makes it tractable: partition the potential-viewer population
 * by **only the facets the policy actually reads**. Everything the policy
 * ignores collapses to a single wildcard. A policy that mentions gender and
 * assurance produces sixteen rows, not sixteen million, and those rows are a
 * genuine partition — every possible viewer falls into exactly one.
 *
 * The result is exact rather than sampled. If a segment is blocked, *every*
 * person in it is blocked, because the policy provably cannot distinguish them.
 */

const GENDERS: Gender[] = ['woman', 'man', 'nonbinary', 'undisclosed'];
const ASSURANCES: AssuranceLevel[] = [0, 1, 2, 3];
const INTENT_SETS: IntentAxis[][] = [['social'], ['professional'], ['social', 'professional']];

/** Hard ceiling on rows, so the screen can never stall on a pathological policy. */
export const MAX_SEGMENTS = 64;

/** Facets dropped first when coarsening — least explanatory value to the user. */
const COARSEN_ORDER: ReferencedFacet[] = ['stampKinds', 'intents', 'circleIds', 'assurance', 'gender'];

export interface SegmentInput {
  policy: CompiledPolicy;
  /**
   * The proximity classes the user is actually in right now, derived from their
   * live trips. This is what makes the answer "right now" rather than "in
   * principle" — `same_flight` only appears while they are on that flight.
   */
  liveProximities: ProximityClass[];
  /** Circles the user belongs to — used to phrase the in/out-of-circle split. */
  ownCircleIds: string[];
  /** Stamp kinds the policy demands, if any. */
  requiredStampKinds: StampKind[];
  /** True when a guardian session is live — adds a non-app channel row. */
  hasActiveGuardian: boolean;
  /** True when the user is in at least one circle with admins. */
  hasCircleAdmins: boolean;
}

function labelFor(f: SegmentFacets, ownCircleNames: string): string {
  const parts: string[] = [];

  if (f.gender !== '*') {
    parts.push({ woman: 'Women', man: 'Men', nonbinary: 'Non-binary people', undisclosed: 'People who have not said' }[f.gender]);
  } else {
    parts.push('Anyone');
  }

  if (f.assurance !== '*') {
    parts.push(
      (['unverified', 'account-verified', 'institution-verified', 'ID-verified'] as const)[f.assurance],
    );
  }

  if (f.circleIds !== '*') {
    parts.push(f.circleIds.length > 0 ? `in ${ownCircleNames}` : 'outside your circles');
  }

  if (f.intents !== '*') {
    parts.push(f.intents.includes('professional') && f.intents.includes('social')
      ? 'open to either'
      : f.intents.includes('professional')
        ? 'here professionally'
        : 'here socially');
  }

  if (f.stampKinds !== '*') {
    parts.push(f.stampKinds.length > 0 ? 'with the stamp you require' : 'without it');
  }

  const where: Record<ProximityClass, string> = {
    same_flight: 'on your flight',
    same_terminal: 'in your terminal',
    same_airport: 'at your airport',
    same_city: 'in your city',
    same_dates: 'travelling the same days',
    none: 'not near you',
  };
  parts.push(where[f.proximity]);

  if (f.channel === 'guardian_link') return 'Your guardian, holding a live link';
  if (f.channel === 'circle_admin') return 'Circle administrators';

  return parts.join(' · ');
}

const segmentId = (f: SegmentFacets): string => `seg_${hashString(JSON.stringify(f)).toString(36)}`;

/**
 * Enumerate the segments for a policy.
 *
 * Coarsens by collapsing the least-explanatory facet to a wildcard if the
 * product would otherwise exceed `MAX_SEGMENTS`. Coarsening only ever *merges*
 * rows, so the partition stays complete — it never drops a population.
 */
export function segmentsFor(input: SegmentInput): { segments: ViewerSegment[]; coarsened: boolean } {
  // Audience-side facets only. My own `seeking` rule shapes my feed, not their
  // view of me, so partitioning on it would split provably identical rows.
  const referenced = new Set(input.policy.audienceFacets);
  let coarsened = false;

  // Proximity rows come from live trips; `none` is always present because
  // "people not near me" is a real and important row on the audience screen.
  const proximities: ProximityClass[] = [...new Set([...input.liveProximities, 'none' as const])];

  const sizeOf = (r: Set<ReferencedFacet>) =>
    (r.has('gender') ? GENDERS.length : 1) *
    (r.has('assurance') ? ASSURANCES.length : 1) *
    (r.has('intents') ? INTENT_SETS.length : 1) *
    (r.has('circleIds') ? 2 : 1) *
    (r.has('stampKinds') ? 2 : 1) *
    proximities.length;

  for (const facet of COARSEN_ORDER) {
    if (sizeOf(referenced) <= MAX_SEGMENTS) break;
    if (referenced.delete(facet)) coarsened = true;
  }

  const genders: (Gender | '*')[] = referenced.has('gender') ? GENDERS : ['*'];
  const assurances: (AssuranceLevel | '*')[] = referenced.has('assurance') ? ASSURANCES : ['*'];
  const intents: (IntentAxis[] | '*')[] = referenced.has('intents') ? INTENT_SETS : ['*'];
  const circles: (string[] | '*')[] = referenced.has('circleIds')
    ? [input.ownCircleIds, []]
    : ['*'];
  const stamps: (StampKind[] | '*')[] = referenced.has('stampKinds')
    ? [input.requiredStampKinds, []]
    : ['*'];

  const ownCircleNames = input.ownCircleIds.length === 1 ? 'your circle' : 'your circles';
  const segments: ViewerSegment[] = [];

  for (const gender of genders)
    for (const assurance of assurances)
      for (const intent of intents)
        for (const circleIds of circles)
          for (const stampKinds of stamps)
            for (const proximity of proximities) {
              const facets: SegmentFacets = {
                gender,
                assurance,
                stampKinds: stampKinds as SegmentFacets['stampKinds'],
                circleIds: circleIds as SegmentFacets['circleIds'],
                intents: intent as SegmentFacets['intents'],
                proximity,
                channel: 'app',
              };
              segments.push({
                id: segmentId(facets),
                label: labelFor(facets, ownCircleNames),
                facets,
                estimatedSize: 0, // filled by census.ts
              });
            }

  // Non-app channels. These are always listed, whatever the policy says,
  // because an answer to "who can see me" that omits the person holding a live
  // location link is not an answer.
  const channelRow = (channel: ViewerChannel): ViewerSegment => {
    const facets: SegmentFacets = {
      gender: '*',
      assurance: '*',
      stampKinds: '*',
      circleIds: '*',
      intents: '*',
      proximity: 'none',
      channel,
    };
    return { id: segmentId(facets), label: labelFor(facets, ownCircleNames), facets, estimatedSize: 1 };
  };

  if (input.hasActiveGuardian) segments.push(channelRow('guardian_link'));
  if (input.hasCircleAdmins) segments.push(channelRow('circle_admin'));

  return { segments, coarsened };
}
