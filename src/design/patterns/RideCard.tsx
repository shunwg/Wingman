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
 */

export interface RideCardProps {
  /** "SIN → Marina Bay", already in travel order. */
  route: { from: string; to: string };
  /** The pickup window, already localised by the caller. */
  when: string;
  seatsLeft: number;
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
  onOpen?: () => void;
  action?: ReactNode;
}

const DOOR_LABEL: Record<NonNullable<RideCardProps['door']>, string> = {
  open: 'Anyone matching',
  circles: 'Circle only',
  invite: 'By link',
};

export function RideCard({
  route,
  when,
  seatsLeft,
  riders,
  fareNote,
  context,
  seatState,
  door,
  onOpen,
  action,
}: RideCardProps) {
  // The last seat is the only state that earns emphasis. Two or three seats is
  // just a number; one is a reason to decide now.
  const seatText = seatsLeft === 0 ? 'Full' : seatsLeft === 1 ? '1 seat left' : `${seatsLeft} seats left`;

  return (
    <article className="ridecard">
      <button
        type="button"
        className="ridecard__body"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={`${route.from} to ${route.to}, ${when}, ${seatText}`}
      >
        <div className="ridecard__rail" aria-hidden="true">
          <span className="ridecard__dot" />
          <span className="ridecard__line" />
          <span className="ridecard__dot ridecard__dot--end" />
        </div>

        <div className="ridecard__main">
          <p className="ridecard__route">
            <span className="ridecard__end">{route.from}</span>
            <span className="ridecard__to">to</span>
            <span className="ridecard__end">{route.to}</span>
          </p>
          <p className="ridecard__when mono">{when}</p>
          {context && <p className="ridecard__context">{context}</p>}

          <div className="ridecard__foot">
            <span className={`ridecard__seats ${seatsLeft === 1 ? 'is-last' : ''}`}>{seatText}</span>
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
          {door && <Chip tone="neutral">{DOOR_LABEL[door]}</Chip>}
          {action}
        </div>
      )}
    </article>
  );
}
