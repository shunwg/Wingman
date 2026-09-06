/**
 * Intent — what someone is actually here for.
 *
 * This is the type that lets one app be honestly social and honestly
 * professional at the same time. Appetite is a pair of independent 0–1 dials
 * rather than a single social↔professional slider, because "I'd happily have a
 * coffee and I'd happily talk shop" is a real and common position, and a slider
 * forces people to lie about it.
 *
 * Nothing here is a dating flag. The product does not ask, and the matching
 * engine has no field to key on if it wanted to.
 */

import type { TagId } from './ids';

export type IntentAxis = 'social' | 'professional';

/**
 * The physically-possible ways two travellers can actually meet.
 *
 * These are constrained by geometry, not preference: you cannot have dinner
 * during a 50-minute layover, and nobody coworks on a 737. `matching/` derives
 * the feasible set from the shape of the travel overlap, then intersects it
 * with what both people said they were open to.
 */
export type MeetKind =
  | 'gate_coffee'      // airside, short, low commitment
  | 'lounge'           // airside, needs lounge access and real time
  | 'terminal_walk'    // airside, kills a long layover
  | 'ride_share'       // landside, shared transfer into town
  | 'meal'             // in the city
  | 'drinks'           // in the city, evening
  | 'business_intro'   // explicitly professional, either side of security
  | 'coworking';       // needs a multi-day overlap to be worth anything

export const ALL_MEET_KINDS: readonly MeetKind[] = [
  'gate_coffee',
  'lounge',
  'terminal_walk',
  'ride_share',
  'meal',
  'drinks',
  'business_intro',
  'coworking',
] as const;

export interface IntentProfile {
  /** Independent appetites, 0–1. Both may be high; both may be low. */
  appetite: Record<IntentAxis, number>;
  /** The kinds this person will entertain at all. Empty means invisible. */
  openTo: MeetKind[];
  /** Free-text topics. Kept beside the vocabulary; still an exact-match bonus. */
  topics: string[];
  /** ISO 639-1 codes. A shared language is a real compatibility signal. */
  languages: string[];
  /** What I am into — the interest half, from the vocabulary in `tags.ts`. */
  interests: TagId[];
  /** What I want out of a meeting. Matched against the other person's `offering`. */
  seeking: TagId[];
  /** What I can give. Adjacent beats identical: an investor and a founder. */
  offering: TagId[];
  /**
   * The liberal switch. Someone open to anyone is scored as neutral on the
   * two-sided fit, never as zero — otherwise everyone who has not filled the
   * form in is buried, and the network never starts.
   */
  openToAnyone: boolean;
}

/** Which axis a meet kind primarily serves — used for copy and filtering. */
export const MEET_KIND_AXIS: Record<MeetKind, IntentAxis | 'both'> = {
  gate_coffee: 'both',
  lounge: 'both',
  terminal_walk: 'social',
  ride_share: 'both',
  meal: 'social',
  drinks: 'social',
  business_intro: 'professional',
  coworking: 'professional',
};
