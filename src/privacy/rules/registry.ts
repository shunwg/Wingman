import type { PolicyRule } from '../types';

/**
 * The rule registry.
 *
 * Ordered, and the order is meaningful: cheap and absolute rules come first so
 * a block short-circuits before any circle arithmetic runs.
 *
 * Resolution: `deny` wins outright, `abstain` falls through, and a rule set
 * that never denies allows. Every verdict carries the id of the rule that
 * closed the door, which is what makes the audience screen able to name a
 * reason per segment — and the empty state able to be honest about why it is
 * empty — without a single hand-written conditional in the UI.
 *
 * Adding a privacy rule is: write it here, add its copy in
 * data/copy/privacy.ts, and add its id to PolicyRuleId. No UI changes.
 */

const both = (id: PolicyRule['id'], side: PolicyRule['side']) => ({ id, side });

/** Blocks are absolute and run first, in both directions. */
const blockEither: PolicyRule = {
  ...both('block.either', 'audience'),
  copyKey: 'block.either',
  evaluate: (viewer, subject) =>
    subject.blocked.includes(viewer.id) || viewer.blocked.includes(subject.id) ? 'deny' : 'abstain',
};

/** The women-only rule, audience half: may this viewer see me. */
const genderAudience: PolicyRule = {
  ...both('gender.audience', 'audience'),
  copyKey: 'gender.audience',
  evaluate: (viewer, _subject, ctx) => {
    const allowed = ctx.rule.genders;
    if (allowed === 'any') return 'abstain';
    return allowed.includes(viewer.gender) ? 'abstain' : 'deny';
  },
};

/** The women-only rule, seeking half: do I want this person in my feed. */
const genderSeeking: PolicyRule = {
  ...both('gender.seeking', 'seeking'),
  copyKey: 'gender.seeking',
  evaluate: (_viewer, subject, ctx) => {
    const wanted = ctx.rule.genders;
    if (wanted === 'any') return 'abstain';
    return wanted.includes(subject.gender) ? 'abstain' : 'deny';
  },
};

/** Minimum proof the viewer must have before they can see me at all. */
const assuranceFloor: PolicyRule = {
  ...both('assurance.floor', 'audience'),
  copyKey: 'assurance.floor',
  evaluate: (viewer, _subject, ctx) =>
    viewer.assurance >= ctx.rule.minAssurance ? 'abstain' : 'deny',
};

/** The mirror: minimum proof I require of people in my own feed. */
const assuranceSeeking: PolicyRule = {
  ...both('assurance.seeking', 'seeking'),
  copyKey: 'assurance.seeking',
  evaluate: (_viewer, subject, ctx) =>
    subject.assurance >= ctx.rule.minAssurance ? 'abstain' : 'deny',
};

/** Specific stamps, e.g. "only people who verified a work email". */
const stampRequired: PolicyRule = {
  ...both('stamp.required', 'audience'),
  copyKey: 'stamp.required',
  evaluate: (viewer, _subject, ctx) => {
    const required = ctx.rule.requiredStampKinds;
    if (required.length === 0) return 'abstain';
    return required.every((k) => viewer.stampKinds.includes(k)) ? 'abstain' : 'deny';
  },
};

/** Closed loops — a school or employer pool. */
const circleScope: PolicyRule = {
  ...both('circle.scope', 'audience'),
  copyKey: 'circle.scope',
  evaluate: (viewer, _subject, ctx) => {
    const c = ctx.rule.circles;
    if (c === 'any') return 'abstain';
    if (c.onlyCircles.length === 0) return 'abstain';
    return c.onlyCircles.some((id) => viewer.circleIds.includes(id)) ? 'abstain' : 'deny';
  },
};

/** Intent axes — a professional-only person does not appear to purely social ones. */
const intentAxis: PolicyRule = {
  ...both('intent.axis', 'audience'),
  copyKey: 'intent.axis',
  evaluate: (viewer, _subject, ctx) => {
    const wanted = ctx.rule.intents;
    if (wanted === 'any') return 'abstain';
    return wanted.some((i) => viewer.intents.includes(i)) ? 'abstain' : 'deny';
  },
};

/**
 * Which surfaces you exist on.
 *
 * A guardian holding a live token and a circle admin bypass the surface rules
 * deliberately — they are not browsing, they hold a granted capability, and
 * pretending otherwise would make the audience report understate exposure.
 */
const proximitySurface: PolicyRule = {
  ...both('proximity.surface', 'audience'),
  copyKey: 'proximity.surface',
  evaluate: (viewer, _subject, ctx) => {
    if (viewer.channel !== 'app') return 'abstain';
    const d = ctx.policy.source.discoverability;
    switch (viewer.proximity) {
      case 'same_flight':
        return d.onFlight ? 'abstain' : 'deny';
      case 'same_terminal':
      case 'same_airport':
        return d.inTerminal ? 'abstain' : 'deny';
      case 'same_city':
      case 'same_dates':
        return d.inCity ? 'abstain' : 'deny';
      case 'none':
        return d.offTrip ? 'abstain' : 'deny';
    }
  },
};

/** Off a trip, you are not on this app — unless you opted into being. */
const offTrip: PolicyRule = {
  ...both('trip.offTrip', 'audience'),
  copyKey: 'trip.offTrip',
  evaluate: (viewer, subject, ctx) => {
    if (viewer.channel !== 'app') return 'abstain';
    if (subject.onTrip) return 'abstain';
    return ctx.policy.source.discoverability.offTrip ? 'abstain' : 'deny';
  },
};

/**
 * Order matters. Blocks first (absolute, cheapest), then the identity rules,
 * then the set-membership rules, then the surface rules last — because the
 * surface answer is the least interesting reason to be told you are invisible.
 */
export const AUDIENCE_RULES: PolicyRule[] = [
  blockEither,
  genderAudience,
  assuranceFloor,
  stampRequired,
  circleScope,
  intentAxis,
  offTrip,
  proximitySurface,
];

export const SEEKING_RULES: PolicyRule[] = [genderSeeking, assuranceSeeking];

export const ALL_RULES: PolicyRule[] = [...AUDIENCE_RULES, ...SEEKING_RULES];
