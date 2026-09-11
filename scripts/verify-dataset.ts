/**
 * Dataset integrity gate.
 *
 *     npx tsx scripts/verify-dataset.ts
 *
 * This runs as part of `npm run build` and is allowed to fail the build. The
 * assertion that earns its keep is the timezone one: the source data has no
 * zone column, zones are derived from coordinates, and a single airport with a
 * missing or bogus zone produces layover maths that is wrong without looking
 * wrong. Better a red build than a plausible lie.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'airports');

interface Payload { columns: string[]; rows: (string | number)[][] }
interface CityRow { key: string; airports: string[]; zone: string; name: string; lat: number; lon: number }

const read = <T>(f: string): T => JSON.parse(readFileSync(join(OUT, f), 'utf8')) as T;

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);

/** A zone is only real if Intl will actually format with it. */
function zoneIsValid(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function main() {
  const large = read<Payload>('airports.large.json');
  const medium = read<Payload>('airports.medium.json');
  const cities = read<CityRow[]>('cities.json');

  const idx = Object.fromEntries(large.columns.map((c, i) => [c, i])) as Record<string, number>;
  const all = [...large.rows, ...medium.rows];

  if (large.columns.join() !== medium.columns.join()) {
    fail('large and medium airport files disagree on column order');
  }
  if (all.length < 3000) fail(`expected 3000+ airports, got ${all.length}`);

  const seenIata = new Set<string>();
  const validZones = new Map<string, boolean>();
  const cityKeys = new Set(cities.map((c) => c.key));

  for (const r of all) {
    const iata = String(r[idx.iata!]);
    const zone = String(r[idx.zone!]);
    const lat = Number(r[idx.lat!]);
    const lon = Number(r[idx.lon!]);
    const cityKey = String(r[idx.cityKey!]);

    if (!/^[A-Z]{3}$/.test(iata)) fail(`bad IATA code: ${JSON.stringify(iata)}`);
    if (seenIata.has(iata)) fail(`duplicate IATA code: ${iata}`);
    seenIata.add(iata);

    if (!zone) {
      fail(`${iata} has no timezone — every layover calculation depends on this`);
    } else {
      let ok = validZones.get(zone);
      if (ok === undefined) { ok = zoneIsValid(zone); validZones.set(zone, ok); }
      if (!ok) fail(`${iata} has an invalid IANA zone: ${JSON.stringify(zone)}`);
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) fail(`${iata} latitude out of range: ${lat}`);
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) fail(`${iata} longitude out of range: ${lon}`);
    if (!cityKeys.has(cityKey)) fail(`${iata} references unknown cityKey ${JSON.stringify(cityKey)}`);
  }

  // Spot-check the hub metros the same-city rule most depends on. These are the
  // groupings municipality strings get wrong, so they are checked explicitly.
  const expectMulti: Record<string, string[]> = {
    'london-gb': ['LHR', 'LGW', 'LCY', 'STN'],
    'paris-fr': ['CDG', 'ORY', 'LBG'],
    'new-york-us': ['JFK', 'LGA', 'EWR'],
    'tokyo-jp': ['NRT', 'HND'],
    'sao-paulo-br': ['GRU', 'CGH'],
    'san-francisco-us': ['SFO', 'OAK', 'SJC'],
    'washington-us': ['DCA', 'IAD', 'BWI'],
    'istanbul-tr': ['IST', 'SAW'],
  };
  for (const [key, expected] of Object.entries(expectMulti)) {
    const city = cities.find((c) => c.key === key);
    if (!city) { fail(`expected a city entry for ${key}`); continue; }
    for (const iata of expected) {
      if (!city.airports.includes(iata)) fail(`${key} should include ${iata}, has ${city.airports.join(',')}`);
    }
  }

  // A multi-airport city's canonical lat/lon comes from whichever airport
  // build-city-index.ts picked as the anchor. With no passenger data to rank
  // them, "largest" defaults to "first large airport encountered" unless
  // PRIMARY_AIRPORT names one explicitly — which is how Paris silently
  // anchored on Beauvais (85km out) and London on Gatwick instead of Heathrow.
  // This pins the anchor for the metros this product's own routes touch, so a
  // dataset rebuild can't drift back without failing loudly.
  const expectAnchor: Record<string, string> = {
    'paris-fr': 'CDG',
    'london-gb': 'LHR',
    'oslo-no': 'OSL',
  };
  for (const [key, primaryIata] of Object.entries(expectAnchor)) {
    const city = cities.find((c) => c.key === key);
    const row = all.find((r) => String(r[idx.iata!]) === primaryIata);
    if (!city || !row) { fail(`cannot check anchor for ${key} — missing city or ${primaryIata}`); continue; }
    const lat = Number(row[idx.lat!]);
    const lon = Number(row[idx.lon!]);
    if (Math.abs(city.lat - lat) > 1e-6 || Math.abs(city.lon - lon) > 1e-6) {
      fail(`${key} should anchor on ${primaryIata} (${lat},${lon}), anchors on (${city.lat},${city.lon})`);
    }
  }

  if (failures.length > 0) {
    console.error(`Dataset verification FAILED — ${failures.length} problem(s):`);
    for (const f of failures.slice(0, 25)) console.error(`  · ${f}`);
    if (failures.length > 25) console.error(`  … and ${failures.length - 25} more`);
    process.exit(1);
  }

  console.log(
    `  verified ${all.length} airports · ${validZones.size} distinct zones · ${cities.length} cities — all sound`,
  );
}

main();
