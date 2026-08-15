import type { Airport, AirportIndex, City } from '@domain/airport';
import type { CityKey, IataCode } from '@domain/ids';
import type { IanaZone } from '@domain/time';
import { haversineM } from '@lib/geo';
import largeData from './airports.large.json';
import citiesData from './cities.json';

/**
 * The bundled worldwide airport index.
 *
 * Airport data is deliberately *not* a provider concern. Searching for an
 * airport is the very first thing a new user does, and making that depend on a
 * network call — or worse, on an API key — would mean the app appears broken to
 * someone with no signal at a gate, which is precisely where they are.
 *
 * So: 1,154 large airports load eagerly (~136 KB), and the 2,116 medium ones
 * are fetched as a separate chunk only when a query misses the large set. Live
 * flight providers layer *schedules* on top; they never gate *geography*.
 *
 * Rows are stored as tuples rather than objects — it roughly halves the payload
 * and costs one inflate pass at startup.
 */

type Row = [
  iata: string,
  name: string,
  city: string,
  cityKey: string,
  country: string,
  countryCode: string,
  lat: number,
  lon: number,
  zone: string,
  size: string,
];

interface Payload {
  columns: string[];
  rows: Row[];
}

interface CityRow {
  key: string;
  name: string;
  country: string;
  countryCode: string;
  airports: string[];
  zone: string;
  lat: number;
  lon: number;
}

const inflate = (r: Row): Airport => ({
  iata: r[0] as IataCode,
  name: r[1],
  city: r[2],
  cityKey: r[3] as CityKey,
  country: r[4],
  countryCode: r[5],
  lat: r[6],
  lon: r[7],
  zone: r[8] as IanaZone,
  size: r[9] as 'large' | 'medium',
});

const byIata = new Map<string, Airport>();
const byCityKey = new Map<string, City>();

for (const row of (largeData as Payload).rows) {
  const a = inflate(row);
  byIata.set(a.iata, a);
}

for (const c of citiesData as CityRow[]) {
  byCityKey.set(c.key, {
    key: c.key as CityKey,
    name: c.name,
    country: c.country,
    countryCode: c.countryCode,
    airports: c.airports as IataCode[],
    zone: c.zone as IanaZone,
    lat: c.lat,
    lon: c.lon,
  });
}

let mediumLoaded = false;
let mediumLoading: Promise<void> | null = null;

/**
 * Pull in the medium-airport chunk.
 *
 * Called when a search finds nothing among the large airports — someone flying
 * into Bodø or Bergamo should still find their airport, just a beat later.
 */
export async function loadMediumAirports(): Promise<void> {
  if (mediumLoaded) return;
  if (mediumLoading) return mediumLoading;
  mediumLoading = import('./airports.medium.json').then((mod) => {
    for (const row of (mod.default as Payload).rows) {
      const a = inflate(row);
      if (!byIata.has(a.iata)) byIata.set(a.iata, a);
    }
    mediumLoaded = true;
  });
  return mediumLoading;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Search ranking.
 *
 * Ordered so the obvious intent wins: typing "OSL" must put Gardermoen first,
 * and typing "lon" must put the London airports above Londrina. Large airports
 * outrank medium ones at equal relevance, because the traveller typing three
 * letters is far more often heading to a hub.
 */
function score(a: Airport, q: string): number {
  const iata = a.iata.toLowerCase();
  const city = norm(a.city);
  const name = norm(a.name);

  if (iata === q) return 1000;
  let s = 0;
  if (city === q) s = 800;
  else if (city.startsWith(q)) s = 600;
  else if (name.startsWith(q)) s = 500;
  else if (city.includes(q)) s = 300;
  else if (name.includes(q)) s = 200;
  else if (iata.startsWith(q)) s = 150;
  else return 0;

  return s + (a.size === 'large' ? 40 : 0);
}

export { haversineM };

export const airportIndex: AirportIndex = {
  get: (iata) => byIata.get(iata),

  city(iata) {
    const a = byIata.get(iata);
    return a ? byCityKey.get(a.cityKey) : undefined;
  },

  zone(iata) {
    return byIata.get(iata)?.zone;
  },

  cityZone(city) {
    return byCityKey.get(city)?.zone;
  },

  search(query, limit = 8) {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    const hits: { a: Airport; s: number }[] = [];
    for (const a of byIata.values()) {
      const s = score(a, q);
      if (s > 0) hits.push({ a, s });
    }
    hits.sort((x, y) => y.s - x.s || x.a.city.localeCompare(y.a.city));
    return hits.slice(0, limit).map((h) => h.a);
  },

  nearest(lat, lon, limit = 5) {
    const hits: { a: Airport; d: number }[] = [];
    for (const a of byIata.values()) {
      hits.push({ a, d: haversineM(lat, lon, a.lat, a.lon) });
    }
    hits.sort((x, y) => x.d - y.d);
    return hits.slice(0, limit).map((h) => h.a);
  },
};

/** All known cities — used by the city picker for stay-only trips. */
export const allCities = (): City[] => [...byCityKey.values()];

export const cityByKey = (key: CityKey): City | undefined => byCityKey.get(key);

/** Whether the medium chunk is in memory; drives the "searching more…" hint. */
export const hasMediumAirports = (): boolean => mediumLoaded;

export const airportCount = (): number => byIata.size;
