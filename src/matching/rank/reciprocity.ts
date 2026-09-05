import type { Person } from '@domain/index';
import { clamp01 } from '../filters/intent';

/**
 * How likely they are to say yes — from conduct, never from desirability.
 *
 * Two inputs only: whether they answer (their response rate) and whether they
 * turn up (their reliability bucket, which the domain withholds below five
 * meets). Nothing about appearance, gender, or how many people ask them, and
 * a test asserts that permuting those leaves the estimate bit-identical.
 *
 * Unproven people sit at a neutral 0.5 rather than at the bottom: a new
 * person penalised for being new never gets the meets that would prove them,
 * and the network stops admitting anyone.
 */
export interface ConductInput {
  responseRate?: number;
  reputation: Person['reputation'];
}

export function estimateAcceptance(input: ConductInput): number {
  const reliability = input.reputation.hasEnoughSignal
    ? input.reputation.reliability === 'reliable'
      ? 1
      : input.reputation.reliability === 'mixed'
        ? 0.5
        : 0.35
    : 0.5;
  if (input.responseRate === undefined) return clamp01(0.5 * 0.6 + reliability * 0.4);
  return clamp01(input.responseRate * 0.6 + reliability * 0.4);
}
