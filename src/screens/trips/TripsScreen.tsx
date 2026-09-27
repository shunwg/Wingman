import { useState } from 'react';
import { Chip } from '@design/primitives/Chip';
import { Button } from '@design/primitives/Button';
import { RideCard } from '@design/patterns/RideCard';
import { cardProps } from '@screens/discover/RideBoard';
import { RideSheet } from '@screens/rides/RideSheet';
import { tripForRide, useMyRides, type RideRow } from '@state/selectors/rides';
import { usePlansForTrip } from '@state/selectors/plans';
import { PLAN_COPY, PLACE_KIND_LABEL } from '@data/copy/plans';
import { whenLabel } from '@screens/whenLabel';
import { Sheet } from '@design/primitives/Sheet';
import { Timeline, type TimelineRow } from '@design/patterns/Timeline';
import { PlaceBand, atmosphere, cityPhoto, destinationPhoto } from '@screens/placePhoto';
import { PortRail } from './PortRail';
import { JourneyRail } from './JourneyRail';
import { airportIndex, cityByKey } from '@data/airports/index';
import type { ISODateTime, JourneyStage, StageUpdate, Trip } from '@domain/index';
import { roomMembers } from '@domain/index';
import { localTime, minutesBetween } from '@domain/time';
import { tripCode, tripIsOpen, tripIsOver, tripLabel } from '@domain/trip';
import { tripHueClass } from '@design/tokens/tripHue';
import { bucketPhrase } from '@lib/bucket';
import { useStore } from '@state/store';
import { useBoard } from '@state/selectors/board';
import { useCircles } from '@state/selectors/circles';
import { destinationEvents, settledFirstName } from '@state/selectors/home';

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
  const [sharing, setSharing] = useState<Trip | null>(null);
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  // Both halves in one place: cars you offered, and cars you hold a seat in.
  // A seat you took on somebody else's car belongs on your own trip, because
  // that is where you look when you are working out how you get into town.
  const { hosting, riding } = useMyRides();
  const tripStages = useStore((s) => s.tripStages);
  const setTripStage = useStore((s) => s.setTripStage);
  const clearTripStage = useStore((s) => s.clearTripStage);
  const post = useStore((s) => s.post);
  const channels = useStore((s) => s.channels);

  /*
   * Telling the car is a separate, deliberate act.
   *
   * The rail is private until this runs. It posts into the car's own room
   * using the `stage` message the room already speaks — the same one-tap
   * vocabulary a meet room has had since it was built — so nothing new is
   * invented and the people in the car see it in the place they are already
   * looking.
   */
  // Which of *your* trips each car serves — the host's trip id names the
  // host's journey, not yours, so a seat you took never matched on it.
  const carsFor = (trip: Trip) =>
    [...hosting, ...riding].filter((r) => String(tripForRide(r.ride, trips, String(me.id))?.id) === String(trip.id));

  const carRoomFor = (trip: Trip) => {
    // Not a called-off car: its room keeps the people whose seats ended, and
    // "Tell the car" would have sent them where you are.
    const mine = carsFor(trip).find(
      (r) =>
        r.mine?.status !== 'requested' &&
        r.ride.status !== 'cancelled' &&
        // Not into a room someone you hid can still read.
        !roomMembers(r.ride).some((p) => me.blocked.includes(p)),
    );
    if (!mine) return undefined;
    // A car with no room yet is a car with nobody in it but you. Offering to
    // tell it would be a button that does nothing, which is the failure this
    // whole QA round existed to remove.
    return channels.find((c) => String(c.id) === `ride:${String(mine.ride.id)}`);
  };

  const tellCar = (trip: Trip, stage: JourneyStage) => {
    const room = carRoomFor(trip);
    if (!room) return;
    post(room, { kind: 'stage', stage });
  };

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
      <PortRail trips={trips} now={now} />

      {trips.map((trip) => (
        <TripBlock
          key={String(trip.id)}
          trip={trip}
          onOpen={onOpen}
          meId={String(me.id)}
          now={now}
          stage={tripStages[String(trip.id)]}
          onSetStage={(st) => setTripStage(String(trip.id), st)}
          {...(carRoomFor(trip) ? { onTellCar: (st: JourneyStage) => tellCar(trip, st) } : {})}
          onUndo={() => clearTripStage(String(trip.id))}
          cars={carsFor(trip)}
          onShareCar={() => setSharing(trip)}
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

      {sharing && (
        <RideSheet
          open
          trip={sharing}
          onClose={() => setSharing(null)}
          onDone={(rideId) => {
            setSharing(null);
            onOpen(`#/car/${rideId}`);
          }}
        />
      )}

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
          {removing && hosting.some((r) => String(r.ride.tripId) === String(removing.id) && r.ride.status !== 'cancelled')
            ? 'The car you offered on it is called off, and everyone in it is told. '
            : ''}
          Your other trips stay as they are.
        </p>
      </Sheet>
    </>
  );
}

function TripBlock({
  trip,
  onOpen,
  onShareCar,
  cars,
  meId,
  now,
  stage,
  onSetStage,
  onTellCar,
  onUndo,
  onToggleListing,
  onReopen,
  onRemove,
}: {
  trip: Trip;
  onOpen: (hash: string) => void;
  onShareCar: () => void;
  cars: RideRow[];
  meId: string;
  now: ISODateTime;
  stage?: StageUpdate;
  onSetStage: (stage: JourneyStage) => void;
  onTellCar?: (stage: JourneyStage) => void;
  onUndo: () => void;
  onToggleListing: () => void;
  onReopen: () => void;
  onRemove: () => void;
}) {
  const me = useStore((s) => s.me);
  const settledWith = settledFirstName(trip, me.blocked.map(String));
  const open = tripIsOpen(trip);
  /*
   * Whether the journey itself is still happening — a different question from
   * `open`, which asks whether the board is still suggesting people for it.
   * The rail used to hang off `open`, so agreeing to a coffee with Priya
   * "settled" the trip and took away the one control for telling her you were
   * through security. A trip is over a few hours after its last landing, not
   * when you find someone on it.
   */
  const underway = !tripIsOver(trip, now);
  const board = useBoard();
  const circles = useCircles();
  const onTrip = board.candidates.filter((c) => c.viaTripId === String(trip.id));
  const perTrip = board.perTrip[String(trip.id)];
  const events = destinationEvents(trip, circles);

  /*
   * The photograph is of where you are going, never where you started. A trip
   * block is read while looking forward to it, and OSL → SIN showing Gardermoen
   * in the snow would be answering a question nobody asked.
   *
   * Three answers, in order of how much they know: the last segment's arrival
   * airport; the city, when the trip is a stay with no flights at all, which
   * the city picker allows; and atmosphere keyed off the trip id when neither
   * has photography. That last one is the common case worldwide — five of the
   * 3,270 airports in the index are photographed — so it is the ordinary path,
   * not a fallback for broken data.
   */
  const arrival = trip.segments.at(-1)?.to;
  const stayCity = trip.stays.at(-1)?.cityKey;
  const photo = arrival
    ? destinationPhoto(arrival)
    : cityPhoto(String(stayCity ?? '')) ?? atmosphere(String(trip.id));

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
        ...(s.terminalFrom ? { terminal: terminalLabel(s.terminalFrom) } : {}),
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
      ...(s.terminalTo ? { terminal: terminalLabel(s.terminalTo) } : {}),
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
      {/* Decorative, and deliberately so: the destination is named in the
          timeline three lines below, in text, with its local arrival time. A
          screen reader announcing "the waterfall inside the Jewel at Changi"
          before that would be flavour in front of the facts. */}
      <PlaceBand photo={photo} className="tripblock__photo" />

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

      {underway && (
        <JourneyRail
          trip={trip}
          now={now}
          {...(stage ? { current: stage } : {})}
          onSet={onSetStage}
          {...(onTellCar ? { onTellCar } : {})}
          onUndo={onUndo}
        />
      )}

      <TripPlans trip={trip} now={now} onOpen={onOpen} />

      {cars.length > 0 && (
        <div className="tripblock__cars">
          {cars.map((row) => (
            <RideCard
              key={String(row.ride.id)}
              {...cardProps(row, meId, now)}
              onOpen={() => onOpen(`#/car/${String(row.ride.id)}`)}
            />
          ))}
        </div>
      )}

      <div className="panel__row">
        {trip.outcome ? (
          <>
            <p className="tripblock__note">
              You&rsquo;re meeting {settledWith ?? 'someone'} on this one, so it has
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
        {/* A plan for coffee at the gate is not a way into town. Settling a
            trip stops the board; it does not stop you needing a car. */}
        {underway && (
          <Button size="sm" variant="secondary" onClick={onShareCar}>
            Share a car
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

/**
 * "Café · The coffee bar by the departures board" — the kind, then the words,
 * unless the words already say the kind ("Taxi rank · SIN" needs no second
 * "Taxi rank" in front of it).
 */
function placeLine(place: { kind: keyof typeof PLACE_KIND_LABEL; label: string }): string {
  const kind = PLACE_KIND_LABEL[place.kind];
  return place.label.toLowerCase().includes(kind.toLowerCase()) ? place.label : `${kind} · ${place.label}`;
}

/**
 * What you have actually agreed to on this trip, soonest first.
 *
 * Derived on every render from the rooms and the cars — a plan called off a
 * moment ago is already gone from here. The room is where a plan is made; the
 * trip is where you look when you are working out your evening, so it is where
 * a plan has to be findable without remembering which conversation it was in.
 */
function TripPlans({ trip, now, onOpen }: { trip: Trip; now: ISODateTime; onOpen: (hash: string) => void }) {
  const plans = usePlansForTrip(trip);
  if (plans.length === 0) return null;
  return (
    <section className="tripplans" aria-label={PLAN_COPY.trip.title}>
      <h3 className="tripplans__title">{PLAN_COPY.trip.title}</h3>
      <ul className="tripplans__list">
        {plans.map((p) => {
          const zone = p.meet.place.airportIata
            ? airportIndex.zone(p.meet.place.airportIata)
            : p.meet.place.cityKey
              ? airportIndex.cityZone(p.meet.place.cityKey)
              : undefined;
          return (
            <li key={p.key}>
              <button
                type="button"
                className={`tripplan ${p.doubt ? 'tripplan--doubt' : ''}`}
                onClick={() => onOpen(`#/inbox/${p.channelId}`)}
              >
                <span className="tripplan__when mono">{whenLabel(p.meet.window.from, zone, now)}</span>
                <span className="tripplan__body">
                  <span className="tripplan__title">{p.title}</span>
                  {p.doubt && <span className="tripplan__warn">{PLAN_COPY.strip.doubt}</span>}
                  <span className="tripplan__place">{placeLine(p.meet.place)}</span>
                </span>
                <span className="tripplan__chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * "T3" reads as Terminal 3; "Terminal T3" reads as a bug.
 *
 * Terminals arrive as people read them off a boarding pass, which usually
 * already carries the T — but not always: Heathrow says "T5" and Schiphol says
 * "Departures 2". So the word is added only when the value does not already
 * look like a terminal code, rather than always or never.
 */
const terminalLabel = (t: string): string => (/^[A-Z]?\d/i.test(t.trim()) ? `Terminal ${t}`.replace(/Terminal T/i, 'Terminal ') : t);

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
