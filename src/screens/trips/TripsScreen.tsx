import { useState } from 'react';
import { Chip } from '@design/primitives/Chip';
import { Button } from '@design/primitives/Button';
import { Sheet } from '@design/primitives/Sheet';
import { Timeline, type TimelineRow } from '@design/patterns/Timeline';
import { airportIndex, cityByKey } from '@data/airports/index';
import { personById } from '@data/seed/people';
import type { Trip } from '@domain/index';
import { localTime, minutesBetween } from '@domain/time';
import { tripCode, tripIsOpen, tripLabel } from '@domain/trip';
import { tripHueClass } from '@design/tokens/tripHue';
import { bucketPhrase } from '@lib/bucket';
import { useStore } from '@state/store';
import { useBoard } from '@state/selectors/board';
import { useCircles } from '@state/selectors/circles';
import { destinationEvents } from '@state/selectors/home';

/**
 * Your trips.
 *
 * Each trip is a rail: airport, flight, layover, airport, stay. At every point
 * where paths can cross, the rail says who is there and what is on — bucketed,
 * never an exact small number. Times are local to each airport, converted at
 * this edge from the UTC instants the domain stores.
 *
 * Each trip carries its own state: listed, hidden, or settled. Settled is the
 * one worth looking at — it means you found someone for that journey and the
 * board has stopped offering alternatives.
 */
export function TripsScreen({ onOpen }: { onOpen: (hash: string) => void }) {
  const trips = useStore((s) => s.myTrips);
  const upsertTrip = useStore((s) => s.upsertTrip);
  const reopenTrip = useStore((s) => s.reopenTrip);
  const removeTrip = useStore((s) => s.removeTrip);
  const [removing, setRemoving] = useState<Trip | null>(null);

  if (trips.length === 0) {
    return (
      <div className="empty">
        <h2 className="empty__title display">No trips yet</h2>
        <p className="empty__body">Add a flight and Wingman shows you who else is around it.</p>
        <Button onClick={() => onOpen('#/trip/new')}>Add a flight</Button>
      </div>
    );
  }

  return (
    <>
      {trips.map((trip) => (
        <TripBlock
          key={String(trip.id)}
          trip={trip}
          onOpen={onOpen}
          onToggleListing={() =>
            upsertTrip({
              ...trip,
              visibility: {
                ...trip.visibility,
                listing: trip.visibility.listing === 'listed' ? 'hidden' : 'listed',
              },
            })
          }
          onReopen={() => reopenTrip(String(trip.id))}
          onRemove={() => setRemoving(trip)}
        />
      ))}

      <Button variant="secondary" full onClick={() => onOpen('#/trip/new')}>
        Add a trip
      </Button>

      <p className="smallnote">
        A trip that is listed lets people around it find you. Hiding one removes you from that
        board without deleting anything, and without touching your other trips.
      </p>

      <Sheet
        open={removing !== null}
        title="Remove this trip?"
        onClose={() => setRemoving(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (removing) removeTrip(String(removing.id));
                setRemoving(null);
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="sheet__body">
          {removing ? `${tripLabel(removing)} goes, and any request that came from it closes. ` : ''}
          Your other trips stay as they are.
        </p>
      </Sheet>
    </>
  );
}

function TripBlock({
  trip,
  onOpen,
  onToggleListing,
  onReopen,
  onRemove,
}: {
  trip: Trip;
  onOpen: (hash: string) => void;
  onToggleListing: () => void;
  onReopen: () => void;
  onRemove: () => void;
}) {
  const settledWith = trip.outcome ? personById(String(trip.outcome.settledWith)) : undefined;
  const open = tripIsOpen(trip);
  const board = useBoard();
  const circles = useCircles();
  const onTrip = board.candidates.filter((c) => c.viaTripId === String(trip.id));
  const perTrip = board.perTrip[String(trip.id)];
  const events = destinationEvents(trip, circles);

  const rows: TimelineRow[] = [];
  trip.segments.forEach((s, i) => {
    const fromZone = airportIndex.zone(s.from);
    const toZone = airportIndex.zone(s.to);
    if (i === 0) {
      rows.push({
        kind: 'stop',
        code: s.from,
        city: airportIndex.get(s.from)?.city ?? s.from,
        ...(fromZone ? { time: localTime(s.departUtc, fromZone) } : {}),
        ...(s.terminalFrom ? { terminal: `Terminal ${s.terminalFrom}` } : {}),
      });
    }
    const onFlight = i === 0 ? perTrip?.onYourFlight ?? 0 : 0;
    rows.push({
      kind: 'leg',
      label: `${s.flightNo} · ${hours(minutesBetween(s.departUtc, s.arriveUtc))}`,
      ...(onFlight > 0 ? { note: `${bucketPhrase(onFlight)} on your flight` } : {}),
    });
    const layover = trip.layovers.find((l) => l.arrivingSegmentId === s.id);
    if (layover) {
      const nearby = perTrip?.inYourLayover ?? 0;
      rows.push({
        kind: 'layover',
        label: `${hours(layover.usableMin)} in ${airportIndex.get(layover.airport)?.city ?? layover.airport}`,
        note: nearby > 0 ? `${bucketPhrase(nearby)} nearby` : layover.sameTerminal ? 'same terminal' : 'terminal change',
      });
    }
    rows.push({
      kind: 'stop',
      code: s.to,
      city: airportIndex.get(s.to)?.city ?? s.to,
      ...(toZone ? { time: localTime(s.arriveUtc, toZone) } : {}),
      ...(s.terminalTo ? { terminal: `Terminal ${s.terminalTo}` } : {}),
    });
  });
  for (const stay of trip.stays) {
    const city = cityByKey(stay.cityKey)?.name ?? String(stay.cityKey).split('-')[0]!;
    const inCity = perTrip?.inYourCity ?? 0;
    rows.push({
      kind: 'stay',
      label: `${city} · ${dates(stay.dates.from, stay.dates.to)}`,
      note: [stay.destination?.label, inCity > 0 ? `${bucketPhrase(inCity)} in the city` : undefined].filter(Boolean).join(' · '),
      extra:
        events.length > 0 ? (
          <div className="timeline__events">
            {events.map((c) => (
              <button type="button" key={String(c.id)} className="timeline__event" onClick={() => onOpen(`#/circles/${String(c.id)}`)}>
                {c.name} ›
              </button>
            ))}
          </div>
        ) : undefined,
    });
  }

  return (
    <article className={`tripblock ${tripHueClass(tripCode(trip))} ${open ? '' : 'tripblock--closed'}`}>
      <header className="tripblock__head">
        <span className="tripdot tripblock__dot" aria-hidden="true" />
        <span className="tripblock__code mono">{tripLabel(trip)}</span>
        {trip.outcome ? (
          <Chip tone="trust">Sorted</Chip>
        ) : trip.visibility.listing === 'hidden' ? (
          <Chip tone="warn">Hidden</Chip>
        ) : (
          <Chip tone="neutral">Looking</Chip>
        )}
        {purposeOf(trip) && <Chip tone="neutral">{purposeOf(trip)}</Chip>}
      </header>

      <Timeline rows={rows} />

      {onTrip.length > 0 && open && (
        <button type="button" className="homesec__more" onClick={() => onOpen('#/discover')}>
          {bucketPhrase(onTrip.length)} worth meeting on this trip ›
        </button>
      )}

      <div className="panel__row">
        {trip.outcome ? (
          <>
            <p className="tripblock__note">
              You&rsquo;re meeting {settledWith?.firstName ?? 'someone'} on this one, so it has
              stopped suggesting people.
            </p>
            <Button size="sm" variant="secondary" onClick={onReopen}>
              Look again anyway
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={onToggleListing}>
            {trip.visibility.listing === 'listed' ? 'Hide this trip' : 'List this trip again'}
          </Button>
        )}
        <Button size="sm" variant="quiet" onClick={() => onOpen(`#/trip/${String(trip.id)}/edit`)}>
          Edit
        </Button>
        <Button size="sm" variant="quiet" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </article>
  );
}

const hours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/** "3–6 Sep" or "28 Sep – 2 Oct". */
function dates(from: string, to: string): string {
  const a = new Date(`${from}T12:00:00Z`);
  const b = new Date(`${to}T12:00:00Z`);
  const md = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${md(b)}` : `${md(a)} – ${md(b)}`;
}

/** Work, Leisure, or nothing when the trip inherits the standing appetite. */
function purposeOf(trip: Trip): string | null {
  const a = trip.intent?.appetite;
  if (!a) return null;
  if (a.professional - a.social > 0.25) return 'Work';
  if (a.social - a.professional > 0.25) return 'Leisure';
  return null;
}
