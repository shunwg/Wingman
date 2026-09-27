import { useRef } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { PersonCard } from '@design/patterns/PersonCard';
import { CircleCrest } from '@design/patterns/CircleCrest';
import { VenueBand } from '@screens/placePhoto';
import { tripCode, tripDestination } from '@domain/trip';
import { tripHueClass } from '@design/tokens/tripHue';
import { bucketPhrase } from '@lib/bucket';
import { airportIndex, cityByKey } from '@data/airports/index';
import { settledFirstName, useHome } from '@state/selectors/home';
import { whenLabel, windowLabel } from '@screens/whenLabel';
import { useEventBoards } from '@state/selectors/event';
import { useIncomingCards, useSaidYes, expiresIn } from '@state/selectors/requests';
import { useJoinableRides, useSeatAsks } from '@state/selectors/rides';
import { Route } from '@design/icons/Route';
import { markArriving } from '@screens/inbox/arrive';
import { MEET_KIND_LABEL } from '@data/copy/meetKinds';
import { useStore } from '@state/store';
import { takeMoment } from './moment';

/**
 * Home.
 *
 * Not a feed. A quiet layer over the journey that says: here is where you are
 * going, here is the one person worth meeting because of it, here is what is
 * on when you land. Twenty people are one tap away under "See all"; one person
 * is the screen.
 */
export function HomeScreen({ onOpen }: { onOpen: (hash: string) => void }) {
  const { trip, journey, match, othersOnTrip, events, liveEventIds } = useHome();
  const live = useEventBoards();
  const incoming = useIncomingCards();
  const saidYes = useSaidYes();
  const seatAsks = useSeatAsks();
  const cars = useJoinableRides();
  const setFilters = useStore((s) => s.setFilters);
  const now = useStore((s) => s.now);
  const myTrips = useStore((s) => s.myTrips);

  // Once, for this person, in this session.
  const moment = useRef(match ? takeMoment(String(match.person.id)) : false).current;

  if (myTrips.length === 0 && live.length === 0) {
    return (
      <div className="empty">
        <h2 className="empty__title display">Your board is waiting for a flight</h2>
        <p className="empty__body">
          Wingman only shows you people around a journey. Add the next one and this fills in.
        </p>
        <Button onClick={() => onOpen('#/trip/new')}>Add a flight</Button>
      </div>
    );
  }

  return (
    <>
      {incoming.length > 0 && (
        <button type="button" className="homerow homerow--ask" onClick={() => onOpen('#/inbox')}>
          <Avatar spec={incoming[0]!.card.avatar} size="sm" />
          <span className="homerow__body">
            <span className="homerow__title">
              {incoming[0]!.card.displayName as string} asked to meet
            </span>
            <span className="homerow__meta mono">
              {expiresIn(incoming[0]!.request, String(now)) ?? 'Waiting'}
              {incoming.length > 1 ? ` · ${incoming.length - 1} more` : ''}
            </span>
          </span>
          <span className="homerow__chevron" aria-hidden="true">›</span>
        </button>
      )}

      {/* A seat asked for in your car. Waiting on you, so it sits with the
          other things that are. */}
      {seatAsks.length > 0 && (
        <button
          type="button"
          className="homerow homerow--ask"
          onClick={() => onOpen(`#/car/${String(seatAsks[0]!.ride.id)}`)}
        >
          <Avatar spec={seatAsks[0]!.card.avatar} size="sm" />
          <span className="homerow__body">
            <span className="homerow__title">
              {typeof seatAsks[0]!.card.displayName === 'string'
                ? seatAsks[0]!.card.displayName.split(' ')[0]
                : 'Someone'}{' '}
              asked for a seat in your car
            </span>
            <span className="homerow__meta">
              {seatAsks[0]!.route.from} → {seatAsks[0]!.route.to} ·{' '}
              {windowLabel(seatAsks[0]!.ride.window.from, seatAsks[0]!.ride.window.to, airportIndex.zone(seatAsks[0]!.ride.airportIata), now)}
              {seatAsks.length > 1 ? ` · ${bucketPhrase(seatAsks.length - 1, 'more', 'more')}` : ''}
            </span>
          </span>
          <span className="homerow__chevron" aria-hidden="true">
            ›
          </span>
        </button>
      )}

      {/* Someone said yes to you. The rarest good news the app has, so it sits
          at the top and opens the room with the one moment that animates. It
          goes away once the room has been opened — derived from when you last
          read it, so nothing is stored to say it was shown. */}
      {saidYes.map((y) => {
        const name = typeof y.card.displayName === 'string' ? y.card.displayName.split(' ')[0]! : 'They';
        return (
          <button
            key={y.channelId}
            type="button"
            className="homerow homerow--yes"
            onClick={() => {
              markArriving(y.channelId);
              onOpen(`#/inbox/${y.channelId}`);
            }}
          >
            <Avatar spec={y.card.avatar} size="sm" />
            <span className="homerow__body">
              <span className="homerow__title">{name} said yes</span>
              <span className="homerow__meta">
                {MEET_KIND_LABEL[y.request.proposal.kind]} · the room is open
              </span>
            </span>
            <span className="homerow__chevron" aria-hidden="true">
              ›
            </span>
          </button>
        );
      })}

      {journey && (
        <section className="homesec">
          <h2 className="homesec__title">Your next journey</h2>
          <button type="button" className={`journey ${tripHueClass(tripCode(journey))}`} onClick={() => onOpen('#/trip')}>
            <span className="journey__route mono">
              {[journey.segments[0]?.from, ...journey.segments.map((s) => s.to)].filter(Boolean).join(' → ')}
            </span>
            <span className="journey__meta">
              {tripDates(journey)}
              {' · '}
              {journey.segments.length === 1 ? '1 flight' : `${journey.segments.length} flights`}
              {journey.layovers[0] ? ` · ${journey.layovers[0].usableMin} min in ${journey.layovers[0].airport}` : ''}
            </span>
            <DepartureLine trip={journey} now={now} />
            {journey.outcome ? (
              <span className="journey__meta">
                You are meeting {settledFirstName(journey) ?? 'someone'} on this one.
              </span>
            ) : null}
            {journey.outcome ? (
              <Chip tone="trust">Sorted</Chip>
            ) : journey.visibility.listing === 'hidden' ? (
              <Chip tone="warn">Hidden</Chip>
            ) : (
              <Chip tone="trust">Looking</Chip>
            )}
          </button>
          {/* Cars going your way, one tap from the page you look at while
              walking. The cohort persona's first complaint, two rounds
              running: the feature did not exist on Home. */}
          {cars.rows.length > 0 && (
            <button
              type="button"
              className="homerow"
              onClick={() => {
                setFilters({ lens: 'shared_cars' });
                onOpen('#/discover');
              }}
            >
              <span className="homerow__glyph" aria-hidden="true">
                <Route size={18} />
              </span>
              <span className="homerow__body">
                <span className="homerow__title">{capitalised(bucketPhrase(cars.rows.length, 'shared car', 'shared cars'))} going your way</span>
                <span className="homerow__meta">Take a seat, or offer your own from Trips</span>
              </span>
              <span className="homerow__chevron" aria-hidden="true">
                ›
              </span>
            </button>
          )}
        </section>
      )}

      {live.map((e) => (
        <section className="homesec eventboard" key={String(e.circle.id)}>
          {/* Home's version of this card never prints the venue at all — it
              has the circle's short name and the days left, and that is it.
              So the photograph is the only thing saying *where*, which is both
              why it belongs here and why its caption is real alt text rather
              than an empty one. */}
          <VenueBand venue={e.circle.venue} />
          <div className="homesec__head">
            <h2 className="homesec__title">At {e.circle.shortName}</h2>
            <span className="homesec__meta mono">
              {e.daysLeft === 0 ? 'last day' : `${e.daysLeft} ${e.daysLeft === 1 ? 'day' : 'days'} left`}
            </span>
          </div>
          {e.members.length === 0 ? (
            <p className="panel__note">Nobody here has chosen to be seen yet.</p>
          ) : (
            <div className="board">
              {e.members.slice(0, 3).map((p) => (
                <PersonCard key={String(p.id)} person={p} context={'At ' + e.circle.shortName} layout="row" onClick={() => onOpen(`#/person/${String(p.id)}`)} />
              ))}
            </div>
          )}
          <button type="button" className="homesec__more" onClick={() => onOpen(`#/circles/${String(e.circle.id)}`)}>
            Open {e.circle.shortName} ›
          </button>
        </section>
      ))}

      {trip && (
        <section className="homesec">
          <div className="homesec__head">
            <h2 className="homesec__title">
              {match && moment ? `Your paths cross ${crossing(match, trip)}` : 'People worth meeting'}
            </h2>
            {/* When the board's trip is not the journey above, say which — a
                "06:40–07:20" under "Leaves LHR 21:00 tonight" read as tonight. */}
            {journey && String(journey.id) !== String(trip.id) && (
              <span className="homesec__meta homesec__trip mono">
                {tripCode(trip)} · {tripDates(trip)}
              </span>
            )}
            {othersOnTrip > 0 && (
              <button type="button" className="homesec__more" onClick={() => onOpen('#/discover')}>
                See all ›
              </button>
            )}
          </div>

          {match ? (
            <div className={moment ? 'moment' : undefined}>
              <PersonCard
                person={match.person}
                context={match.receipt.headline}
                elevated
                onClick={() => onOpen(`#/person/${String(match.person.id)}/${match.viaTripId}`)}
                footer={
                  <div className="pcard__footer">
                    <p className="pcard__why">{match.receipt.suggestion}</p>
                    <div className="pcard__chips">
                      {match.receipt.lines.slice(0, 3).map((l) => (
                        <Chip key={l.label} tone="neutral" {...(l.mono ? { mono: true } : {})}>
                          {l.value}
                        </Chip>
                      ))}
                    </div>
                  </div>
                }
              />
              <Button full onClick={() => onOpen(`#/person/${String(match.person.id)}/${match.viaTripId}`)}>
                Say hello
              </Button>
            </div>
          ) : (
            <p className="panel__note">
              Nobody overlapping yet. Your trip stays listed, and anyone who books onto it appears here.
            </p>
          )}
        </section>
      )}

      {events.length > 0 && (
        <section className="homesec">
          <h2 className="homesec__title">Upcoming at your destination</h2>
          <div className="homelist">
            {events.map((c) => (
              <button type="button" className="homerow" key={String(c.id)} onClick={() => onOpen(`#/circles/${String(c.id)}`)}>
                <CircleCrest shortName={c.shortName} {...(c.crestUrl ? { crestUrl: c.crestUrl } : {})} size="sm" />
                <span className="homerow__body">
                  <span className="homerow__title">{c.name}</span>
                  <span className="homerow__meta">
                    {runsLabel(c.runs!)} · {bucketPhrase(c.memberCount, 'member', 'members')}
                    {liveEventIds.has(String(c.id)) ? ' · on now' : ''}
                  </span>
                </span>
                <span className="homerow__chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/**
 * "Leaves LHR 21:00 tonight" — the one time a traveller checks on the way to
 * the gate, in the airport's own clock. Only within a day: a departure a week
 * out is already in the dates above and repeating it is noise.
 */
function DepartureLine({ trip, now }: { trip: Parameters<typeof tripDestination>[0]; now: string }) {
  const next = trip.segments.find((s) => Date.parse(String(s.departUtc)) > Date.parse(now));
  if (!next) return null;
  const hoursAway = (Date.parse(String(next.departUtc)) - Date.parse(now)) / 3_600_000;
  if (hoursAway > 24) return null;
  const zone = airportIndex.zone(next.from);
  return (
    <span className="journey__leaves mono">
      Leaves {String(next.from)} {whenLabel(next.departUtc, zone, now as never).toLowerCase().replace(/^(\w+) (.+)$/, '$2 $1')}
    </span>
  );
}

/** "a few shared cars" at the start of a line. */
const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "in Singapore" or "on SQ317" — the place the paths cross. */
function crossing(match: { overlap: { kind: string } & Record<string, unknown> }, trip: Parameters<typeof tripDestination>[0]): string {
  const o = match.overlap;
  if (o.kind === 'same_flight') return `on ${String(o.flightNo)}`;
  if (o.kind === 'shared_layover' || o.kind === 'same_airport_window') {
    const iata = String(o.airport);
    return `at ${airportIndex.get(iata as never)?.city ?? iata}`;
  }
  const stay = trip.stays[0];
  const city = stay ? cityByKey(stay.cityKey)?.name : undefined;
  return `in ${city ?? tripDestination(trip) ?? 'the same city'}`;
}

/** "3–6 Sep 2026", local to each end of the journey. */
function tripDates(trip: Parameters<typeof tripDestination>[0]): string {
  const first = trip.segments[0];
  const stay = trip.stays.at(-1);
  if (!first) return '';
  const fromZone = airportIndex.zone(first.from);
  const start = new Date(first.departUtc);
  const endIso = stay?.dates.to ?? trip.segments.at(-1)!.arriveUtc.slice(0, 10);
  const end = new Date(`${endIso}T12:00:00Z`);
  const day = (d: Date, zone?: string) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', ...(zone ? { timeZone: zone } : {}) });
  const monthYear = end.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return sameMonth
    ? `${day(start, fromZone)}–${day(end)} ${monthYear}`
    : `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: fromZone })} – ${day(end)} ${monthYear}`;
}

function runsLabel(r: { from: string; to: string }): string {
  const a = new Date(`${r.from}T12:00:00Z`);
  const b = new Date(`${r.to}T12:00:00Z`);
  const md = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${md(b)}`
    : `${md(a)} – ${md(b)}`;
}

