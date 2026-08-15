import { Chip } from '@design/primitives/Chip';
import { Button } from '@design/primitives/Button';
import { airportIndex } from '@data/airports/index';
import { asIata } from '@domain/ids';
import { localTime, localDate } from '@domain/time';
import { useStore } from '@state/store';

/**
 * Your trips.
 *
 * Times are rendered in the *local* zone of each airport, converted here at the
 * edge from the UTC instants the domain stores. Showing a departure in the
 * viewer's own timezone would be technically defensible and practically useless
 * — nobody thinks about their flight in a timezone they are not standing in.
 */
export function TripsScreen() {
  const trip = useStore((s) => s.myTrip);
  const setTrip = useStore((s) => s.setTrip);

  if (!trip) {
    return (
      <div className="empty">
        <h2 className="empty__title display">No trips</h2>
        <p className="empty__body">Add a flight and Wingman shows you who else is around it.</p>
      </div>
    );
  }

  return (
    <>
      {trip.segments.map((s) => {
        const fromZone = airportIndex.zone(s.from);
        const toZone = airportIndex.zone(s.to);
        const fromCity = airportIndex.get(s.from)?.city ?? s.from;
        const toCity = airportIndex.get(s.to)?.city ?? s.to;

        return (
          <article className="tripcard" key={String(s.id)}>
            <div className="tripcard__head">
              <span className="mono tripcard__no">{s.flightNo}</span>
              {s.confidence < 0.6 && <Chip tone="warn">Estimated</Chip>}
            </div>
            <div className="tripcard__route">
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
            {(s.terminalFrom || s.terminalTo) && (
              <p className="tripcard__terminals mono">
                {s.terminalFrom ? `Dep ${s.terminalFrom}` : ''}
                {s.terminalFrom && s.terminalTo ? ' · ' : ''}
                {s.terminalTo ? `Arr ${s.terminalTo}` : ''}
              </p>
            )}
          </article>
        );
      })}

      {trip.stays.map((stay) => {
        const zone = airportIndex.cityZone(stay.cityKey);
        return (
          <article className="tripcard" key={String(stay.cityKey) + stay.dates.from}>
            <div className="tripcard__head">
              <span className="tripcard__stay">In town</span>
            </div>
            <p className="tripcard__city tripcard__city--big">
              {String(stay.cityKey).split('-')[0]!.replace(/\b\w/g, (m) => m.toUpperCase())}
            </p>
            <p className="tripcard__time mono">
              {stay.dates.from} → {stay.dates.to}
              {zone ? ` · lands ${localDate(stay.arriveUtc, zone)}` : ''}
            </p>
          </article>
        );
      })}

      <div className="tripcard__footer">
        <p className="smallnote">
          Your trip is listed, so people around it can find you. Hiding it removes you from every
          board without deleting anything.
        </p>
        <Button
          variant="secondary"
          full
          onClick={() =>
            setTrip({
              ...trip,
              visibility: {
                ...trip.visibility,
                listing: trip.visibility.listing === 'listed' ? 'hidden' : 'listed',
              },
            })
          }
        >
          {trip.visibility.listing === 'listed' ? 'Hide this trip' : 'List this trip again'}
        </Button>
      </div>
    </>
  );
}

export { asIata };
