import { useMemo, useState } from 'react';
import { parseInvite } from '@domain/invite';
import { localTime } from '@domain/time';
import { cameBack, latestClaim, seatsLeft, seatsAutomatically } from '@domain/index';
import { redact } from '@privacy/index';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { airportIndex } from '@data/airports/index';
import { personById } from '@data/seed/people';
import { DOOR_COPY, RIDE_FARE_NOTE } from '@data/copy/rides';
import { useStore } from '@state/store';

/**
 * Following a car's link.
 *
 * Its own top-level route, the same decision as the circle invite: the whole
 * URL is what gets pasted into a message, so it cannot be a query string on a
 * screen that might redirect.
 *
 * Every outcome is stated. A bad code, a car that filled up, a car already
 * called off and a car you are already in are four different things, and a
 * single "that didn't work" would leave someone standing in an arrivals hall
 * guessing which.
 */

export interface JoinRideScreenProps {
  code: string;
  onOpen: (rideId: string) => void;
  onDone: () => void;
}

export function JoinRideScreen({ code, onOpen, onDone }: JoinRideScreenProps) {
  const rides = useStore((s) => s.rides);
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const claimSeat = useStore((s) => s.claimSeat);
  const [tried, setTried] = useState(false);

  const parsed = useMemo(() => parseInvite(code), [code]);
  const ride = useMemo(
    () => (parsed ? rides.find((r) => r.inviteCode && String(r.inviteCode) === parsed.code) : undefined),
    [parsed, rides],
  );

  if (!parsed) {
    return (
      <Outcome
        title="That link does not look right"
        note="A car's key is six characters. Check the end of the link and try again."
        onDone={onDone}
      />
    );
  }

  if (!ride) {
    return (
      <Outcome
        title="No car for that link"
        note={`Nothing on this device matches ${parsed.code}. The host may have called it off.`}
        onDone={onDone}
      />
    );
  }

  // Your newest seat — an old withdrawn one must not hide a live one, or the
  // other way round.
  const mine = latestClaim(ride, me.id);
  // The host said no, or took the seat back. A link does not undo that.
  const closedToMe = ride.claims.some(
    (c) =>
      String(c.personId) === String(me.id) &&
      (c.status === 'removed_by_host' ||
        c.status === 'declined' ||
        (c.status === 'revoked_by_policy' && c.history.at(-1)?.by === 'system')),
  );
  const zone = airportIndex.zone(ride.airportIata);
  const when = zone ? localTime(ride.window.from, zone) : String(ride.window.from).slice(11, 16);
  // Rung 0: following a link tells you whose car it is by first name, and
  // nothing else about them. Rule 1 again — never the raw Person.
  const hostRaw = personById(String(ride.hostPersonId));
  const hostCard = hostRaw ? redact(hostRaw, 0) : undefined;
  const hostFirst =
    typeof hostCard?.displayName === 'string' ? hostCard.displayName.split(' ')[0]! : undefined;
  const left = seatsLeft(ride);
  const gone = ride.status === 'cancelled' || String(now) >= String(ride.expiresAt);

  if (String(ride.hostPersonId) === String(me.id)) {
    return (
      <Outcome
        title="This is your own car"
        note="Send the link to somebody else and they can take a seat."
        action={<Button onClick={() => onOpen(String(ride.id))}>Open it</Button>}
        onDone={onDone}
      />
    );
  }

  if (mine && (mine.status === 'confirmed' || mine.status === 'requested')) {
    return (
      <Outcome
        title={mine.status === 'confirmed' ? 'You already have this seat' : 'You have already asked'}
        note="Nothing more to do here."
        action={<Button onClick={() => onOpen(String(ride.id))}>Open the car</Button>}
        onDone={onDone}
      />
    );
  }

  if (closedToMe) {
    return (
      <Outcome
        title="This seat has closed"
        note="A link does not reopen it. Worth asking on the board whether anyone else is going your way."
        onDone={onDone}
      />
    );
  }

  if (gone) {
    return (
      <Outcome
        title={ride.status === 'cancelled' ? 'That car was called off' : 'That car has left'}
        note="Worth asking on the board whether anyone else is going your way."
        onDone={onDone}
      />
    );
  }

  if (left === 0) {
    return (
      <Outcome
        title="Every seat is taken"
        note="The link works; the car is simply full."
        onDone={onDone}
      />
    );
  }

  if (tried) {
    /*
     * Read the store back rather than trusting the tap.
     *
     * This screen used to say "You are in" the moment the button was pressed,
     * whether the write landed or not — so a refusal the store was right to
     * make (a stale link, a door that closed while the page was open) was
     * reported as a seat. Saying "you are in" to somebody who is not in the
     * car is the worst sentence in this feature.
     */
    const seat = latestClaim(ride, me.id);
    if (seat?.status === 'confirmed') {
      return (
        <Outcome
          title="You are in"
          note="The car's room is open, with the pickup time and who else is coming."
          action={<Button onClick={() => onOpen(String(ride.id))}>Open the car</Button>}
          onDone={onDone}
        />
      );
    }
    if (seat?.status === 'requested') {
      return (
        <Outcome
          title="Asked"
          note="The host has to say yes. You will see it either way."
          action={<Button onClick={() => onOpen(String(ride.id))}>Open the car</Button>}
          onDone={onDone}
        />
      );
    }
    return (
      <Outcome
        title="That seat did not go through"
        note="The car may have filled or the door may have closed since the link was sent. Nothing was taken."
        onDone={onDone}
      />
    );
  }

  return (
    <div className="screen">
      <section className="panel">
        <h3 className="panel__title">A seat in a shared car</h3>
        <p className="ride__route">
          <span>{ride.direction === 'from_airport' ? String(ride.airportIata) : ride.point.label}</span>
          <span className="ride__to">to</span>
          <span>{ride.direction === 'from_airport' ? ride.point.label : String(ride.airportIata)}</span>
        </p>
        <p className="ride__when mono">{when} local</p>
        <div className="panel__row">
          <Chip tone="accent">{left === 1 ? '1 seat left' : `${left} seats left`}</Chip>
          <Chip tone="neutral">{hostFirst ? `${hostFirst} is driving it` : 'Shared car'}</Chip>
        </div>
        <p className="panel__note">{DOOR_COPY[ride.audience.kind].guest}</p>
        <p className="panel__note">{RIDE_FARE_NOTE}</p>
        <Button
          full
          onClick={() => {
            claimSeat(String(ride.id), { code: parsed.code });
            setTried(true);
          }}
        >
          {seatsAutomatically(ride.audience) && !cameBack(ride, me.id) ? 'Take the seat' : 'Ask for a seat'}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Not this time
        </Button>
      </section>
    </div>
  );
}

function Outcome({
  title,
  note,
  action,
  onDone,
}: {
  title: string;
  note: string;
  action?: React.ReactNode;
  onDone: () => void;
}) {
  return (
    <div className="screen">
      <section className="panel">
        <h3 className="panel__title">{title}</h3>
        <p className="panel__note">{note}</p>
        {action}
        <Button variant="quiet" onClick={onDone}>
          Back to your trips
        </Button>
      </section>
    </div>
  );
}
