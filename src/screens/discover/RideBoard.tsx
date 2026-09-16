import type { DisclosureLevel } from '@domain/index';
import { localTime } from '@domain/time';
import { redact } from '@privacy/index';
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
          <RideCard key={String(row.ride.id)} {...cardProps(row, String(me.id))} onOpen={() => onOpen(String(row.ride.id))} />
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
export function cardProps(row: RideRow, meId: string) {
  const { ride } = row;
  const zone = airportIndex.zone(ride.airportIata);
  const when = zone
    ? `${localTime(ride.window.from, zone)} – ${localTime(ride.window.to, zone)}`
    : `${String(ride.window.from).slice(11, 16)} – ${String(ride.window.to).slice(11, 16)}`;
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
  const rung: DisclosureLevel = row.mine?.status === 'confirmed' ? 2 : 0;
  const riders = row.riders
    .map((id) => personById(String(id)))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => (String(p.id) === meId ? redact(p, 3) : redact(p, rung)));

  const context =
    row.apartKm === undefined
      ? `${hostName}`
      : row.apartKm < 1
        ? `${hostName} · going where you are going`
        : `${hostName} · ${Math.round(row.apartKm)} km from where you are going`;

  return {
    route: row.route,
    when,
    seatsLeft: row.seatsLeft,
    riders,
    fareNote: ride.fareSplit === 'host_pays' ? `${hostName} is covering it` : 'Fare split evenly',
    context,
    door: ride.audience.kind,
    ...(row.mine?.status === 'confirmed'
      ? { seatState: 'confirmed' as const }
      : row.mine?.status === 'requested'
        ? { seatState: 'pending' as const }
        : {}),
  };
}
