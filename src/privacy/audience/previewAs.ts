import type { ISODateTime, Person, PersonId, RedactedPerson } from '@domain/index';
import { redact, redactFully } from '../redact';
import { admitsViewer, disclosureLevelFor } from '../resolve';
import type { CompiledPolicy, PersonFacets, Relationship, SegmentFacets, ViewerSegment } from '../types';

/**
 * See yourself as someone else sees you.
 *
 * The guarantee that makes this worth building: **preview is not a mock.** It
 * runs the real policy through the real redactor and hands the result to the
 * same `PersonCard` the board uses. A preview built from a separate
 * "what-would-they-see" code path drifts from reality the first time someone
 * changes the ladder and forgets, and then it is worse than nothing — it is a
 * confident wrong answer about your own exposure.
 */

export interface ViewerPersona {
  id: string;
  label: string;
  facets: SegmentFacets;
}

export interface PreviewResult {
  persona: ViewerPersona;
  visible: boolean;
  view: RedactedPerson;
  /** Named reasons, when the persona cannot see you. */
  reasons: { ruleId: string; text: string }[];
}

/** A handful of personas worth checking yourself against, built from segments. */
export function personasFromSegments(segments: ViewerSegment[], limit = 6): ViewerPersona[] {
  return segments
    .filter((s) => s.facets.channel === 'app')
    .slice(0, limit)
    .map((s) => ({ id: s.id, label: s.label, facets: s.facets }));
}

function synth(f: SegmentFacets, ownCircleIds: string[]): PersonFacets {
  return {
    id: `preview:${f.gender}:${f.assurance}` as PersonId,
    gender: f.gender === '*' ? 'undisclosed' : f.gender,
    assurance: f.assurance === '*' ? 0 : f.assurance,
    stampKinds: f.stampKinds === '*' ? [] : f.stampKinds,
    circleIds: (f.circleIds === '*' ? ownCircleIds : f.circleIds) as PersonFacets['circleIds'],
    intents: f.intents === '*' ? ['social', 'professional'] : f.intents,
    blocked: [],
    proximity: f.proximity,
    channel: f.channel,
    onTrip: true,
  };
}

export function previewAs(
  me: Person,
  policy: CompiledPolicy,
  persona: ViewerPersona,
  opts: {
    now: ISODateTime;
    ownCircleIds: string[];
    /** Lets someone preview what an accepted match sees, not just a stranger. */
    relationship?: Relationship;
    onTrip?: boolean;
  },
): PreviewResult {
  const viewer = synth(persona.facets, opts.ownCircleIds);

  const subject: PersonFacets = {
    id: me.id,
    gender: me.gender,
    assurance: me.verifications
      .filter((v) => !v.revokedAt)
      .reduce<PersonFacets['assurance']>((max, v) => (v.assurance > max ? v.assurance : max), 0),
    stampKinds: me.verifications.filter((v) => !v.revokedAt).map((v) => v.kind),
    circleIds: opts.ownCircleIds as PersonFacets['circleIds'],
    intents: ['social', 'professional'],
    blocked: me.blocked,
    proximity: persona.facets.proximity,
    channel: 'app',
    onTrip: opts.onTrip ?? true,
  };

  const res = admitsViewer(policy, viewer, subject, opts.now);

  if (!res.visible) {
    return {
      persona,
      visible: false,
      view: redactFully(me),
      reasons: res.reasons.map((r) => ({ ruleId: r.ruleId, text: r.text })),
    };
  }

  const level = disclosureLevelFor(opts.relationship ?? 'stranger', { ...res, level: 3 });

  return {
    persona,
    visible: true,
    view: redact(me, level, { appliedRules: res.deniedBy }),
    reasons: [],
  };
}
