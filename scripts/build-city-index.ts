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
 *
 * "Largest" is not in the source data — OurAirports has a `size` column
 * (large/medium/small) but no passenger counts — so among several `large`
 * airports in one metro the first one encountered used to win, and the source
 * rows happen to arrive IATA-alphabetical. That silently anchored Paris on
 * Beauvais (BVA, a low-cost satellite 85km from the city) and London on
 * Gatwick (LGW) rather than Charles de Gaulle or Heathrow. PRIMARY_AIRPORT
 * below is a short, hand-checked override for the metros this product's own
 * routes touch, or that are otherwise unambiguous world hubs; every other
 * multi-airport city keeps the old first-large-wins behaviour rather than
 * risk a wrong guess with no passenger data to check it against.
 */
const PRIMARY_AIRPORT: Record<string, string> = {
  'paris-fr': 'CDG',
  'london-gb': 'LHR',
  'new-york-us': 'JFK',
  'chicago-us': 'ORD',
  'los-angeles-us': 'LAX',
  'san-francisco-us': 'SFO',
  'houston-us': 'IAH',
  'dallas-us': 'DFW',
  'miami-us': 'MIA',
  'moscow-ru': 'SVO',
  'rome-it': 'FCO',
  'milan-it': 'MXP',
  'stockholm-se': 'ARN',
  'oslo-no': 'OSL',
  'frankfurt-am-main-de': 'FRA',
  'istanbul-tr': 'IST',
  'dubai-ae': 'DXB',
  'doha-qa': 'DOH',
  'bangkok-th': 'BKK',
  'beijing-cn': 'PEK',
  'shanghai-cn': 'PVG',
  'seoul-kr': 'ICN',
  'osaka-jp': 'KIX',
  'taipei-tw': 'TPE',
  'jakarta-id': 'CGK',
  'johannesburg-za': 'JNB',
  'sao-paulo-br': 'GRU',
  'rio-de-janeiro-br': 'GIG',
  'buenos-aires-ar': 'EZE',
  'mexico-city-mx': 'MEX',
  'tehran-ir': 'IKA',
  'venice-it': 'VCE',
  'glasgow-gb': 'GLA',
};

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
  /** True once the anchor was set by PRIMARY_AIRPORT rather than first-large-wins. */
  anchorIsPrimary: boolean;
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
      const iata = String(r[idx.iata!]);
      const isLarge = size === 'large';
      const isPrimary = PRIMARY_AIRPORT[key] === iata;
      const existing = cities.get(key);

      if (!existing) {
        cities.set(key, {
          key,
          name: String(r[idx.city!]),
          country: String(r[idx.country!]),
          countryCode: String(r[idx.countryCode!]),
          airports: [iata],
          zone: String(r[idx.zone!]),
          lat: Number(r[idx.lat!]),
          lon: Number(r[idx.lon!]),
          hasLarge: isLarge,
          anchorIsPrimary: isPrimary,
        });
        continue;
      }

      existing.airports.push(iata);
      // A named primary always wins, however it sorts against other large
      // airports; failing that, a large airport outranks a medium one, and
      // among untagged large airports the first one encountered still wins
      // (unchanged behaviour where no PRIMARY_AIRPORT entry exists).
      const shouldAnchor = isPrimary || (isLarge && !existing.hasLarge && !existing.anchorIsPrimary);
      if (shouldAnchor) {
        existing.zone = String(r[idx.zone!]);
        existing.lat = Number(r[idx.lat!]);
        existing.lon = Number(r[idx.lon!]);
        existing.hasLarge = existing.hasLarge || isLarge;
        existing.anchorIsPrimary = existing.anchorIsPrimary || isPrimary;
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
