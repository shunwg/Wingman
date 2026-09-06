import { useRef } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { PersonCard } from '@design/patterns/PersonCard';
import { CircleCrest } from '@design/patterns/CircleCrest';
import { tripCode, tripDestination } from '@domain/trip';
import { tripHueClass } from '@design/tokens/tripHue';
import { bucketPhrase } from '@lib/bucket';
import { airportIndex, cityByKey } from '@data/airports/index';
import { useHome } from '@state/selectors/home';
import { useEventBoards } from '@state/selectors/event';
import { useIncomingCards, expiresIn } from '@state/selectors/requests';
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
  const { trip, match, othersOnTrip, events, liveEventIds } = useHome();
  const live = useEventBoards();
  const incoming = useIncomingCards();
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

      {trip && (
        <section className="homesec">
          <h2 className="homesec__title">Your next journey</h2>
          <button type="button" className={`journey ${tripHueClass(tripCode(trip))}`} onClick={() => onOpen('#/trip')}>
            <span className="journey__route mono">
              {[trip.segments[0]?.from, ...trip.segments.map((s) => s.to)].filter(Boolean).join(' → ')}
            </span>
            <span className="journey__meta">
              {tripDates(trip)}
              {' · '}
              {trip.segments.length === 1 ? '1 flight' : `${trip.segments.length} flights`}
              {trip.layovers[0] ? ` · ${trip.layovers[0].usableMin} min in ${trip.layovers[0].airport}` : ''}
            </span>
            <Chip tone="trust">Looking</Chip>
          </button>
        </section>
      )}

      {live.map((e) => (
        <section className="homesec eventboard" key={String(e.circle.id)}>
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

