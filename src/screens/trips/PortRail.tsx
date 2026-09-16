import { airportIndex } from '@data/airports/index';
import type { FlightSegment, IanaZone, IataCode, ISODateTime, Trip } from '@domain/index';
import { epoch } from '@domain/time';
import { PlaceBand, portPhoto } from '@screens/placePhoto';
import { whenLabel } from '@screens/whenLabel';

/**
 * Where you will be.
 *
 * A rail of the ports your own trips put you in, soonest first: the code, the
 * terminal when the segment knows it, the city, and when. It is a summary of
 * the trip blocks underneath rather than anything new — which is exactly why it
 * earns the space at the top of the screen. The question you open this tab with
 * is "where am I tonight", and answering it used to take reading three tickets.
 *
 * Nothing here is a control. It does not navigate, does not filter, and does
 * not animate: this is a surface people hit several times a day, and the house
 * rule reserves movement for the rare moments. Same reasoning as the feasible
 * kinds on a person card — information, not buttons that do nothing.
 */
export function PortRail({ trips, now }: { trips: Trip[]; now: ISODateTime }) {
  const ports = portsAhead(trips, now);
  // Every port already behind you is a normal state — a trip mid-journey, or
  // one that has simply finished. The rail goes away rather than showing an
  // empty box with a heading on it.
  if (ports.length === 0) return null;

  return (
    <section className="ports">
      <h2 className="homesec__title">Where you will be</h2>
      <ul className="ports__rail">
        {ports.map((p) => (
          <li className="ports__card" key={p.key}>
            <PlaceBand photo={portPhoto(p.iata)} className="ports__photo" />
            <div className="ports__body">
              {/* The terminal rides on the code, unspaced from it in speech —
                  "LHR T2". Absent when the segment does not know it: a made-up
                  terminal sends someone to the wrong end of Heathrow, so an
                  unknown one is left unsaid rather than filled with a dash. */}
              <p className="ports__code mono">{p.terminal ? `${p.iata} ${p.terminal}` : p.iata}</p>
              <p className="ports__city">{p.city}</p>
              <p className="ports__when mono">{whenLabel(p.at, p.zone, now)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface Port {
  key: string;
  iata: IataCode;
  city: string;
  terminal?: string;
  /** The instant you are there — a departure or an arrival. */
  at: ISODateTime;
  /** Absent for the handful of airports whose row carries no zone. */
  zone?: IanaZone;
}

/**
 * Eight is enough.
 *
 * A rail is for glancing at, and someone with six trips booked does not want
 * to swipe through twenty cards to find out about tonight. The trip blocks
 * below are the complete record; this is the top of it.
 */
const MAX_PORTS = 8;

/**
 * The ports still ahead of you, across every trip, in time order.
 *
 * Derived on read like every other list in this app (rule 2) — a cached rail
 * would survive the trip that was deleted out from under it.
 */
function portsAhead(trips: Trip[], now: ISODateTime): Port[] {
  const out: Port[] = [];
  for (const trip of trips) {
    trip.segments.forEach((s, i) => {
      // Your own departure is a port too — tonight's terminal is the one you
      // are leaving from. Later departures are usually the previous leg's
      // arrival, so they are only added when the itinerary actually breaks and
      // the traveller has to be somewhere new.
      const previous = i > 0 ? trip.segments[i - 1] : undefined;
      if (!previous || previous.to !== s.from) out.push(portOf(trip, s, 'from'));
      out.push(portOf(trip, s, 'to'));
    });
  }
  return out
    .filter((p) => epoch(p.at) >= epoch(now))
    .sort((a, b) => epoch(a.at) - epoch(b.at))
    .slice(0, MAX_PORTS);
}

function portOf(trip: Trip, s: FlightSegment, end: 'from' | 'to'): Port {
  const iata = end === 'from' ? s.from : s.to;
  return {
    key: `${String(trip.id)}-${String(s.id)}-${end}`,
    iata,
    // The index knows every airport it has; falling back to the code keeps a
    // card readable rather than blank if it ever does not.
    city: airportIndex.get(iata)?.city ?? iata,
    terminal: end === 'from' ? s.terminalFrom : s.terminalTo,
    at: end === 'from' ? s.departUtc : s.arriveUtc,
    zone: airportIndex.zone(iata),
  };
}

