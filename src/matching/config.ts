import type { MatchConfig } from './types';

/**
 * Matching configuration, versioned.
 *
 * Passed into the engine as a parameter rather than imported inside the
 * algorithm files, so a test can zero every weight except the one under test
 * and assert that signal in isolation.
 *
 * The buffer numbers are the interesting part. Gross connection time is not
 * meetable time, and treating it as such is how an app cheerfully proposes
 * dinner during a 55-minute connection and destroys its own credibility the
 * first time someone misses a flight. These are deliberately pessimistic.
 */
export const MATCH_CONFIG_V1: MatchConfig = {
  /** Off the aircraft and out of the pier. */
  disembarkMin: 15,
  /** Immigration plus re-screening if you leave airside and come back. */
  landsideReentryMin: 60,
  /** Inter-terminal transit, generously. */
  terminalChangeMin: 25,
  /** Back at the gate before boarding closes. */
  boardingBufferMin: 35,
  /** Below this, nothing is proposable at all. */
  minUsableMin: 30,
  /** Short hops are not a social occasion. */
  minSameFlightMin: 90,

  idealMin: {
    gate_coffee: 45,
    lounge: 75,
    terminal_walk: 60,
    ride_share: 45,
    meal: 105,
    drinks: 120,
    business_intro: 45,
    coworking: 240,
  },

  /**
   * Ordering weights.
   *
   * Note what is absent: nothing about appearance, nothing about gender,
   * nothing that reduces reputation to a scalar. `reciprocityPrior` is about
   * conduct — whether someone answers and turns up — not desirability. A test
   * asserts that permuting a candidate's avatar or gender leaves the score
   * bit-identical.
   */
  weights: {
    overlapStrength: 0.3,
    intentAlignment: 0.2,
    temporalSlack: 0.15,
    topicalAffinity: 0.1,
    circleProximity: 0.1,
    reciprocityPrior: 0.1,
    fairness: 0.05,
  },

  /** Shown five times and never acted on: stop leading with them. */
  fatiguePenalty: 0.06,
  limit: 60,
};
