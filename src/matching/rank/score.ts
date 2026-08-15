import type { MatchConfig, SignalName } from '../types';
import { SIGNALS, type SignalContext } from './signals';

/**
 * Combine the signals into an ordering value.
 *
 * A weighted sum, which is the honest shape for something whose only job is to
 * decide what appears first. Weights come from the injected config rather than
 * an import, so a test can zero everything except one signal and assert it
 * moves the order in the expected direction.
 */
export function scoreCandidate(ctx: SignalContext): {
  score: number;
  signals: Record<SignalName, number>;
} {
  const signals = {} as Record<SignalName, number>;
  let score = 0;

  for (const [name, fn] of Object.entries(SIGNALS) as [SignalName, (c: SignalContext) => number][]) {
    const value = fn(ctx);
    signals[name] = value;
    score += (ctx.config.weights[name] ?? 0) * value;
  }

  return { score, signals };
}

/**
 * A stable day key for the fairness seed.
 *
 * Derived from the injected `now` rather than the clock, so ordering is
 * reproducible in tests and steady for a user across a single day.
 */
export const dayKeyOf = (nowIso: string): string => nowIso.slice(0, 10);

/**
 * Deterministic ordering.
 *
 * Ties break on person id rather than on input order, so the result does not
 * depend on the order the pool happened to arrive in — which would otherwise
 * make the whole thing untestable and subtly unfair.
 */
export function compareCandidates(
  a: { score: number; id: string },
  b: { score: number; id: string },
): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.id.localeCompare(b.id);
}

export function weightsSum(config: MatchConfig): number {
  return Object.values(config.weights).reduce((a, b) => a + b, 0);
}
