import { useState } from 'react';
import { Chip } from '@design/primitives/Chip';
import { Button } from '@design/primitives/Button';
import { Sheet } from '@design/primitives/Sheet';
import { airportIndex } from '@data/airports/index';
import { personById } from '@data/seed/people';
import type { Trip } from '@domain/index';
import { localTime, localDate } from '@domain/time';
import { tripCode, tripIsOpen, tripLabel } from '@domain/trip';
import { tripHueClass } from '@design/tokens/tripHue';
import { useStore } from '@state/store';

/**
 * Your trips.
 *
 * Times are rendered in the *local* zone of each airport, converted here at the
 * edge from the UTC instants the domain stores. Showing a departure in the
 * viewer's own timezone would be technically defensible and practically useless
 * — nobody thinks about their flight in a timezone they are not standing in.
 *
 * Each trip carries its own state: listed, hidden, or settled. Settled is the
 * one worth looking at — it means you found someone for that journey and the
 * board has stopped offering alternatives.
 */
export function TripsScreen() {
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
        <Button onClick={() => (window.location.hash = '#/trip/new')}>Add a flight</Button>
      </div>
    );
  }

  return (
    <>
      <div className="panel__row">
        <Button size="sm" onClick={() => (window.location.hash = '#/trip/new')}>
          Add a trip
        </Button>
      </div>

      {trips.map((trip) => (
        <TripBlock
          key={String(trip.id)}
          trip={trip}
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
  onToggleListing,
  onReopen,
  onRemove,
}: {
  trip: Trip;
  onToggleListing: () => void;
  onReopen: () => void;
  onRemove: () => void;
}) {
  const settledWith = trip.outcome ? personById(String(trip.outcome.settledWith)) : undefined;
  const open = tripIsOpen(trip);

  return (
    <article
      className={`tripblock ${tripHueClass(tripCode(trip))} ${open ? '' : 'tripblock--closed'}`}
    >
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

      {trip.segments.map((s) => {
        const fromZone = airportIndex.zone(s.from);
        const toZone = airportIndex.zone(s.to);
        const fromCity = airportIndex.get(s.from)?.city ?? s.from;
        const toCity = airportIndex.get(s.to)?.city ?? s.to;

        return (
          <div className="tripcard__route" key={String(s.id)}>
            <div>
              <p className="tripcard__code mono">{s.from}</p>
              <p className="tripcard__city">{fromCity}</p>
              <p className="tripcard__time mono">
                {fromZone ? localTime(s.departUtc, fromZone) : '—'}
              </p>
            </div>
            <div className="tripcard__arrow" aria-hidden="true">
              →
            </div>
            <div>
              <p className="tripcard__code mono">{s.to}</p>
              <p className="tripcard__city">{toCity}</p>
              <p className="tripcard__time mono">
                {toZone ? localTime(s.arriveUtc, toZone) : '—'}
              </p>
            </div>
          </div>
        );
      })}

      {trip.stays.map((stay) => {
        const zone = airportIndex.cityZone(stay.cityKey);
        return (
          <p className="tripblock__stay mono" key={String(stay.cityKey) + stay.dates.from}>
            {String(stay.cityKey).split('-')[0]!.replace(/\b\w/g, (m) => m.toUpperCase())} ·{' '}
            {stay.dates.from} → {stay.dates.to}
            {zone ? ` · lands ${localDate(stay.arriveUtc, zone)}` : ''}
            {stay.destination ? ` · ${stay.destination.label}` : ''}
          </p>
        );
      })}

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
        <Button size="sm" variant="quiet" onClick={() => (window.location.hash = `#/trip/${String(trip.id)}/edit`)}>
          Edit
        </Button>
        <Button size="sm" variant="quiet" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </article>
  );
}

/** Work, Leisure, or nothing when the trip inherits the standing appetite. */
function purposeOf(trip: Trip): string | null {
  const a = trip.intent?.appetite;
  if (!a) return null;
  if (a.professional - a.social > 0.25) return 'Work';
  if (a.social - a.professional > 0.25) return 'Leisure';
  return null;
}
