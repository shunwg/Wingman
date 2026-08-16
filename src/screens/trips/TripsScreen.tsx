import { Chip } from '@design/primitives/Chip';
import { Button } from '@design/primitives/Button';
import { airportIndex } from '@data/airports/index';
import { personById } from '@data/seed/people';
import type { Trip } from '@domain/index';
import { asIata } from '@domain/ids';
import { localTime, localDate } from '@domain/time';
import { tripCode, tripIsOpen } from '@domain/trip';
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

  if (trips.length === 0) {
    return (
      <div className="empty">
        <h2 className="empty__title display">No trips</h2>
        <p className="empty__body">Add a flight and Wingman shows you who else is around it.</p>
      </div>
    );
  }

  return (
    <>
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
        />
      ))}

      <p className="smallnote">
        A trip that is listed lets people around it find you. Hiding one removes you from that
        board without deleting anything, and without touching your other trips.
      </p>
    </>
  );
}

function TripBlock({
  trip,
  onToggleListing,
  onReopen,
}: {
  trip: Trip;
  onToggleListing: () => void;
  onReopen: () => void;
}) {
  const settledWith = trip.outcome ? personById(String(trip.outcome.settledWith)) : undefined;
  const open = tripIsOpen(trip);

  return (
    <article
      className={`tripblock ${tripHueClass(tripCode(trip))} ${open ? '' : 'tripblock--closed'}`}
    >
      <header className="tripblock__head">
        <span className="tripdot tripblock__dot" aria-hidden="true" />
        <span className="tripblock__code mono">{tripCode(trip)}</span>
        {trip.outcome ? (
          <Chip tone="trust">Sorted</Chip>
        ) : trip.visibility.listing === 'hidden' ? (
          <Chip tone="warn">Hidden</Chip>
        ) : (
          <Chip tone="neutral">Looking</Chip>
        )}
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
    </article>
  );
}

export { asIata };
