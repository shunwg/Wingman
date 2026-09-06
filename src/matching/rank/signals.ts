import { tagAffinity, type MeetKind, type Person } from '@domain/index';
import { jitter } from '@lib/rng';
import type { MatchConfig, SignalName, TravelOverlap } from '../types';
import { clamp01, intentAlignment } from '../filters/intent';
import { estimateAcceptance } from './reciprocity';

/**
 * Ranking signals.
 *
 * Every signal is a pure `(context) => number` in [0,1]. They set **order
 * only**. The score is never rendered, never returned to the user, and never
 * exposed through the API — people see reasons, not a grade on a stranger.
 *
 * What is deliberately absent matters more than what is here. There is no
 * signal for appearance, none for gender, and none that reduces reputation to a
 * desirability number. `reciprocityPrior` is about *conduct* — does this person
 * answer, do they turn up — which is a fact about reliability, not about worth.
 *
 * A test asserts that permuting a candidate's avatar, gender or display name
 * leaves the score bit-identical. If someone adds an appearance-shaped signal
 * later, that test fails and this comment is why.
 */

export interface SignalContext {
  me: Person;
  them: Person;
  overlaps: TravelOverlap[];
  strongest: TravelOverlap;
  proposable: MeetKind[];
  myCircleIds: string[];
  theirCircleIds: string[];
  responseRate?: number;
  seenCount: number;
  config: MatchConfig;
  /** Stable per-day key so ordering is steady for a user within a day. */
  dayKey: string;
}

/**
 * How strong the shared travel is.
 *
 * A shared flight is unavoidable, bounded and long — the best possible excuse
 * to talk to someone. Overlapping dates in a large city is the weakest: you are
 * both merely present.
 */
export function overlapStrength(ctx: SignalContext): number {
  switch (ctx.strongest.kind) {
    case 'same_flight':
      return 1;
    case 'shared_layover':
      return ctx.strongest.sameTerminal ? 0.85 : 0.6;
    case 'same_airport_window':
      return 0.6;
    case 'same_city_night':
      return 0.5;
    case 'overlapping_stay':
      return 0.35;
  }
}

/**
 * Whether there is a comfortable amount of time — not too little, not too much.
 *
 * Both ends decay. Forty minutes for a meal is a scramble; six hours for a
 * coffee means you are not really constrained by each other at all and the
 * meet has no natural shape.
 */
export function temporalSlack(ctx: SignalContext): number {
  const usable = usableMinutesOf(ctx.strongest);
  if (usable === null) return 0.6; // a stay has no single duration to judge

  const ideals = ctx.proposable.map((k) => ctx.config.idealMin[k]);
  if (ideals.length === 0) return 0;
  const ideal = ideals.reduce((a, b) => a + b, 0) / ideals.length;

  const ratio = usable / ideal;
  if (ratio <= 0) return 0;
  // Peaks at parity, decays symmetrically in log space so 2x and 0.5x score alike.
  return clamp01(1 - Math.abs(Math.log2(ratio)) / 2.5);
}

function usableMinutesOf(o: TravelOverlap): number | null {
  switch (o.kind) {
    case 'same_flight':
      return o.durationMin;
    case 'shared_layover':
    case 'same_airport_window':
      return o.usableMin;
    default:
      return null;
  }
}

/** Do these two want the same kind of thing. */
export function intentSignal(ctx: SignalContext): number {
  return intentAlignment(ctx.me.intent, ctx.them.intent, ctx.proposable);
}

/**
 * Shared interests and languages — a reason to have something to say.
 *
 * The vocabulary carries the weight; free-text topics survive as an
 * exact-match bonus for anything the vocabulary does not cover. Reads
 * `intent.*` only: never gender, avatar, name or photo.
 */
export function interestAffinity(ctx: SignalContext): number {
  const langs = shareAny(ctx.me.intent.languages, ctx.them.intent.languages) ? 1 : 0;
  const tags = tagAffinity(ctx.me.intent.interests, ctx.them.intent.interests);
  const free = overlapRatio(ctx.me.intent.topics, ctx.them.intent.topics);
  return clamp01(langs * 0.35 + tags * 0.5 + free * 0.15);
}

/**
 * Two-sided fit: what I am seeking against what they offer, and the reverse.
 *
 * The harmonic mean is the point. A lookup is one-directional — "they have
 * what I want" — and a match is not: it has to work from both chairs, and a
 * pair that is perfect one way and hopeless the other should score low, not
 * average. This is the same mean the engine already uses for the stable pick.
 *
 * Either side with nothing to say — no seeking, no offering, or the liberal
 * switch on — is neutral (0.5), never zero. Reads `intent.*` only.
 */
export function mutualFit(ctx: SignalContext): number {
  const a = fitOneWay(ctx.me.intent, ctx.them.intent);
  const b = fitOneWay(ctx.them.intent, ctx.me.intent);
  return a + b > 0 ? (2 * a * b) / (a + b) : 0;
}

/**
 * How well `wants`'s seeking is met by `gives`'s offering; 0.5 when either is
 * silent. The liberal switch neutralises a person in *both* roles — not only
 * what they ask for, but how they are measured against the other's ask —
 * otherwise a specific request on the far side zeroes the harmonic mean and
 * the open person is buried, which is the one outcome this switch exists to
 * prevent.
 */
function fitOneWay(wants: Person['intent'], gives: Person['intent']): number {
  if (wants.openToAnyone || gives.openToAnyone) return 0.5;
  if (wants.seeking.length === 0 || gives.offering.length === 0) return 0.5;
  return tagAffinity(wants.seeking, gives.offering);
}

/**
 * Shared circles, capped.
 *
 * A shared school or employer is a genuine signal, but left uncapped it
 * dominates: every INSEAD alum's board becomes entirely INSEAD, which is
 * exactly the closed-loop dynamic that makes networks boring and, for the
 * people outside them, useless.
 */
export function circleProximity(ctx: SignalContext): number {
  if (ctx.myCircleIds.length === 0 || ctx.theirCircleIds.length === 0) return 0;
  return shareAny(ctx.myCircleIds, ctx.theirCircleIds) ? 1 : 0;
}

/**
 * Conduct, not desirability.
 *
 * Whether someone replies and turns up. Unproven people sit at a neutral 0.5
 * rather than at the bottom — a new user who is penalised for being new never
 * gets the meets that would prove them, and the network stops admitting anyone.
 */
export function reciprocityPrior(ctx: SignalContext): number {
  if (ctx.responseRate === undefined) return 0.5;
  return estimateAcceptance({ responseRate: ctx.responseRate, reputation: ctx.them.reputation });
}

/**
 * The window is the thing that expires.
 *
 * A ninety-minute layover is a now-or-never; a week in the same city is not.
 * Ranking the shorter window higher is what makes the board useful at the
 * gate, where the decision has to be made in the next ten minutes.
 */
export function scarcity(ctx: SignalContext): number {
  const o = ctx.strongest;
  switch (o.kind) {
    case 'same_flight':
      return 0.7;
    case 'shared_layover':
    case 'same_airport_window':
      return o.usableMin <= 90 ? 1 : o.usableMin <= 180 ? 0.85 : 0.7;
    case 'same_city_night':
      return 0.45;
    case 'overlapping_stay':
      return o.days <= 1 ? 0.5 : o.days <= 3 ? 0.35 : 0.2;
  }
}

/**
 * Adjacent, not identical.
 *
 * Two people who both want an introduction from *different* industries have
 * something to give each other; two who mirror each other have the same
 * conversation they could have at home. Only engages when both are open to
 * a professional meet; otherwise neutral.
 */
export function complementarity(ctx: SignalContext): number {
  const both = ctx.me.intent.appetite.professional >= 0.5 && ctx.them.intent.appetite.professional >= 0.5;
  if (!both) return 0.5;
  const mine = ctx.me.professional.industry.trim().toLowerCase();
  const theirs = ctx.them.professional.industry.trim().toLowerCase();
  if (!mine || !theirs) return 0.5;
  if (mine !== theirs) return 1;
  // The same industry still helps when they are looking for what you do.
  const wants = ctx.them.professional.lookingFor.join(' ').toLowerCase();
  const title = ctx.me.professional.title.trim().toLowerCase();
  return title && wants.includes(title) ? 0.8 : 0.4;
}

/**
 * Cohort: how much of *your* world they share, under the circle cap.
 *
 * One shared circle is proximity; two or three is a cohort — the same school
 * and the same conference — and that is a stronger reason than either alone.
 * Weighted low on purpose so a big circle cannot flood the board.
 */
export function cohort(ctx: SignalContext): number {
  if (ctx.myCircleIds.length === 0) return 0;
  const theirs = new Set(ctx.theirCircleIds);
  const shared = ctx.myCircleIds.filter((c) => theirs.has(c)).length;
  return clamp01(shared / Math.min(ctx.myCircleIds.length, 3));
}

/**
 * Fairness: seeded jitter minus a fatigue penalty.
 *
 * Two jobs. It stops the same handful of people topping every board forever,
 * and it stops the ordering being a stable oracle — if order were perfectly
 * deterministic on inputs, watching it shift would tell you that somebody
 * changed a privacy setting. Seeded on (viewer, candidate, day) so it is stable
 * within a day and reproducible in a test.
 */
export function fairness(ctx: SignalContext): number {
  const base = jitter(ctx.me.id, ctx.them.id, ctx.dayKey);
  const fatigue = Math.min(ctx.seenCount, 8) * ctx.config.fatiguePenalty;
  return clamp01(base - fatigue);
}

export const SIGNALS: Record<SignalName, (ctx: SignalContext) => number> = {
  overlapStrength,
  temporalSlack,
  intentAlignment: intentSignal,
  interestAffinity,
  mutualFit,
  circleProximity,
  cohort,
  reciprocityPrior,
  scarcity,
  complementarity,
  fairness,
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

function shareAny(a: readonly string[], b: readonly string[]): boolean {
  const set = new Set(a);
  return b.some((x) => set.has(x));
}

function overlapRatio(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a.map((s) => s.toLowerCase()));
  const hits = b.filter((x) => set.has(x.toLowerCase())).length;
  return clamp01(hits / Math.min(a.length, b.length));
}
