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

const stay = (
  cityKey: string,
  from: string,
  to: string,
  arriveUtc: string,
  departUtc: string,
): StayWindow => ({
  cityKey: asCityKey(cityKey),
  dates: { from: asISODate(from), to: asISODate(to) },
  arriveUtc: T(arriveUtc),
  departUtc: T(departUtc),
});

/** The shared red-eye. Departs 21:00 London, lands 17:00 Singapore. */
const SQ317 = () =>
  seg('SQ317', 'SQ', 'LHR', 'SIN', '2026-09-02T20:00:00Z', '2026-09-03T09:00:00Z', {
    from: 'T2',
    to: 'T3',
  });

const SIN_STAY = (from: string, to: string, departUtc: string) =>
  stay('singapore-sg', from, to, '2026-09-03T09:00:00Z', departUtc);

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

export const MY_TRIP: Trip = trip('you', [SQ317()], [
  SIN_STAY('2026-09-03', '2026-09-06', '2026-09-06T10:00:00Z'),
]);

/* ── Everyone else ───────────────────────────────────────────────────────── */

const TRIPS: Record<string, Trip> = {
  // On the flight itself — the strongest overlap there is.
  maya: trip('maya', [SQ317()], [SIN_STAY('2026-09-03', '2026-09-05', '2026-09-05T12:00:00Z')]),
  jonas: trip('jonas', [SQ317()], [SIN_STAY('2026-09-03', '2026-09-07', '2026-09-07T08:00:00Z')]),
  lukas: trip('lukas', [SQ317()], [SIN_STAY('2026-09-03', '2026-09-04', '2026-09-04T22:00:00Z')]),

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
  hassan: trip(
    'hassan',
    [
      seg('TK1979', 'TK', 'IST', 'LHR', '2026-09-02T15:00:00Z', '2026-09-02T17:00:00Z', { to: 'T5' }),
      seg('BA43', 'BA', 'LHR', 'DXB', '2026-09-02T22:00:00Z', '2026-09-03T06:00:00Z', { from: 'T2' }),
    ],
    [],
  ),

  // Lands at Changi shortly after you, on a different aircraft.
  amara: trip(
    'amara',
    [seg('EK354', 'EK', 'DXB', 'SIN', '2026-09-03T01:00:00Z', '2026-09-03T09:15:00Z', { to: 'T3' })],
    [stay('singapore-sg', '2026-09-03', '2026-09-04', '2026-09-03T09:15:00Z', '2026-09-04T20:00:00Z')],
  ),

  ingrid: trip(
    'ingrid',
    [seg('SK975', 'SK', 'OSL', 'SIN', '2026-09-02T21:00:00Z', '2026-09-03T09:20:00Z', { to: 'T3' })],
    [stay('singapore-sg', '2026-09-03', '2026-09-05', '2026-09-03T09:20:00Z', '2026-09-05T18:00:00Z')],
  ),

  // In the city, no shared flight. Visibility depends entirely on who is asking.
  noor: trip('noor', [], [stay('singapore-sg', '2026-09-03', '2026-09-06', '2026-09-02T22:00:00Z', '2026-09-06T09:00:00Z')]),
  sofia: trip('sofia', [], [stay('singapore-sg', '2026-09-03', '2026-09-05', '2026-09-03T04:00:00Z', '2026-09-05T14:00:00Z')]),
  tobias: trip('tobias', [], [stay('singapore-sg', '2026-09-04', '2026-09-06', '2026-09-04T06:00:00Z', '2026-09-06T18:00:00Z')]),
  daniel: trip('daniel', [], [stay('singapore-sg', '2026-09-03', '2026-09-07', '2026-09-02T18:00:00Z', '2026-09-07T11:00:00Z')]),

  // Six days — the only overlap long enough to make coworking proposable.
  wei: trip('wei', [], [stay('singapore-sg', '2026-09-02', '2026-09-08', '2026-09-02T02:00:00Z', '2026-09-08T20:00:00Z')]),
};

export const SEED_TRIPS: Trip[] = Object.values(TRIPS);

export const tripFor = (personId: string): Trip | undefined => TRIPS[personId];

/** The pool shape the matching engine expects. */
export function seedPool() {
  return SEED_PEOPLE.filter((p) => TRIPS[p.id]).map((person) => ({
    person,
    trip: TRIPS[person.id]!,
    circleIds: person.memberships.map((m) => String(m.circleId)),
  }));
}

/** The moment the seeded world is set at — a few hours before the flight. */
export const SEED_NOW = T('2026-09-02T16:30:00Z');
