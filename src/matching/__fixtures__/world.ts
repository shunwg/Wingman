import type {
  Airport,
  AirportIndex,
  City,
  FlightSegment,
  ISODateTime,
  Person,
  StayWindow,
  Trip,
} from '@domain/index';
import { asCityKey, asIata, asSegmentId, asTripId, asUtc } from '@domain/index';
import type { IanaZone } from '@domain/time';
import { makePerson } from '@privacy/__tests__/fixtures';
import { MATCH_CONFIG_V1 } from '../config';
import { layoversFor } from '../travel/layover';

/**
 * A small hand-built world.
 *
 * Eight airports rather than three thousand, because `AirportIndex` is an
 * interface the engine receives as a parameter — a layover rule can be tested
 * against a stub in microseconds, and the tests do not break when the real
 * dataset is rebuilt.
 */

interface Row {
  iata: string;
  city: string;
  cityKey: string;
  zone: string;
  lat: number;
  lon: number;
}

const ROWS: Row[] = [
  { iata: 'OSL', city: 'Oslo', cityKey: 'oslo-no', zone: 'Europe/Oslo', lat: 60.1939, lon: 11.1004 },
  { iata: 'CPH', city: 'Copenhagen', cityKey: 'copenhagen-dk', zone: 'Europe/Copenhagen', lat: 55.6181, lon: 12.656 },
  { iata: 'LHR', city: 'London', cityKey: 'london-gb', zone: 'Europe/London', lat: 51.4706, lon: -0.4619 },
  { iata: 'LGW', city: 'London', cityKey: 'london-gb', zone: 'Europe/London', lat: 51.1537, lon: -0.1821 },
  { iata: 'SIN', city: 'Singapore', cityKey: 'singapore-sg', zone: 'Asia/Singapore', lat: 1.3502, lon: 103.994 },
  { iata: 'NRT', city: 'Tokyo', cityKey: 'tokyo-jp', zone: 'Asia/Tokyo', lat: 35.7647, lon: 140.386 },
  { iata: 'LAX', city: 'Los Angeles', cityKey: 'los-angeles-us', zone: 'America/Los_Angeles', lat: 33.9425, lon: -118.408 },
  { iata: 'AKL', city: 'Auckland', cityKey: 'auckland-nz', zone: 'Pacific/Auckland', lat: -37.008, lon: 174.792 },
];

const airports = new Map<string, Airport>();
const cities = new Map<string, City>();

for (const r of ROWS) {
  const a: Airport = {
    iata: asIata(r.iata),
    name: `${r.city} Airport`,
    city: r.city,
    cityKey: asCityKey(r.cityKey),
    country: r.city,
    countryCode: 'XX',
    lat: r.lat,
    lon: r.lon,
    zone: r.zone as IanaZone,
    size: 'large',
  };
  airports.set(r.iata, a);

  const existing = cities.get(r.cityKey);
  if (existing) existing.airports.push(a.iata);
  else
    cities.set(r.cityKey, {
      key: asCityKey(r.cityKey),
      name: r.city,
      country: r.city,
      countryCode: 'XX',
      airports: [a.iata],
      zone: r.zone as IanaZone,
      lat: r.lat,
      lon: r.lon,
    });
}

export const stubAirports: AirportIndex = {
  get: (iata) => airports.get(iata),
  city: (iata) => {
    const a = airports.get(iata);
    return a ? cities.get(a.cityKey) : undefined;
  },
  zone: (iata) => airports.get(iata)?.zone,
  cityZone: (key) => cities.get(key)?.zone,
  search: (q) => [...airports.values()].filter((a) => a.iata.startsWith(q.toUpperCase())),
  nearest: () => [...airports.values()].slice(0, 3),
};

export const T = (s: string): ISODateTime => asUtc(s);

let segCounter = 0;

export function segment(
  flightNo: string,
  from: string,
  to: string,
  departUtc: string,
  arriveUtc: string,
  terminals?: { from?: string; to?: string },
): FlightSegment {
  return {
    id: asSegmentId(`seg${++segCounter}`),
    flightNo,
    carrier: flightNo.slice(0, 2),
    from: asIata(from),
    to: asIata(to),
    departUtc: T(departUtc),
    arriveUtc: T(arriveUtc),
    ...(terminals?.from ? { terminalFrom: terminals.from } : {}),
    ...(terminals?.to ? { terminalTo: terminals.to } : {}),
    source: 'manual',
    confidence: 1,
  };
}

export function stay(
  cityKey: string,
  from: string,
  to: string,
  arriveUtc: string,
  departUtc: string,
): StayWindow {
  return {
    cityKey: asCityKey(cityKey),
    dates: { from: from as never, to: to as never },
    arriveUtc: T(arriveUtc),
    departUtc: T(departUtc),
  };
}

let tripCounter = 0;

export function trip(
  person: Person,
  segments: FlightSegment[],
  stays: StayWindow[] = [],
  overrides: Partial<Trip> = {},
): Trip {
  const base: Trip = {
    id: asTripId(`trip${++tripCounter}`),
    personId: person.id,
    segments,
    layovers: [],
    stays,
    visibility: { listing: 'listed' },
    createdAt: T('2026-08-01T00:00:00Z'),
    ...overrides,
  };
  return { ...base, layovers: layoversFor(base, MATCH_CONFIG_V1) };
}

/** Two people, open to everything, so filters can be tested one at a time. */
export function openPerson(id: string, overrides: Partial<Person> = {}): Person {
  const p = makePerson({ id, ...overrides });
  return {
    ...p,
    intent: {
      appetite: { social: 0.8, professional: 0.8 },
      openTo: [
        'gate_coffee',
        'lounge',
        'terminal_walk',
        'ride_share',
        'meal',
        'drinks',
        'business_intro',
        'coworking',
      ],
      topics: ['energy', 'cities'],
      languages: ['en'],
      interests: [],
      seeking: [],
      offering: [],
      openToAnyone: false,
      ...overrides.intent,
    },
  };
}

export const NOW = T('2026-09-01T00:00:00Z');
