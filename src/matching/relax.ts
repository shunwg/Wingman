import { findCandidates } from './engine';
import type { MatchInput, Relaxation, RelaxationOutcome } from './types';

/**
 * "What would widening this actually get me?"
 *
 * An empty board is the hardest moment in a product like this, and the wrong
 * response is an apologetic illustration. The right one is a concrete,
 * checkable number: *±2 days would put four more people in range.* That is
 * useful, it is honest, and it is falsifiable — so it has to be computed by
 * actually re-running the engine rather than estimated.
 *
 * Every relaxation is expressed as a transform on the input, so this never
 * drifts from what the board would really show.
 */

function apply(input: MatchInput, r: Relaxation): MatchInput {
  switch (r.kind) {
    case 'allow_shorter_layovers':
      return { ...input, config: { ...input.config, minUsableMin: r.minUsableMin } };

    case 'broaden_meet_kinds':
      // Treat the user as open to everything their trips physically allow.
      return {
        ...input,
        me: {
          ...input.me,
          intent: {
            ...input.me.intent,
            openTo: [
              'gate_coffee',
              'lounge',
              'terminal_walk',
              'ride_share',
              'meal',
              'drinks',
              'business_intro',
              'coworking',
            ],
          },
        },
        myTrip: {
          ...input.myTrip,
          visibility: { ...input.myTrip.visibility, openTo: undefined },
        },
      };

    case 'drop_circle_scope':
      return {
        ...input,
        me: {
          ...input.me,
          privacy: {
            ...input.me.privacy,
            presets: input.me.privacy.presets.filter((p) => p !== 'circles_only'),
            audience: { ...input.me.privacy.audience, circles: 'any' },
            seeking: { ...input.me.privacy.seeking, circles: 'any' },
          },
        },
      };

    case 'widen_days':
      // Stretch every stay by N days at each end.
      return {
        ...input,
        myTrip: {
          ...input.myTrip,
          stays: input.myTrip.stays.map((s) => ({
            ...s,
            dates: {
              from: shiftDate(s.dates.from, -r.days),
              to: shiftDate(s.dates.to, r.days),
            },
          })),
        },
      };
  }
}

function shiftDate(d: string, days: number): never {
  const ms = Date.parse(`${d}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10) as never;
}

const LABEL: Record<Relaxation['kind'], (r: Relaxation, delta: number) => string> = {
  widen_days: (r, delta) =>
    `±${(r as { days: number }).days} days would put ${people(delta)} in range.`,
  allow_shorter_layovers: (_r, delta) =>
    `Counting shorter connections would add ${people(delta)}.`,
  drop_circle_scope: (_r, delta) => `Looking outside your circles would add ${people(delta)}.`,
  broaden_meet_kinds: (_r, delta) => `Being open to more kinds of meet would add ${people(delta)}.`,
};

const people = (n: number) => (n === 1 ? '1 more person' : `${n} more people`);

export function whatIfRelaxed(input: MatchInput, relaxation: Relaxation): RelaxationOutcome {
  const before = findCandidates(input).candidates.length;
  const after = findCandidates(apply(input, relaxation)).candidates.length;
  return {
    relaxation,
    before,
    after,
    label: LABEL[relaxation.kind](relaxation, Math.max(0, after - before)),
  };
}

/**
 * The relaxations worth offering, best first.
 *
 * Only ones that actually change the answer are returned — offering a widening
 * that unlocks nobody is worse than offering nothing, because it teaches people
 * the suggestions are noise.
 */
export function relaxations(input: MatchInput): RelaxationOutcome[] {
  const candidates: Relaxation[] = [
    { kind: 'widen_days', days: 2 },
    { kind: 'allow_shorter_layovers', minUsableMin: 20 },
    { kind: 'broaden_meet_kinds' },
    { kind: 'drop_circle_scope' },
  ];

  return candidates
    .map((r) => whatIfRelaxed(input, r))
    .filter((o) => o.after > o.before)
    .sort((a, b) => b.after - a.after);
}
