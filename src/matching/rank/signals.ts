import type { MeetKind, Person } from '@domain/index';
import { jitter } from '@lib/rng';
import type { MatchConfig, SignalName, TravelOverlap } from '../types';
import { clamp01, intentAlignment } from '../filters/intent';

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

/** Shared topics and languages — a reason to have something to say. */
export function topicalAffinity(ctx: SignalContext): number {
  const topics = overlapRatio(ctx.me.intent.topics, ctx.them.intent.topics);
  const langs = shareAny(ctx.me.intent.languages, ctx.them.intent.languages) ? 1 : 0;
  // A shared language is close to a precondition; shared topics are a bonus.
  return clamp01(langs * 0.6 + topics * 0.4);
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
  const reliability = ctx.them.reputation.hasEnoughSignal
    ? ctx.them.reputation.reliability === 'reliable'
      ? 1
      : ctx.them.reputation.reliability === 'mixed'
        ? 0.5
        : 0.35
    : 0.5;
  return clamp01(ctx.responseRate * 0.6 + reliability * 0.4);
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
  topicalAffinity,
  circleProximity,
  reciprocityPrior,
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
