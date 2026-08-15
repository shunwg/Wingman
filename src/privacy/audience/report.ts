import type {
  AssuranceLevel,
  DisclosureLevel,
  Gender,
  IntentAxis,
  ISODateTime,
  Person,
  PersonId,
  ProximityClass,
  RedactedPerson,
  StampKind,
} from '@domain/index';
import { isRedacted } from '@domain/person';
import { FIELD_LABEL, type LadderField } from '../ladder';
import { redact } from '../redact';
import { admitsViewer, disclosureLevelFor } from '../resolve';
import type {
  AudienceReport,
  AudienceSegmentVerdict,
  CompiledPolicy,
  FieldExposure,
  LiveContext,
  PersonFacets,
  SegmentFacets,
  ViewerSegment,
} from '../types';
import { withEstimates } from './census';
import { segmentsFor, type SegmentInput } from './segments';

/**
 * "Who can see me right now."
 *
 * The flagship privacy screen, and the one that has to be *true* rather than
 * reassuring. Three properties make it trustworthy:
 *
 *  · It is exact, not sampled. Segments partition the population on precisely
 *    the facets the policy reads, so every person in a blocked segment really
 *    is blocked — the policy cannot tell them apart.
 *  · It reports per-field exposure by diffing the actual `redact()` output
 *    against the full profile, so it cannot drift from what a card really
 *    renders. There is no second table describing which field lives on which
 *    rung.
 *  · It counts non-app channels. A guardian holding a live location link is
 *    listed alongside everyone else.
 */

export interface AudienceInput {
  me: Person;
  policy: CompiledPolicy;
  now: ISODateTime;
  /** Proximity classes derived from live trips — makes it "right now". */
  liveProximities: ProximityClass[];
  liveContexts: LiveContext[];
  ownCircleIds: string[];
  hasActiveGuardian: boolean;
  hasCircleAdmins: boolean;
}

/**
 * A concrete viewer standing in for a whole segment.
 *
 * Wildcards get an arbitrary value, which is sound precisely because a wildcard
 * means the policy provably does not read that facet — any value produces the
 * same verdict.
 */
function synthesiseViewer(f: SegmentFacets, ownCircleIds: string[]): PersonFacets {
  return {
    id: `synthetic:${f.channel}` as PersonId,
    gender: (f.gender === '*' ? 'undisclosed' : f.gender) as Gender,
    assurance: (f.assurance === '*' ? 0 : f.assurance) as AssuranceLevel,
    stampKinds: (f.stampKinds === '*' ? [] : f.stampKinds) as StampKind[],
    circleIds: (f.circleIds === '*' ? ownCircleIds : f.circleIds) as PersonFacets['circleIds'],
    intents: (f.intents === '*' ? (['social', 'professional'] as IntentAxis[]) : f.intents),
    blocked: [],
    proximity: f.proximity,
    channel: f.channel,
    onTrip: true,
  };
}

/** My own facets, as a subject. */
function subjectFacets(me: Person, ownCircleIds: string[], onTrip: boolean): PersonFacets {
  const assurance = me.verifications
    .filter((v) => !v.revokedAt)
    .reduce<AssuranceLevel>((max, v) => (v.assurance > max ? v.assurance : max), 0);

  return {
    id: me.id,
    gender: me.gender,
    assurance,
    stampKinds: me.verifications.filter((v) => !v.revokedAt).map((v) => v.kind),
    circleIds: ownCircleIds as PersonFacets['circleIds'],
    intents: (Object.entries(me.intent.appetite) as [IntentAxis, number][])
      .filter(([, v]) => v > 0)
      .map(([k]) => k),
    blocked: me.blocked,
    proximity: 'none',
    channel: 'app',
    onTrip,
  };
}

/**
 * Which fields survive redaction at a level.
 *
 * Deliberately computed by running the real redactor and inspecting the result,
 * rather than by consulting the ladder table a second time. Two sources of
 * truth about field visibility would eventually disagree, and the one the user
 * is shown would be the wrong one.
 */
function visibleFieldsAt(me: Person, level: DisclosureLevel): LadderField[] {
  const view = redact(me, level);
  const out: LadderField[] = [];

  for (const key of Object.keys(FIELD_LABEL) as LadderField[]) {
    const v = (view as unknown as Record<string, unknown>)[key];
    if (v === undefined || v === null) continue;
    if (isRedacted(v)) continue;
    if (Array.isArray(v)) {
      // Links arrive as a mixed array; a fully-redacted list is not exposure.
      if (v.length === 0 || v.every((item) => isRedacted(item))) continue;
    }
    if (key === 'professional' && typeof v === 'object' && Object.keys(v).length === 0) continue;
    out.push(key);
  }
  return out;
}

export function whoCanSeeMe(input: AudienceInput): AudienceReport {
  const { me, policy, now, ownCircleIds } = input;

  const segInput: SegmentInput = {
    policy,
    liveProximities: input.liveProximities,
    ownCircleIds,
    requiredStampKinds: policy.audience.requiredStampKinds,
    hasActiveGuardian: input.hasActiveGuardian,
    hasCircleAdmins: input.hasCircleAdmins,
  };

  const { segments: raw, coarsened } = segmentsFor(segInput);
  const segments: ViewerSegment[] = withEstimates(raw);

  const onTrip = input.liveProximities.some((p) => p !== 'none');
  const subject = subjectFacets(me, ownCircleIds, onTrip);

  const verdicts: AudienceSegmentVerdict[] = segments.map((segment) => {
    const viewer = synthesiseViewer(segment.facets, ownCircleIds);

    // A guardian holding a live token, and a circle admin, are granted
    // capabilities rather than browsers — they are not subject to the
    // discoverability rules, and saying otherwise would understate exposure.
    const granted = segment.facets.channel !== 'app';

    const res = granted
      ? { visible: true, deniedBy: [], reasons: [] }
      : admitsViewer(policy, viewer, subject, now);

    // Everyone in an audience report is a stranger — this screen answers what
    // people who do not know you can see, which is the question that matters.
    const level = granted
      ? (1 as DisclosureLevel)
      : disclosureLevelFor('stranger', { ...res, level: 0 as DisclosureLevel });

    return {
      segment,
      visible: res.visible,
      level,
      visibleFields: res.visible ? (visibleFieldsAt(me, level) as (keyof RedactedPerson)[]) : [],
      deniedBy: res.deniedBy,
      reasons: res.reasons,
      estimatedSize: segment.estimatedSize,
    };
  });

  /* Per-field exposure, aggregated across every segment that can see it. */
  const fieldMap = new Map<LadderField, FieldExposure>();
  for (const v of verdicts) {
    if (!v.visible) continue;
    for (const field of v.visibleFields as LadderField[]) {
      const existing = fieldMap.get(field);
      if (existing) {
        existing.seenBy.push(v.segment.id);
        existing.estimatedReach += v.estimatedSize;
      } else {
        fieldMap.set(field, {
          field: field as keyof RedactedPerson,
          label: FIELD_LABEL[field],
          seenBy: [v.segment.id],
          estimatedReach: v.estimatedSize,
        });
      }
    }
  }

  const visibleTotal = verdicts
    .filter((v) => v.visible && v.segment.facets.proximity !== 'none')
    .reduce((sum, v) => sum + v.estimatedSize, 0);

  const populationTotal = segments
    .filter((s) => s.facets.channel === 'app' && s.facets.proximity !== 'none')
    .reduce((sum, s) => sum + s.estimatedSize, 0);

  return {
    generatedAt: now,
    visibleTotal,
    populationTotal,
    segments: verdicts,
    fields: [...fieldMap.values()].sort((a, b) => b.estimatedReach - a.estimatedReach),
    liveContexts: input.liveContexts,
    coarsened,
  };
}
