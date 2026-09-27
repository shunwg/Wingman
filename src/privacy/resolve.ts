import type { DisclosureLevel, PolicyReason, PolicyRuleId } from '@domain/index';
import { invariant } from '@lib/invariant';
import { AUDIENCE_RULES, RIDE_AUDIENCE_RULES, SEEKING_RULES } from './rules/registry';
import { policyCopy } from './copy';
import type {
  CompiledPolicy,
  MutualVerdict,
  PersonFacets,
  PolicySubject,
  Relationship,
  RuleContext,
  VisibilityContext,
  VisibilityVerdict,
} from './types';

/**
 * Visibility resolution.
 *
 * The whole privacy model reduces to two functions and two invariants.
 */

interface RunResult {
  denied: PolicyRuleId[];
  reasons: PolicyReason[];
  levelCap: DisclosureLevel;
}

/**
 * Engine-internal, and deliberately not re-exported from `index.ts`: a caller
 * outside `privacy/` that could pick its own rule list could quietly evaluate a
 * subset and call the answer a visibility verdict. `ride/audience.ts` uses it
 * because it *is* inside the engine and does exactly that on purpose, with the
 * subset named and justified in the registry.
 */
export function runRules(
  rules: typeof AUDIENCE_RULES,
  viewer: PersonFacets,
  subject: PersonFacets,
  ctx: RuleContext,
  side: 'yours' | 'theirs',
): RunResult {
  const denied: PolicyRuleId[] = [];
  const reasons: PolicyReason[] = [];
  let levelCap: DisclosureLevel = 3;

  for (const rule of rules) {
    const outcome = rule.evaluate(viewer, subject, ctx);
    if (outcome === 'deny') {
      denied.push(rule.id);
      reasons.push({ ruleId: rule.id, side, text: policyCopy(rule.copyKey, side) });
      // No short-circuit: collecting every reason is what lets the audience
      // screen say "blocked by two of your rules" instead of only the first.
    } else if (outcome === 'allow' && rule.levelCap !== undefined) {
      levelCap = Math.min(levelCap, rule.levelCap) as DisclosureLevel;
    }
  }

  return { denied, reasons, levelCap };
}

/**
 * Can `viewer` see `subject`?
 *
 * One direction, two questions, and both must pass:
 *
 *   admits(subject.audience, viewer.facets)  — does their policy let me in?
 *   wants(viewer.seeking, subject.facets)    — does my own policy want them?
 *
 * Keeping these separate is the point. Conflating them is what produces the
 * women-only bug where someone is invisible to men but still has men in her
 * feed.
 */
export function canSee(
  viewer: PolicySubject,
  subject: PolicySubject,
  ctx: VisibilityContext,
): VisibilityVerdict {
  const audienceCtx: RuleContext = {
    rule: subject.policy.audience,
    policy: subject.policy,
    now: ctx.now,
  };
  const seekingCtx: RuleContext = {
    rule: viewer.policy.seeking,
    policy: viewer.policy,
    now: ctx.now,
  };

  // "theirs" — the subject's own audience rules kept the viewer out.
  const admits = runRules(AUDIENCE_RULES, viewer.facets, subject.facets, audienceCtx, 'theirs');
  // "yours" — the viewer's own seeking rules filtered the subject away.
  const wants = runRules(SEEKING_RULES, viewer.facets, subject.facets, seekingCtx, 'yours');

  const deniedBy = [...admits.denied, ...wants.denied];
  const visible = deniedBy.length === 0;
  const cap = Math.min(admits.levelCap, wants.levelCap) as DisclosureLevel;

  return {
    visible,
    level: visible ? Math.min(levelForRelationship(ctx.relationship ?? 'stranger'), cap) as DisclosureLevel : 0,
    deniedBy,
    reasons: [...admits.reasons, ...wants.reasons],
  };
}

/**
 * Resolve both directions at once.
 *
 * Two invariants hold here, and they are asserted rather than trusted:
 *
 *  1. `mutual === aSeesB.visible && bSeesA.visible`. Visibility is not a
 *     relation one party can establish alone.
 *
 *  2. `level === min(aSeesB.level, bSeesA.level)`. Without this you get the
 *     classic leak: a permissive person's view of a restrictive person drags
 *     the restrictive person's own disclosure up a rung, so the cautious user
 *     is punished for the other party's openness. **Never show A more of B
 *     than B is currently showing A.**
 */
export function resolveMutual(
  a: PolicySubject,
  b: PolicySubject,
  ctx: VisibilityContext,
): MutualVerdict {
  const aSeesB = canSee(a, b, ctx);
  const bSeesA = canSee(b, a, ctx);

  const mutual = aSeesB.visible && bSeesA.visible;
  const level = Math.min(aSeesB.level, bSeesA.level) as DisclosureLevel;

  invariant(
    mutual === (aSeesB.visible && bSeesA.visible),
    'mutual visibility must be the conjunction of both directions',
  );
  invariant(
    level === Math.min(aSeesB.level, bSeesA.level),
    'mutual disclosure level must be the minimum of both directions',
  );

  return { aSeesB, bSeesA, mutual, level };
}

/** How far up the ladder a relationship can reach, before policy caps it. */
export function levelForRelationship(rel: Relationship): DisclosureLevel {
  switch (rel) {
    case 'stranger':
      return 0;
    case 'requested':
      return 1;
    case 'accepted':
      return 2;
    case 'meeting':
      return 3;
  }
}

/**
 * The rung a viewer actually gets: the relationship's ceiling, lowered by any
 * policy cap, and floored at 0 when they cannot see the person at all.
 */
export function disclosureLevelFor(rel: Relationship, verdict: VisibilityVerdict): DisclosureLevel {
  if (!verdict.visible) return 0;
  return Math.min(levelForRelationship(rel), verdict.level) as DisclosureLevel;
}

/** Convenience for the common "is this person in my feed at all" question. */
export function admitsViewer(
  subjectPolicy: CompiledPolicy,
  viewerFacets: PersonFacets,
  subjectFacets: PersonFacets,
  now: VisibilityContext['now'],
): { visible: boolean; deniedBy: PolicyRuleId[]; reasons: PolicyReason[] } {
  const res = runRules(
    AUDIENCE_RULES,
    viewerFacets,
    subjectFacets,
    { rule: subjectPolicy.audience, policy: subjectPolicy, now },
    'theirs',
  );
  return { visible: res.denied.length === 0, deniedBy: res.denied, reasons: res.reasons };
}

/**
 * May this viewer see this person in a list they opted into — a circle's
 * members, an event's board?
 *
 * The opt-in (`show_badge`) answers the surface question: they chose to be
 * listed there, so the proximity and off-trip rules have nothing to add. What
 * it does not answer is *who* may see them. A block either way, "women only",
 * "verified only", "my circles only" and the intent axis still hold — the
 * same rule objects a car's door uses, so the member list, the event board,
 * a car and the board cannot drift apart. The lists used to ask none of
 * them: a verified-only member was listed to an unverified stranger, and a
 * person you hid stayed on the event you were both at.
 */
export function admitsListing(
  subjectPolicy: CompiledPolicy,
  viewerFacets: PersonFacets,
  subjectFacets: PersonFacets,
  now: VisibilityContext['now'],
): boolean {
  const res = runRules(
    RIDE_AUDIENCE_RULES,
    viewerFacets,
    subjectFacets,
    { rule: subjectPolicy.audience, policy: subjectPolicy, now },
    'theirs',
  );
  return res.denied.length === 0;
}
