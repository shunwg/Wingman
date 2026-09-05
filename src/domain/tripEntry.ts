import type { AirportIndex } from './airport';
import type { FlightSegment } from './flight';
import { asSegmentId, type IataCode, type PersonId, type TripId } from './ids';
import { asISODate, localDate, utcFromLocal, type ISODate, type ISODateTime } from './time';
import type { StayWindow, Trip } from './trip';

/**
 * A trip as a person types it.
 *
 * Local strings in, a `Trip` of UTC instants out. This is the only place the
 * two worlds meet: forms hold `SegmentEntry`, everything downstream holds
 * `Trip`, and the conversion goes through `utcFromLocal` exactly once per
 * time. The builder is pure — the caller injects ids and the clock — so it
 * tests without a store and compiles under the no-DOM gate.
 */

/** One leg. `date` and `departLocal` are local to `from`; `arriveLocal` to `to`. */
export interface SegmentEntry {
  from: IataCode;
  to: IataCode;
  date: ISODate;
  /** 'HH:MM', 24-hour. */
  departLocal: string;
  /** 'HH:MM', 24-hour; rolls to the next day if it would precede departure. */
  arriveLocal: string;
  flightNo?: string;
  terminalFrom?: string;
  terminalTo?: string;
}

export interface TripEntry {
  segments: SegmentEntry[];
  /** Absent = passing through; the board still works on the airport window. */
  stay?: { until: ISODate; areaLabel?: string };
  label?: string;
}

export interface TripEntryError {
  /** Dotted path into the entry, e.g. `to`, `segments.1.from`, `stay.until`. */
  field: string;
  message: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const FLIGHT = /^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/i;

export function validateTripEntry(
  e: TripEntry,
  airports: AirportIndex,
  now: ISODateTime,
): TripEntryError[] {
  const errs: TripEntryError[] = [];
  const at = (field: string, message: string) => errs.push({ field, message });

  if (e.segments.length === 0) at('segments', 'Add at least one flight.');

  let prevArrive: ISODateTime | undefined;
  e.segments.forEach((s, i) => {
    const p = i === 0 ? '' : `segments.${i}.`;
    const from = airports.get(s.from);
    const to = airports.get(s.to);
    if (!from) at(`${p}from`, 'Pick an airport from the list.');
    if (!to) at(`${p}to`, 'Pick an airport from the list.');
    if (from && to && s.from === s.to) at(`${p}to`, 'Arrival has to be somewhere else.');
    if (!HHMM.test(s.departLocal)) at(`${p}departLocal`, 'Use 24-hour HH:MM.');
    if (!HHMM.test(s.arriveLocal)) at(`${p}arriveLocal`, 'Use 24-hour HH:MM.');
    if (s.flightNo && !FLIGHT.test(s.flightNo.trim())) {
      at(`${p}flightNo`, 'Looks like SK1465 or BA 767.');
    }
    if (i > 0 && e.segments[i - 1]!.to !== s.from) {
      at(`${p}from`, 'A connection starts where the previous leg landed.');
    }
    if (from && to && HHMM.test(s.departLocal) && HHMM.test(s.arriveLocal)) {
      const { departUtc, arriveUtc } = instants(s, airports);
      if (departUtc <= now) {
        at(
          `${p}date`,
          `That is before ${now.slice(0, 10)}. Wingman only lists journeys ahead of you.`,
        );
      }
      if (prevArrive && departUtc <= prevArrive) {
        at(`${p}departLocal`, 'This leg leaves before the previous one lands.');
      }
      prevArrive = arriveUtc;
    }
  });

  if (e.stay && prevArrive) {
    const last = e.segments[e.segments.length - 1]!;
    const zone = airports.zone(last.to);
    if (zone && e.stay.until < localDate(prevArrive, zone)) {
      at('stay.until', 'You cannot leave before you land.');
    }
  }
  return errs;
}

function instants(s: SegmentEntry, airports: AirportIndex) {
  const fromZone = airports.zone(s.from)!;
  const toZone = airports.zone(s.to)!;
  const departUtc = utcFromLocal(s.date, s.departLocal, fromZone);
  let arriveUtc = utcFromLocal(s.date, s.arriveLocal, toZone);
  if (arriveUtc <= departUtc) arriveUtc = utcFromLocal(nextDay(s.date), s.arriveLocal, toZone);
  return { departUtc, arriveUtc };
}

function nextDay(d: ISODate): ISODate {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return asISODate(t.toISOString().slice(0, 10));
}

/**
 * Build the `Trip`. Assumes `validateTripEntry` returned nothing.
 *
 * `layovers` is left empty on purpose: computing it needs the matching config,
 * and domain/ may not import from matching/. The store attaches them with
 * `layoversFor` when the trip is added — the same convention the seed uses —
 * and the engine recomputes them from segments regardless.
 */
export function buildTripFromEntry(
  e: TripEntry,
  airports: AirportIndex,
  ids: { tripId: TripId; personId: PersonId; now: ISODateTime },
): Trip {
  const segments: FlightSegment[] = e.segments.map((s, i) => {
    const { departUtc, arriveUtc } = instants(s, airports);
    const typed = s.flightNo?.replace(/\s+/g, '').toUpperCase();
    // tripCode() needs a non-empty flight number; an airport pair is the
    // honest name for a leg nobody numbered.
    const flightNo = typed && typed.length > 0 ? typed : `${s.from}–${s.to}`;
    // Lazy on the prefix, so SK1465 splits as SK + 1465 and SAS123 as SAS + 123.
    const carrier = typed ? (typed.match(/^([A-Z0-9]{2,3}?)\d{1,4}[A-Z]?$/)?.[1] ?? '') : '';
    const seg: FlightSegment = {
      id: asSegmentId(`${ids.tripId}.${i}`),
      flightNo,
      carrier,
      from: s.from,
      to: s.to,
      departUtc,
      arriveUtc,
      source: 'manual',
      confidence: 0.75,
    };
    if (s.terminalFrom) seg.terminalFrom = s.terminalFrom;
    if (s.terminalTo) seg.terminalTo = s.terminalTo;
    return seg;
  });

  const last = segments[segments.length - 1]!;
  const stays: StayWindow[] = [];
  if (e.stay) {
    const city = airports.city(last.to)!;
    const zone = airports.zone(last.to)!;
    const stay: StayWindow = {
      cityKey: city.key,
      dates: { from: localDate(last.arriveUtc, zone), to: e.stay.until },
      arriveUtc: last.arriveUtc,
      departUtc: utcFromLocal(e.stay.until, '12:00', zone),
      // The city centroid: coarse on purpose. An area label is a label only —
      // it is never geocoded, so nothing precise enough to find a door exists.
      destination: { lat: city.lat, lon: city.lon, label: e.stay.areaLabel ?? city.name },
    };
    if (e.stay.areaLabel) stay.areaLabel = e.stay.areaLabel;
    stays.push(stay);
  }

  const trip: Trip = {
    id: ids.tripId,
    personId: ids.personId,
    segments,
    layovers: [],
    stays,
    visibility: { listing: 'listed' },
    createdAt: ids.now,
  };
  if (e.label) trip.label = e.label;
  return trip;
}
