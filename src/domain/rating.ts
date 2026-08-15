import type { MeetId, PersonId, RatingId } from './ids';
import type { ISODateTime } from './time';

/**
 * Rating people, done carefully.
 *
 * Letting strangers rate strangers is the feature in this product most likely
 * to go wrong, so the schema is built so that the wrong thing is not
 * expressible rather than merely discouraged.
 *
 * Three defences, all structural:
 *
 * 1. **No aesthetic dimension exists.** There is no field about looks, charm or
 *    desirability, so there is nothing to aggregate into a hotness score. A
 *    future product manager cannot surface one without a schema change and a
 *    failing test.
 * 2. **`wouldMeetAgain` is binary.** A five-point scale invites a leaderboard;
 *    a yes/no answers the only useful question.
 * 3. **Blind until both submit.** Nobody's rating can be retaliation for the
 *    one they just received.
 */
export type SafetyFlag = 'pushy' | 'unsafe' | 'misrepresented' | 'commercial_spam';

export interface Rating {
  id: RatingId;
  meetId: MeetId;
  raterId: PersonId;
  rateeId: PersonId;
  submittedAt: ISODateTime;

  /** Conduct, not quality. Did the arrangement hold up. */
  showedUp: 'on_time' | 'late' | 'no_show';
  respectedBoundaries: boolean;
  accurateProfile: boolean;
  wouldMeetAgain: boolean;

  /** Trust-and-safety only. Never shown to the ratee, in any form. */
  privateNote?: string;
  flags: SafetyFlag[];

  /**
   * Set when BOTH parties have submitted, or 72h after the meet window closes,
   * whichever comes first. Until then neither side sees anything.
   */
  revealedAt?: ISODateTime;
}

/** A meet with ratings pending — drives the reveal state machine. */
export interface RatingPair {
  meetId: MeetId;
  byPerson: Partial<Record<PersonId, Rating>>;
  windowClosedAt: ISODateTime;
  revealed: boolean;
}
