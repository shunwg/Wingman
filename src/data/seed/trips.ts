import type { FlightSegment, Person, StayWindow, Trip } from '@domain/index';
import { asCityKey, asIata, asPersonId, asSegmentId, asTripId } from '@domain/ids';
import { asISODate, asUtc } from '@domain/time';
import { MATCH_CONFIG_V1, layoversFor } from '@matching/index';
import { defaultPolicy } from '@privacy/index';
import { generateAvatar } from '@design/avatar/generate';
import { SEED_PEOPLE } from './people';

/**
 * One evening's worth of overlapping travel.
 *
 * Everything is built around a single London → Singapore red-eye on 2 September
 * 2026, because a scenario you can hold in your head is worth more than a large
 * random one. The set deliberately contains the cases that should *fail*:
 *
 *  · Hassan connects at Heathrow through a different terminal with 85 usable
 *    minutes, which is not a coffee — the engine should drop him on
 *    feasibility, not rank him low.
 *  · Noor is women-only, Sofia is ID-verified-only, Tobias is professional-only.
 *    Whether they appear depends entirely on who is looking.
 *  · Wei overlaps for six days, which is the only way coworking becomes
 *    proposable at all.
 *
 * A seed where everyone matches everyone proves nothing.
 */

const T = asUtc;

let segCount = 0;
const seg = (
  flightNo: string,
  carrier: string,
  from: string,
  to: string,
  departUtc: string,
  arriveUtc: string,
  terminals: { from?: string; to?: string } = {},
): FlightSegment => ({
  id: asSegmentId(`s${++segCount}`),
  flightNo,
  carrier,
  from: asIata(from),
  to: asIata(to),
  departUtc: T(departUtc),
  arriveUtc: T(arriveUtc),
  ...(terminals.from ? { terminalFrom: terminals.from } : {}),
  ...(terminals.to ? { terminalTo: terminals.to } : {}),
  source: 'bundled',
  confidence: 0.9,
});

/**
 * Where people are actually headed after they land.
 *
 * Neighbourhood centroids, which is the resolution the type allows and the
 * resolution the question needs: "are we going the same way" is answerable from
 * a district, and nothing finer belongs in a database of strangers' movements.
 *
 * The spread here is deliberate. If everyone were headed downtown the radius
 * filter would be decoration — Jurong and Changi Business Park sit 15–20km the
 * other side of the island, so narrowing the radius genuinely removes people.
 */
const PLACES = {
  marinaBay: { lat: 1.283, lon: 103.8607, label: 'Marina Bay' },
  rafflesPlace: { lat: 1.2839, lon: 103.8515, label: 'Raffles Place' },
  tanjongPagar: { lat: 1.2764, lon: 103.8455, label: 'Tanjong Pagar' },
  tiongBahru: { lat: 1.286, lon: 103.832, label: 'Tiong Bahru' },
  orchard: { lat: 1.3048, lon: 103.8318, label: 'Orchard' },
  sentosa: { lat: 1.2494, lon: 103.8303, label: 'Sentosa' },
  geylang: { lat: 1.314, lon: 103.892, label: 'Geylang' },
  oneNorth: { lat: 1.2996, lon: 103.7873, label: 'one-north' },
  jurongEast: { lat: 1.3329, lon: 103.7436, label: 'Jurong East' },
  changiBP: { lat: 1.335, lon: 103.964, label: 'Changi Business Park' },
  // Copenhagen and London, for the later two trips.
  indreBy: { lat: 55.6805, lon: 12.5825, label: 'Indre By' },
  norrebro: { lat: 55.6939, lon: 12.5533, label: 'Nørrebro' },
  oerestad: { lat: 55.6295, lon: 12.5779, label: 'Ørestad' },
  southBank: { lat: 51.5045, lon: -0.1157, label: 'South Bank' },
  shoreditch: { lat: 51.5245, lon: -0.0784, label: 'Shoreditch' },
  canaryWharf: { lat: 51.5054, lon: -0.0235, label: 'Canary Wharf' },
} as const;

type Place = (typeof PLACES)[keyof typeof PLACES];

const stay = (
  cityKey: string,
  from: string,
  to: string,
  arriveUtc: string,
  departUtc: string,
  destination?: Place,
): StayWindow => ({
  cityKey: asCityKey(cityKey),
  dates: { from: asISODate(from), to: asISODate(to) },
  arriveUtc: T(arriveUtc),
  departUtc: T(departUtc),
  ...(destination ? { destination: { ...destination } } : {}),
});

/** The shared red-eye. Departs 21:00 London, lands 17:00 Singapore. */
const SQ317 = () =>
  seg('SQ317', 'SQ', 'LHR', 'SIN', '2026-09-02T20:00:00Z', '2026-09-03T09:00:00Z', {
    from: 'T2',
    to: 'T3',
  });

const SIN_STAY = (from: string, to: string, departUtc: string, destination?: Place) =>
  stay('singapore-sg', from, to, '2026-09-03T09:00:00Z', departUtc, destination);

let tripCount = 0;
function trip(personId: string, segments: FlightSegment[], stays: StayWindow[]): Trip {
  const base: Trip = {
    id: asTripId(`t${++tripCount}`),
    personId: asPersonId(personId),
    segments,
    layovers: [],
    stays,
    visibility: { listing: 'listed' },
    createdAt: T('2026-08-20T09:00:00Z'),
  };
  return { ...base, layovers: layoversFor(base, MATCH_CONFIG_V1) };
}

/* ── You ─────────────────────────────────────────────────────────────────── */

/**
 * The seeded account.
 *
 * Gender is set because the women-only rule needs something to test against;
 * onboarding overwrites all of this. Verified with BankID and LinkedIn so the
 * assurance-gated people are reachable out of the box — otherwise a first run
 * shows a board that looks broken rather than one that looks protective.
 */
export const ME: Person = {
  id: asPersonId('you'),
  displayName: 'Alex Ferrand',
  firstName: 'Alex',
  gender: 'woman',
  pronouns: 'she/her',
  headline: 'Flying out tonight, back in a week. Say hello.',
  bio: 'Energy analyst. I like long flights and short introductions.',
  avatar: generateAvatar('you'),
  professional: {
    title: 'Analyst',
    company: 'Tide Capital',
    industry: 'Energy finance',
    workingOn: 'Storage economics in the Nordics',
    lookingFor: ['operators with live projects'],
  },
  intent: {
    appetite: { social: 0.7, professional: 0.8 },
    openTo: ['gate_coffee', 'lounge', 'meal', 'drinks', 'business_intro', 'ride_share', 'coworking'],
    topics: ['energy', 'cities', 'food'],
    languages: ['en', 'no'],
  },
  links: [
    {
      network: 'linkedin',
      handle: 'alexferrand',
      url: 'https://linkedin.com/in/alexferrand',
      verified: true,
      visibility: 'on_accept',
    },
  ],
  verifications: [
    {
      id: 'v_you_bankid' as never,
      personId: asPersonId('you'),
      providerId: 'bankid_no',
      kind: 'government_eid',
      assurance: 3,
      verifiedAt: T('2026-05-02T09:00:00Z'),
    },
    {
      id: 'v_you_linkedin' as never,
      personId: asPersonId('you'),
      providerId: 'linkedin',
      kind: 'social_account',
      assurance: 1,
      verifiedAt: T('2026-05-02T09:05:00Z'),
      evidence: { handle: 'alexferrand' },
    },
  ],
  memberships: [
    {
      circleId: 'insead' as never,
      personId: asPersonId('you'),
      display: 'show_badge',
      joinedAt: T('2026-03-01T09:00:00Z'),
      admittedBy: 'email_domain',
      role: 'member',
    },
  ],
  privacy: defaultPolicy(),
  reputation: { reliability: 'reliable', meetsCompleted: 7, hasEnoughSignal: true },
  blocked: [],
  homeCity: 'Oslo',
  createdAt: T('2026-02-01T09:00:00Z'),
};

/**
 * Three trips, because one is not a product.
 *
 * With a single trip there is no question to answer about which journey a
 * suggestion belongs to, so the board never has to say — and the moment a
 * second trip exists, an untagged board is unreadable. Three also means one can
 * be settled while the others stay open, which is the state that proves the
 * closing rule does what it claims.
 *
 * They are spaced a month apart on purpose: no two overlap, so nobody can match
 * on more than one of them and the tagging stays legible.
 */
export const MY_TRIPS: Trip[] = [
  // Tonight. Boarding in a few hours — this is the live one.
  trip(
    'you',
    [SQ317()],
    [SIN_STAY('2026-09-03', '2026-09-06', '2026-09-06T10:00:00Z', PLACES.marinaBay)],
  ),

  // A fortnight out, and short.
  trip(
    'you',
    [seg('SK1465', 'SK', 'OSL', 'CPH', '2026-09-18T06:40:00Z', '2026-09-18T08:00:00Z', { to: 'T3' })],
    [
      stay(
        'copenhagen-dk',
        '2026-09-18',
        '2026-09-20',
        '2026-09-18T08:00:00Z',
        '2026-09-20T15:00:00Z',
        PLACES.indreBy,
      ),
    ],
  ),

  // Next month.
  trip(
    'you',
    [seg('BA767', 'BA', 'OSL', 'LHR', '2026-10-06T09:15:00Z', '2026-10-06T10:35:00Z', { to: 'T5' })],
    [
      stay(
        'london-gb',
        '2026-10-06',
        '2026-10-08',
        '2026-10-06T10:35:00Z',
        '2026-10-08T17:00:00Z',
        PLACES.southBank,
      ),
    ],
  ),
];

/* ── Everyone else ───────────────────────────────────────────────────────── */

const TRIPS: Record<string, Trip> = {
  // On the flight itself — the strongest overlap there is.
  mira: trip('mira', [SQ317()], [SIN_STAY('2026-09-03', '2026-09-05', '2026-09-05T12:00:00Z', PLACES.tiongBahru)]),
  jonas: trip('jonas', [SQ317()], [SIN_STAY('2026-09-03', '2026-09-07', '2026-09-07T08:00:00Z', PLACES.marinaBay)]),
  lucas: trip('lucas', [SQ317()], [SIN_STAY('2026-09-03', '2026-09-04', '2026-09-04T22:00:00Z', PLACES.sentosa)]),

  // Connecting at Heathrow, same terminal, while you are waiting to board.
  priya: trip(
    'priya',
    [
      seg('AI161', 'AI', 'DEL', 'LHR', '2026-09-02T09:00:00Z', '2026-09-02T16:00:00Z', { to: 'T2' }),
      seg('BA75', 'BA', 'LHR', 'ACC', '2026-09-02T21:30:00Z', '2026-09-03T03:30:00Z', { from: 'T2' }),
    ],
    [],
  ),

  // Also connecting — but a terminal change with 85 usable minutes. Should be
  // dropped on feasibility rather than shown as a bad option.
  omar: trip(
    'omar',
    [
      seg('TK1979', 'TK', 'IST', 'LHR', '2026-09-02T15:00:00Z', '2026-09-02T17:00:00Z', { to: 'T5' }),
      seg('BA43', 'BA', 'LHR', 'DXB', '2026-09-02T22:00:00Z', '2026-09-03T06:00:00Z', { from: 'T2' }),
    ],
    [],
  ),

  // Lands at Changi shortly after you, on a different aircraft.
  ayla: trip(
    'ayla',
    [seg('EK354', 'EK', 'DXB', 'SIN', '2026-09-03T01:00:00Z', '2026-09-03T09:15:00Z', { to: 'T3' })],
    [stay('singapore-sg', '2026-09-03', '2026-09-04', '2026-09-03T09:15:00Z', '2026-09-04T20:00:00Z', PLACES.orchard)],
  ),

  ingrid: trip(
    'ingrid',
    [seg('SK975', 'SK', 'OSL', 'SIN', '2026-09-02T21:00:00Z', '2026-09-03T09:20:00Z', { to: 'T3' })],
    [stay('singapore-sg', '2026-09-03', '2026-09-05', '2026-09-03T09:20:00Z', '2026-09-05T18:00:00Z', PLACES.changiBP)],
  ),

  // In the city, no shared flight. Visibility depends entirely on who is asking.
  nina: trip('nina', [], [stay('singapore-sg', '2026-09-03', '2026-09-06', '2026-09-02T22:00:00Z', '2026-09-06T09:00:00Z', PLACES.orchard)]),
  sofia: trip('sofia', [], [stay('singapore-sg', '2026-09-03', '2026-09-05', '2026-09-03T04:00:00Z', '2026-09-05T14:00:00Z', PLACES.rafflesPlace)]),
  tobias: trip('tobias', [], [stay('singapore-sg', '2026-09-04', '2026-09-06', '2026-09-04T06:00:00Z', '2026-09-06T18:00:00Z', PLACES.tanjongPagar)]),
  daniel: trip('daniel', [], [stay('singapore-sg', '2026-09-03', '2026-09-07', '2026-09-02T18:00:00Z', '2026-09-07T11:00:00Z', PLACES.geylang)]),

  // Six days — the only overlap long enough to make coworking proposable.
  theo: trip('theo', [], [stay('singapore-sg', '2026-09-02', '2026-09-08', '2026-09-02T02:00:00Z', '2026-09-08T20:00:00Z', PLACES.jurongEast)]),
  marek: trip('marek', [], [stay('singapore-sg', '2026-09-02', '2026-09-09', '2026-09-02T05:00:00Z', '2026-09-09T06:00:00Z', PLACES.oneNorth)]),

  // A ten-hour layover in your own terminal, leaving after you do. This is the
  // one that should rank hardest right now: you are both sitting in T2 with
  // nothing to do, and his window closes before yours.
  hugo: trip(
    'hugo',
    [
      seg('TP1356', 'TP', 'LIS', 'LHR', '2026-09-02T09:30:00Z', '2026-09-02T11:20:00Z', { to: 'T2' }),
      seg('BA55', 'BA', 'LHR', 'JNB', '2026-09-02T21:15:00Z', '2026-09-03T08:30:00Z', { from: 'T2' }),
    ],
    [],
  ),

  // Both in Singapore for the week the circles are built around — the INSEAD
  // reunion and Grid Week run at the same time, which is the whole reason a
  // closed loop is worth selling to either of them.
  amelie: trip(
    'amelie',
    [seg('AF254', 'AF', 'CDG', 'SIN', '2026-09-02T22:30:00Z', '2026-09-03T10:40:00Z', { to: 'T1' })],
    [stay('singapore-sg', '2026-09-03', '2026-09-06', '2026-09-03T10:40:00Z', '2026-09-06T13:00:00Z', PLACES.marinaBay)],
  ),
  elin: trip(
    'elin',
    [seg('SK973', 'SK', 'OSL', 'SIN', '2026-09-03T10:00:00Z', '2026-09-03T22:10:00Z', { to: 'T3' })],
    [stay('singapore-sg', '2026-09-03', '2026-09-07', '2026-09-03T22:10:00Z', '2026-09-07T09:00:00Z', PLACES.marinaBay)],
  ),
};

/**
 * Second trips.
 *
 * People travel more than once, and without these the two later journeys would
 * show an empty board — which would demonstrate the trip tagging and prove
 * nothing about it. Kept small: a handful of familiar faces turning up again on
 * a different route, which is also how the product actually feels after a few
 * months of use.
 */
const LATER_TRIPS: Trip[] = [
  // Copenhagen, 18–20 September.
  trip(
    'ingrid',
    [seg('SK1461', 'SK', 'OSL', 'CPH', '2026-09-18T07:10:00Z', '2026-09-18T08:30:00Z', { to: 'T3' })],
    [stay('copenhagen-dk', '2026-09-18', '2026-09-19', '2026-09-18T08:30:00Z', '2026-09-19T19:00:00Z', PLACES.indreBy)],
  ),
  trip(
    'tobias',
    [seg('DY936', 'DY', 'OSL', 'CPH', '2026-09-18T05:55:00Z', '2026-09-18T07:15:00Z', { to: 'T2' })],
    [stay('copenhagen-dk', '2026-09-18', '2026-09-20', '2026-09-18T07:15:00Z', '2026-09-20T16:30:00Z', PLACES.oerestad)],
  ),
  trip(
    'elin',
    [],
    [stay('copenhagen-dk', '2026-09-17', '2026-09-21', '2026-09-17T14:00:00Z', '2026-09-21T09:00:00Z', PLACES.norrebro)],
  ),

  // London, 6–8 October.
  trip(
    'amelie',
    [seg('AF1080', 'AF', 'CDG', 'LHR', '2026-10-06T08:00:00Z', '2026-10-06T08:25:00Z', { to: 'T4' })],
    [stay('london-gb', '2026-10-06', '2026-10-08', '2026-10-06T08:25:00Z', '2026-10-08T18:00:00Z', PLACES.southBank)],
  ),
  trip(
    'priya',
    [],
    [stay('london-gb', '2026-10-05', '2026-10-09', '2026-10-05T11:00:00Z', '2026-10-09T07:00:00Z', PLACES.shoreditch)],
  ),
  trip(
    'marek',
    [seg('LO279', 'LO', 'WAW', 'LHR', '2026-10-06T06:30:00Z', '2026-10-06T08:40:00Z', { to: 'T2' })],
    [stay('london-gb', '2026-10-06', '2026-10-07', '2026-10-06T08:40:00Z', '2026-10-07T20:00:00Z', PLACES.canaryWharf)],
  ),
];

export const SEED_TRIPS: Trip[] = [...Object.values(TRIPS), ...LATER_TRIPS];

/** That person's first trip. Kept for callers that only need one. */
export const tripFor = (personId: string): Trip | undefined => TRIPS[personId];

/**
 * The pool the matching engine expects — one entry per *trip*, not per person.
 *
 * The distinction matters now that people travel more than once: keying by
 * person would silently drop every second journey, and Ingrid would be
 * unreachable in Copenhagen because she already had a trip to Singapore.
 */
export function seedPool() {
  const byId = new Map(SEED_PEOPLE.map((p) => [String(p.id), p]));
  return SEED_TRIPS.flatMap((t) => {
    const person = byId.get(String(t.personId));
    if (!person) return [];
    return [
      {
        person,
        trip: t,
        circleIds: person.memberships.map((m) => String(m.circleId)),
      },
    ];
  });
}

/** The moment the seeded world is set at — a few hours before the flight. */
export const SEED_NOW = T('2026-09-02T16:30:00Z');
