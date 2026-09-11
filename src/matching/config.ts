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
  /**
   * Short hops are not a social occasion. 90 also excludes intra-European
   * routes a Europe-based cohort actually flies (CDG–LHR, CDG–AMS, ORY–BCN
   * run 60 to 85 minutes) — but there is no seeded data for those routes yet
   * to tune this number against, and the existing OSL–CPH fixture in
   * overlap.test.ts deliberately treats 50 minutes as too short. Revisit
   * this alongside the Fontainebleau seed data, so the new floor is chosen
   * against real flight durations rather than picked blind.
   */
  minSameFlightMin: 90,
  /** How long before departure someone is plausibly at the airport. */
  preDepartureMin: 120,
  /**
   * How long after landing someone is plausibly still there. 75 minutes was
   * tuned for someone walking straight out; a person clearing bags, then
   * finding and agreeing a shared ride needs longer before they are gone.
   */
  postArrivalMin: 150,

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
    overlapStrength: 0.22,
    // The headline matchmaking signal: what I seek against what they offer,
    // and the reverse, as a harmonic mean.
    mutualFit: 0.12,
    intentAlignment: 0.12,
    interestAffinity: 0.1,
    // The window is the thing that expires: a 90-minute layover outranks a week.
    scarcity: 0.09,
    reciprocityPrior: 0.09,
    temporalSlack: 0.08,
    circleProximity: 0.07,
    // Under the circle cap, so a big circle cannot dominate the board.
    cohort: 0.04,
    // Adjacent beats identical; mostly superseded by mutualFit.
    complementarity: 0.04,
    fairness: 0.03,
  },

  /** Shown five times and never acted on: stop leading with them. */
  fatiguePenalty: 0.06,
  /**
   * 60 is more than the current ~23-person seed cast ever produces, so
   * nobody is cut today. It is also sized for a curated conference list, not
   * a launch where hundreds of people can share one flight or one airport
   * window — but lowering it needs the board grouped by airport and arrival
   * slot first (state/selectors/board.ts), or it just hides real candidates
   * behind an arbitrary cutoff instead of making them scannable. Tighten
   * this together with that grouping work, not in isolation.
   */
  limit: 60,
};
