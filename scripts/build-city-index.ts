/**
 * Group airports into cities.
 *
 *     npx tsx scripts/build-city-index.ts   (run after build-airports.ts)
 *
 * Why this file exists: "we are both in London on Thursday" has to be true
 * across Heathrow, Gatwick, City, Stansted and Luton. Matching on IATA codes
 * would silently miss most same-city overlaps in exactly the hub cities where
 * they are most likely — which would look like the app having no users rather
 * than like a bug.
 *
 * The city's canonical coordinates and zone are taken from its largest airport,
 * which is a good enough anchor for "same city" and is never used for anything
 * that needs real precision.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'data', 'airports');

interface Payload {
  columns: string[];
  rows: (string | number)[][];
}

const read = (f: string): Payload => JSON.parse(readFileSync(join(OUT, f), 'utf8')) as Payload;

interface CityAccum {
  key: string;
  name: string;
  country: string;
  countryCode: string;
  airports: string[];
  zone: string;
  lat: number;
  lon: number;
  hasLarge: boolean;
}

function main() {
  const large = read('airports.large.json');
  const medium = read('airports.medium.json');

  const idx = Object.fromEntries(large.columns.map((c, i) => [c, i])) as Record<string, number>;
  const cities = new Map<string, CityAccum>();

  const ingest = (rows: (string | number)[][]) => {
    for (const r of rows) {
      const key = String(r[idx.cityKey!]);
      const size = String(r[idx.size!]);
      const isLarge = size === 'large';
      const existing = cities.get(key);

      if (!existing) {
        cities.set(key, {
          key,
          name: String(r[idx.city!]),
          country: String(r[idx.country!]),
          countryCode: String(r[idx.countryCode!]),
          airports: [String(r[idx.iata!])],
          zone: String(r[idx.zone!]),
          lat: Number(r[idx.lat!]),
          lon: Number(r[idx.lon!]),
          hasLarge: isLarge,
        });
        continue;
      }

      existing.airports.push(String(r[idx.iata!]));
      // A large airport outranks a medium one as the city's anchor.
      if (isLarge && !existing.hasLarge) {
        existing.zone = String(r[idx.zone!]);
        existing.lat = Number(r[idx.lat!]);
        existing.lon = Number(r[idx.lon!]);
        existing.hasLarge = true;
      }
    }
  };

  ingest(large.rows);
  ingest(medium.rows);

  const out = [...cities.values()]
    .map((c) => ({
      key: c.key,
      name: c.name,
      country: c.country,
      countryCode: c.countryCode,
      airports: c.airports.sort(),
      zone: c.zone,
      lat: c.lat,
      lon: c.lon,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  writeFileSync(join(OUT, 'cities.json'), JSON.stringify(out));

  const multi = out.filter((c) => c.airports.length > 1);
  console.log(`  wrote cities.json — ${out.length} cities, ${multi.length} with several airports`);
  const biggest = [...multi].sort((a, b) => b.airports.length - a.airports.length).slice(0, 3);
  for (const c of biggest) console.log(`    ${c.name}: ${c.airports.join(', ')}`);
}

main();
