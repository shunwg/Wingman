/**
 * Build the bundled worldwide airport dataset.
 *
 *     npx tsx scripts/build-airports.ts
 *
 * Source: OurAirports (public domain) — https://ourairports.com/data/
 *
 * The one thing this script exists to fix: **the source data has no timezone
 * column.** Every layover, "landing the same night" and "overlapping stay"
 * computation in the matching engine depends on knowing an airport's local
 * zone, and without one those answers are wrong in a way that looks plausible —
 * off by a few hours, only for some airports. So the zone is derived here from
 * coordinates, at build time, and `verify-dataset.ts` fails the build if a
 * single airport is missing one.
 *
 * tz-lookup is a build-time dependency only. Nothing from it ships.
 */

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const tzlookup = require('tz-lookup') as (lat: number, lon: number) => string;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CACHE = join(HERE, '.cache');
const OUT = join(ROOT, 'src', 'data', 'airports');

const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const COUNTRIES_URL = 'https://davidmegginson.github.io/ourairports-data/countries.csv';

/** Column order for the emitted tuple rows. Mirrored in data/airports/index.ts. */
export const COLUMNS = [
  'iata', 'name', 'city', 'cityKey', 'country', 'countryCode', 'lat', 'lon', 'zone', 'size',
] as const;

/**
 * RFC4180-ish CSV parser.
 *
 * Hand-rolled rather than pulled from npm because OurAirports rows contain
 * commas inside quoted names ("Paris, Charles de Gaulle") and escaped quotes,
 * and a naive split produces a dataset that is subtly wrong for exactly the
 * large international airports that matter most here.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (c === '\r') continue;
    field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchCached(url: string, filename: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, filename);
  if (existsSync(path)) {
    console.log(`  using cached ${filename}`);
    return readFileSync(path, 'utf8');
  }
  console.log(`  downloading ${filename}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const text = await res.text();
  writeFileSync(path, text);
  return text;
}

/**
 * Metropolitan groupings.
 *
 * Municipality strings alone do not produce the groupings this product needs.
 * Two failure modes, both caught by verify-dataset.ts:
 *
 *   · Qualifiers — CDG is filed under `Paris (Roissy-en-France, Val-d'Oise)`
 *     and ORY under `Paris (Orly, Val-de-Marne)`, so a naive slug puts the two
 *     main Paris airports in different cities from each other.
 *   · Genuinely different municipalities that are one metro to a traveller —
 *     Newark is not New York, but somebody landing at EWR is in New York for
 *     the purposes of "free for dinner on Thursday".
 *
 * Getting this wrong looks like the app having no users rather than like a bug,
 * because it silently suppresses same-city matches in precisely the hub cities
 * where they are most likely.
 */
const METRO: Record<string, { key: string; name: string }> = Object.create(null) as Record<
  string,
  { key: string; name: string }
>;

const METRO_GROUPS: [key: string, name: string, iatas: string[]][] = [
  ['london-gb', 'London', ['LHR', 'LGW', 'LCY', 'STN', 'LTN', 'SEN']],
  ['paris-fr', 'Paris', ['CDG', 'ORY', 'LBG', 'BVA']],
  ['new-york-us', 'New York', ['JFK', 'LGA', 'EWR', 'HPN', 'SWF']],
  ['tokyo-jp', 'Tokyo', ['NRT', 'HND']],
  ['osaka-jp', 'Osaka', ['KIX', 'ITM', 'UKB']],
  ['seoul-kr', 'Seoul', ['ICN', 'GMP']],
  ['shanghai-cn', 'Shanghai', ['PVG', 'SHA']],
  ['beijing-cn', 'Beijing', ['PEK', 'PKX']],
  ['bangkok-th', 'Bangkok', ['BKK', 'DMK']],
  ['jakarta-id', 'Jakarta', ['CGK', 'HLP']],
  ['milan-it', 'Milan', ['MXP', 'LIN', 'BGY']],
  ['rome-it', 'Rome', ['FCO', 'CIA']],
  ['venice-it', 'Venice', ['VCE', 'TSF']],
  ['stockholm-se', 'Stockholm', ['ARN', 'BMA', 'NYO', 'VST']],
  ['oslo-no', 'Oslo', ['OSL', 'TRF', 'RYG']],
  ['chicago-us', 'Chicago', ['ORD', 'MDW']],
  ['washington-us', 'Washington DC', ['DCA', 'IAD', 'BWI']],
  ['san-francisco-us', 'San Francisco Bay', ['SFO', 'OAK', 'SJC']],
  ['los-angeles-us', 'Los Angeles', ['LAX', 'BUR', 'LGB', 'SNA', 'ONT']],
  ['houston-us', 'Houston', ['IAH', 'HOU']],
  ['dallas-us', 'Dallas', ['DFW', 'DAL']],
  ['miami-us', 'Miami', ['MIA', 'FLL']],
  ['toronto-ca', 'Toronto', ['YYZ', 'YTZ']],
  ['montreal-ca', 'Montréal', ['YUL', 'YMX']],
  ['moscow-ru', 'Moscow', ['SVO', 'DME', 'VKO', 'ZIA']],
  ['istanbul-tr', 'Istanbul', ['IST', 'SAW']],
  ['dubai-ae', 'Dubai', ['DXB', 'DWC']],
  ['sao-paulo-br', 'São Paulo', ['GRU', 'CGH', 'VCP']],
  ['rio-de-janeiro-br', 'Rio de Janeiro', ['GIG', 'SDU']],
  ['buenos-aires-ar', 'Buenos Aires', ['EZE', 'AEP']],
  ['belfast-gb', 'Belfast', ['BFS', 'BHD']],
  ['glasgow-gb', 'Glasgow', ['GLA', 'PIK']],
  ['berlin-de', 'Berlin', ['BER']],
  ['delhi-in', 'Delhi', ['DEL']],
  ['taipei-tw', 'Taipei', ['TPE', 'TSA']],
];

for (const [key, name, iatas] of METRO_GROUPS) {
  for (const iata of iatas) METRO[iata] = { key, name };
}

/**
 * `London` + `GB` → `london-gb`.
 *
 * Parenthetical qualifiers are stripped before slugging, so
 * `Paris (Orly, Val-de-Marne)` collapses to `paris` rather than becoming its
 * own city.
 */
function makeCityKey(city: string, countryCode: string): string {
  const slug = city
    .replace(/\s*\(.*$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'unknown'}-${countryCode.toLowerCase()}`;
}

/** Display name with any parenthetical qualifier removed. */
const cleanCityName = (city: string) => city.replace(/\s*\(.*$/, '').trim() || city;

const round = (n: number, dp = 4) => Number(n.toFixed(dp));

async function main() {
  console.log('Building airport dataset…');

  const [airportsCsv, countriesCsv] = await Promise.all([
    fetchCached(AIRPORTS_URL, 'airports.csv'),
    fetchCached(COUNTRIES_URL, 'countries.csv'),
  ]);

  // countries.csv: code, name, continent, wikipedia_link, keywords
  const countryRows = parseCsv(countriesCsv).slice(1);
  const countryName = new Map<string, string>();
  for (const r of countryRows) {
    if (r[0] && r[1]) countryName.set(r[0], r[1]);
  }

  const rows = parseCsv(airportsCsv);
  const header = rows[0]!;
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`OurAirports schema changed — no "${name}" column. Got: ${header.join(',')}`);
    return i;
  };

  const iType = col('type');
  const iName = col('name');
  const iLat = col('latitude_deg');
  const iLon = col('longitude_deg');
  const iCountry = col('iso_country');
  const iCity = col('municipality');
  const iSched = col('scheduled_service');
  const iIata = col('iata_code');

  const large: unknown[][] = [];
  const medium: unknown[][] = [];
  const seen = new Set<string>();
  let skippedNoTz = 0;

  for (const r of rows.slice(1)) {
    const type = r[iType];
    if (type !== 'large_airport' && type !== 'medium_airport') continue;
    if (r[iSched] !== 'yes') continue;

    const iata = (r[iIata] ?? '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iata)) continue;
    // OurAirports occasionally carries a duplicate IATA across records; first wins.
    if (seen.has(iata)) continue;

    const lat = Number(r[iLat]);
    const lon = Number(r[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    let zone: string;
    try {
      zone = tzlookup(lat, lon);
    } catch {
      // Only happens for coordinates outside the tz polygons (mid-ocean strips).
      skippedNoTz++;
      continue;
    }

    const countryCode = r[iCountry] ?? '';
    const name = r[iName] ?? '';
    const rawCity = (r[iCity] ?? '').trim() || name;
    const size = type === 'large_airport' ? 'large' : 'medium';

    // An explicit metro grouping wins over the derived slug.
    const metro = METRO[iata];
    const city = metro ? metro.name : cleanCityName(rawCity);
    const cityKey = metro ? metro.key : makeCityKey(rawCity, countryCode);

    seen.add(iata);
    (size === 'large' ? large : medium).push([
      iata,
      name,
      city,
      cityKey,
      countryName.get(countryCode) ?? countryCode,
      countryCode,
      round(lat),
      round(lon),
      zone,
      size,
    ]);
  }

  large.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  medium.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  mkdirSync(OUT, { recursive: true });
  const write = (file: string, data: unknown[][]) => {
    const payload = { columns: COLUMNS, rows: data };
    const path = join(OUT, file);
    writeFileSync(path, JSON.stringify(payload));
    const kb = (JSON.stringify(payload).length / 1024).toFixed(0);
    console.log(`  wrote ${file} — ${data.length} airports, ${kb} KB`);
  };

  write('airports.large.json', large);
  write('airports.medium.json', medium);

  if (skippedNoTz > 0) console.log(`  skipped ${skippedNoTz} airport(s) with unresolvable timezone`);
  console.log(`Done. ${large.length + medium.length} airports total.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
