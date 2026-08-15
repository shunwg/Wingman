/**
 * The matching engine — public API.
 *
 * Pure. No clock, no randomness, no DOM. `now`, `config` and `airports` are
 * always parameters, so the same input always produces the same output and the
 * whole thing is provable under plain Node.
 *
 * The contract carried over from v1, and worth restating: **hard filters decide
 * who appears; the score only sets order.** A person who fails a filter is
 * removed, never down-ranked. The score is never rendered — the user sees a
 * route receipt of reasons instead.
 */

export { findCandidates } from './engine';
export { classifyOverlap, strongest, OVERLAP_RANK } from './travel/overlap';
export { layoversFor, airportPresences, usableMinutes, orderedSegments } from './travel/layover';
export { proximityFor, proximityForOverlap, proximityClasses } from './travel/proximity';
export {
  feasibleMeetKinds,
  feasibleAcross,
  proposableKinds,
  effectiveOpenTo,
  intentAlignment,
  activeAxes,
} from './filters/intent';
export { applyHardFilters, maxAssurance, type DenialReason, type FilterOutcome } from './filters/hardFilters';
export { buildReceipt } from './explain/receipt';
export { scoreCandidate, compareCandidates, dayKeyOf } from './rank/score';
export { SIGNALS, type SignalContext } from './rank/signals';
export { MATCH_CONFIG_V1 } from './config';
export { whatIfRelaxed, relaxations } from './relax';

export type * from './types';
