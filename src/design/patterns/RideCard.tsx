import type { ReactNode } from 'react';
import type { RedactedPerson } from '@domain/person';
import { Avatar } from '../primitives/Avatar';
import { Chip } from '../primitives/Chip';

/**
 * A shared car.
 *
 * The native prototype's Car screen worked out the vocabulary for this and it
 * is worth keeping: a route rail with the two ends on it, the pickup time set
 * in mono like every other travel fact, the seats left as the one number that
 * creates any urgency, and the fare split stated plainly so nobody has to ask
 * the awkward question in the car.
 *
 * Two things are deliberately *not* here. There is no photograph of the host
 * filling the card — the same argument as `PersonCard`: this is a decision
 * about a journey, not about a face. And the seat count is exact where every
 * count of *people* in this app is bucketed, because a seat is inventory. "One
 * seat left" is the fact that matters and it identifies nobody.
 *
 * Takes `RedactedPerson` for the host and riders, never `Person` — the ESLint
 * rule for this folder means a leak would have to be deliberate.
 *
 * The first version carried a two-dot route rail borrowed from the native
 * prototype. It is gone, for two reasons a design review put better than the
 * borrowing did: the trip card forty pixels away already has a station rail,
 * so this was a second vocabulary for the same idea; and it was geometrically
 * false — a fixed 26px line whose two "ends" spanned the route *and the
 * clock*, which is not a journey. `from to to` carries it in words, which is
 * how the trip card's own header does it.
 */

export interface RideCardProps {
  /** "SIN → Marina Bay", already in travel order. */
  route: { from: string; to: string };
  /** The pickup window, already localised by the caller. */
  when: string;
  seatsLeft: number;
  /** Seats in the car including the host's, so "2 free" has a denominator. */
  seatsTotal: number;
  /** Host first. */
  riders: RedactedPerson[];
  /** "Splitting the fare" / "Jonas is covering it". */
  fareNote: string;
  /** "Your flight · INSEAD" — why this car is in front of you. */
  context?: string;
  /** Set when the viewer already holds a seat. */
  seatState?: 'pending' | 'confirmed';
  /** The door, shown so nobody is surprised by who else can join. */
  door?: 'open' | 'circles' | 'invite';
  /**
   * Set when the car is no longer happening.
   *
   * Without it a called-off car kept its seat count and its door chip on the
   * host's own Trips screen, reading exactly like a live one — the seat count
   * being the cruellest part, since it implies somebody could still join.
   */
  closed?: 'cancelled' | 'departed' | 'completed';
  onOpen?: () => void;
  action?: ReactNode;
}

/**
 * The door, as what it does rather than what it is called.
 *
 * "Circle only" read as a tightening, and it is one — nobody outside the
 * circle sees the car — but it *also* waives the host's confirmation, which is
 * the half that matters to whoever is about to be sat beside somebody. Two
 * independent persona walks got this backwards, so the chip now names the
 * consent model and `DOOR_COPY` carries the full sentence on the car itself.
 */
const DOOR_LABEL: Record<NonNullable<RideCardProps['door']>, string> = {
  open: 'Host approves',
  circles: 'Circle seats itself',
  invite: 'Link seats itself',
};

export function RideCard({
  route,
  when,
  seatsLeft,
  seatsTotal,
  riders,
  fareNote,
  context,
  seatState,
  door,
  closed,
  onOpen,
  action,
}: RideCardProps) {
  // The last seat is the only state that earns emphasis. Two or three seats is
  // just a number; one is a reason to decide now.
  //
  // "1 seat left" on its own turned out to be uninterpretable — left out of
  // how many? — so the total goes with it. A persona walking this card asked
  // exactly that and could not answer it from the screen.
  const CLOSED_TEXT = {
    cancelled: 'Called off',
    departed: 'Already left',
    completed: 'Done',
  } as const;
  const seatText = closed
    ? CLOSED_TEXT[closed]
    : seatsLeft === 0
      ? 'Full'
      : `${seatsLeft} of ${seatsTotal} seat${seatsTotal === 1 ? '' : 's'} free`;

  return (
    <article className={`ridecard ${closed ? 'is-closed' : ''}`}>
      <button
        type="button"
        className="ridecard__body"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={`${route.from} to ${route.to}, ${when}, ${seatText}, ${fareNote}${
          door ? `, ${DOOR_LABEL[door]}` : ''
        }`}
      >
        <div className="ridecard__main">
          <p className="ridecard__route">
            <span className="ridecard__end">{route.from}</span>
            <span className="ridecard__to">to</span>
            <span className="ridecard__end">{route.to}</span>
          </p>
          <p className="ridecard__when mono">{when}</p>
          {context && <p className="ridecard__context">{context}</p>}

          <div className="ridecard__foot">
            <span className={`ridecard__seats ${seatsLeft === 1 ? 'is-last' : ''}`}>
              {/* Colour is never the only indicator: the last seat gets a word
                  as well as the accent, so the state survives a greyscale
                  screen and a theme where the two hues converge. */}
              {!closed && seatsLeft === 1 && <span className="ridecard__lastflag">Last</span>}
              {seatText}
            </span>
            <span className="ridecard__fare">{fareNote}</span>
          </div>
        </div>

        <div className="ridecard__faces">
          {riders.slice(0, 3).map((p) => (
            <Avatar key={String(p.id)} spec={p.avatar} size="xs" />
          ))}
        </div>
      </button>

      {(seatState || door || action) && (
        <div className="ridecard__tail">
          {seatState === 'confirmed' && <Chip tone="trust">You have a seat</Chip>}
          {seatState === 'pending' && <Chip tone="neutral">Waiting on the host</Chip>}
          {door && !closed && <Chip tone="neutral">{DOOR_LABEL[door]}</Chip>}
          {action}
        </div>
      )}
    </article>
  );
}
