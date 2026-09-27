import type { DisclosureLevel, ISODateTime } from '@domain/index';
import { fareCopy } from '@screens/rides/fareCopy';
import { redact } from '@privacy/index';
import { windowLabel } from '@screens/whenLabel';
import { RideCard } from '@design/patterns/RideCard';
import { Button } from '@design/primitives/Button';
import { airportIndex } from '@data/airports/index';
import { personById } from '@data/seed/people';
import { useJoinableRides, type RideRow } from '@state/selectors/rides';
import { useStore } from '@state/store';

/**
 * Cars going your way.
 *
 * The empty state is the interesting part of this screen. "No cars" is almost
 * never the whole truth — it is either "nobody has offered one on this journey
 * yet", which invites you to offer one, or "some are hidden from you", which is
 * somebody's setting and not a fault. Saying which is the difference between a
 * board that looks broken and one that looks honest.
 */

export function RideBoard({ onOpen }: { onOpen: (rideId: string) => void }) {
  const { rows, hiddenNote } = useJoinableRides();
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);

  if (rows.length === 0) {
    return (
      <div className="empty empty--quiet">
        <p className="empty__body">
          {hiddenNote
            ? `No car you can join on these journeys. ${hiddenNote}`
            : 'Nobody has offered a car on these journeys yet. Offering one is usually faster than waiting for one.'}
        </p>
        <Button size="sm" variant="secondary" onClick={() => (window.location.hash = '#/trip')}>
          Offer a car
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="rideboard">
        {rows.map((row) => (
          <RideCard key={String(row.ride.id)} {...cardProps(row, String(me.id), now, me.blocked.map(String))} onOpen={() => onOpen(String(row.ride.id))} />
        ))}
      </div>
      {hiddenNote && <p className="panel__note">{hiddenNote}</p>}
    </>
  );
}

/**
 * A row, as the card wants it.
 *
 * Exported because `TripsScreen` renders the same card for cars you host, and
 * two hand-written prop mappings drift — one would say "1 seat left" while the
 * other said "1 left".
 */
export function cardProps(row: RideRow, meId: string, now: ISODateTime, hidden: readonly string[] = []) {
  const { ride } = row;
  // Dated, not just clocked. The board can hold cars from trips weeks apart,
  // and a bare "17:30 – 18:30" on each of them is what sends somebody back to
  // the group chat to ask which day.
  const when = windowLabel(ride.window.from, ride.window.to, airportIndex.zone(ride.airportIata), now);
  // The host's first name is a rung-0 field, so it is readable while browsing;
  // `redact` is still the thing that decides that, not this file.
  const hostRaw = personById(String(ride.hostPersonId));
  const hostCard = hostRaw ? redact(hostRaw, 0) : undefined;
  const hostName =
    String(ride.hostPersonId) === meId
      ? 'You'
      : typeof hostCard?.displayName === 'string'
        ? hostCard.displayName.split(' ')[0]!
        : 'Someone';

  /*
   * Riders cross into the card redacted, never as `Person` — rule 1, and the
   * ESLint rule for `design/` would refuse the import anyway.
   *
   * The rung is the one the viewer has actually earned. Browsing a car you are
   * not in shows the ladder's first rung: an avatar and a first name, which is
   * all "three people are in this car" needs. Holding a seat is mutual consent
   * to share a journey, so it reads at `accepted`. Nothing here invents a
   * level: it is the same ladder the person's own card uses.
   */
  /*
      * Rung 1, not 2.
      *
      * Sharing a car is not the same consent as accepting a request from
      * somebody. Rung 2 releases full name, employer, bio and links — and on
      * a circle car anyone in the circle self-seats, so nobody in the car
      * ever agreed to *each other*. Rung 1 gives a first name and an intent,
      * which is what choosing who to sit beside actually needs.
      */
     const rung: DisclosureLevel = row.mine?.status === 'confirmed' ? 1 : 0;
  const riders = row.riders
    // Someone you hid stays off the card too — the car screen already left
    // them out, and the card beside it still drew their face.
    .filter((id) => !hidden.includes(String(id)))
    .map((id) => personById(String(id)))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => (String(p.id) === meId ? redact(p, 3) : redact(p, rung)));

  const context =
    row.apartKm === undefined
      ? `${hostName}`
      : row.apartKm < 1
        ? `${hostName} · going where you are going`
        : `${hostName} · ${Math.round(row.apartKm)} km from where you are going`;

  const closed =
    ride.status === 'cancelled' || ride.status === 'departed' || ride.status === 'completed'
      ? ride.status
      : undefined;

  return {
    route: row.route,
    when,
    ...(closed ? { closed } : {}),
    seatsLeft: row.seatsLeft,
    seatsTotal: ride.seatsTotal,
    riders,
    fareNote: fareCopy(ride, row.riders.length, String(ride.hostPersonId) === meId || row.mine?.status === 'confirmed', hostName).short,
    context,
    door: ride.audience.kind,
    ...(String(ride.hostPersonId) === meId && ride.claims.some((c) => c.status === 'requested')
      ? { waitingOnYou: true }
      : {}),
    ...(row.mine?.status === 'confirmed'
      ? { seatState: 'confirmed' as const }
      : row.mine?.status === 'requested'
        ? { seatState: 'pending' as const }
        : {}),
  };
}
