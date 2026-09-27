import { describe, expect, it } from 'vitest';
import { looksLikeAddress, makeMeet, makePublicPlace } from './guards';
import { asIata, asMeetId, asMeetRequestId, asPersonId, asRideId } from './ids';
import type { ISODateTime } from './time';
import type { MeetKind } from './intent';
import { ALL_MEET_KINDS } from './intent';
import { GROUP_KINDS } from './guards';

const t = (s: string) => s as ISODateTime;
const window = { from: t('2026-09-19T14:00:00Z'), to: t('2026-09-19T15:00:00Z') };
const gate = makePublicPlace({ kind: 'gate', label: 'Gate C12', airportIata: asIata('CDG') });
const rank = makePublicPlace({ kind: 'taxi_rank', label: 'Taxi rank, Terminal 2E', airportIata: asIata('CDG') });

const pair = (kind: MeetKind, ids: string[], place = gate) => () =>
  makeMeet({
    id: asMeetId('m1'),
    participants: ids.map(asPersonId),
    kind,
    origin: { kind: 'request', requestId: asMeetRequestId('q1') },
    place,
    window,
  });

describe('makeMeet', () => {
  it('builds a two-person coffee', () => {
    const m = pair('gate_coffee', ['a', 'b'])();
    expect(m.participants).toHaveLength(2);
    expect(m.status).toBe('scheduled');
    expect(m.checkIns).toEqual({});
  });

  it('refuses a three-person gate coffee — the pair invariant moved here, it did not vanish', () => {
    expect(pair('gate_coffee', ['a', 'b', 'c'])).toThrow(/two people/i);
  });

  it('accepts a four-person shared car', () => {
    const m = makeMeet({
      id: asMeetId('m2'),
      participants: ['a', 'b', 'c', 'd'].map(asPersonId),
      kind: 'ride_share',
      origin: { kind: 'ride', rideId: asRideId('r1') },
      place: rank,
      window,
    });
    expect(m.participants).toHaveLength(4);
    expect(m.origin).toEqual({ kind: 'ride', rideId: asRideId('r1') });
  });

  it('refuses one person, and refuses none', () => {
    expect(pair('gate_coffee', ['a'])).toThrow(/two people/i);
    expect(pair('gate_coffee', [])).toThrow(/two people/i);
  });

  it('refuses the same person twice — a car of one person counted twice has a free seat', () => {
    expect(pair('ride_share', ['a', 'a'], rank)).toThrow(/twice/i);
  });

  it('classifies every meet kind explicitly, so a new kind forces the decision', () => {
    for (const kind of ALL_MEET_KINDS) {
      const grouped = GROUP_KINDS.has(kind);
      const three = pair(kind, ['a', 'b', 'c'], rank);
      if (grouped) expect(three).not.toThrow();
      else expect(three).toThrow(/two people/i);
    }
  });
});

describe('pickup_point', () => {
  it('is public ground a car can collect people from on the way to the airport', () => {
    const p = makePublicPlace({ kind: 'pickup_point', label: 'Indre By', airportIata: asIata('CPH'), lat: 55.68, lon: 12.57 });
    expect(p.isPublicGround).toBe(true);
    expect(p.kind).toBe('pickup_point');
  });
});

describe('looksLikeAddress — an address is not a meeting point', () => {
  it.each([
    '12 Baker Street',
    '221b Baker St',
    'Storgata 12',
    'Kongensgade 3, 2nd floor',
    'Hauptstraße 7',
    'Rue de Rivoli 12',
    'Flat 4, Marchmont',
    'Near SW1A 1AA',
    // Round 2: the bad actor's and the privacy walk's real addresses.
    'Karl Johans gate 22',
    'Thorvald Meyers gate 49',
    '12 rue de Rivoli',
    'Marina Bay Sands, room 1412',
    '14 Cloudesley Square',
    '#05-12, Blk 123 Toa Payoh',
    'Prinsengracht 263',
    'Friedrichstr. 12',
    'Baker Street 12',
    '12\u200B Baker Street',
    '１２ Baker Street',
    // Round 3.
    'Karl johans gate 22',
    'Karl Johans gt. 22',
    'Thorvald Meyers gate 49B',
    'Bygdøy allé 5',
    'Sveavägen 44',
    'Kurfürstendamm 21',
    '8 bd Saint-Germain',
    '12 bis rue de Rivoli',
    '221B Baker St London',
    'Suite 1412, Marina Bay Sands',
    'rom 312',
    'Singapore 238823',
    '59.9139, 10.7522',
    '///index.home.raft',
    'https://maps.app.goo.gl/abc',
    // Round 4.
    'Radisson Blu, room 412',
    'Hilton room 412',
    'room 305',
    'come to room 406',
    'Room 412, Marina Bay Sands',
    'rm 1412',
    'Frederiksberg Allé 5',
    'Schönhauser Allee 36',
    'Via Roma 12',
    'C/ Mayor 5',
    '350 5th Ave',
    '12 W 34th St',
    '22 Priory Grove',
    'room no. 412',
    '10 quai de Conti',
    '22 allée des Cygnes',
    'Kastanienallee 12',
    'Alexanderplatz 1',
    '4 Queens Gate',
    '3 Cheyne Walk',
    '14 Elm Park Gardens',
    '742 Evergreen Terrace',
    // Invisible characters and other digit sets.
    'Karl Johans ga\u00ADte 22',
    'Karl Johans gate 2\u20622',
    'Storgata \u0661\u0662',
    // Round 6: whole-line exemptions let these through.
    'Room 1203, 12th floor',
    'Hilton, 12th floor, room 1203',
    'Pan Pacific, level 12, room 1203',
    'Level 4, Room 402',
    '4 Queens Gate, taxi waits outside',
    'via roma 12',
    'VIA ROMA 12',
    'Come to my room, 1203',
  ])('refuses %s', (text) => {
    expect(looksLikeAddress(text)).toBe(true);
  });

  it.each([
    'Gate 12',
    'Meet at gate 12',
    'Taxi queue at T3 arrivals, by door 5. Look for the INSEAD tote.',
    'The coffee bar by the departures board, LHR',
    'Departures board 5',
    'Hall B, Room 3',
    'Terminal 2E',
    'Marina Bay',
    'Rank door 12. White estate, plate ends 4R.',
    'Outside the bakery on Store Kongensgade',
    'Departures gate 12',
    'Platform 5, St Pancras',
    'Pier 1 Terrace bar',
    // Round 3: airports that looked like streets.
    'Changi gate 12',
    'Pier D gate 7',
    'Schengen gate 12',
    'Oslo Airport gate 12',
    'Meeting room 101, Hall B',
    // Round 4: rooms at a conference, and airport phrases near the new words.
    'Conference room 204',
    'Board room 305, level 3',
    'Coffee via Gate 12',
    'Level 3 food court',
    'Terminal 2 car park',
    '5 minutes walk from gate B4',
    'Level 3 Food Court',
    'Terminal 2 Car Park',
    'Terminal 1 Departure Gate',
    'Jewel Level 1 Canopy Park',
    'Level 2 Arrivals Hall Close to Costa',
    // Round 5: what round 4's wider rules refused.
    'Gate 12 is a good place to meet',
    'Terminal 2 meeting place',
    'Gate 34, back row by the window',
    'Terminal 3, 2nd row of taxis',
    'Come down via lift 4',
    'Pick up via Bay 5',
    'via Entrance 3',
    'Terminal 2 Multi-Storey Car Park',
    'Level 1 Pickup Loop',
    'Terminal 2 Security Gate',
    'Level 3 Viewing Terrace',
    'Hall B, Room 204',
    'Room 204, Hall B',
    'Parkplatz 3',
    'Changi T3, Piazza 2',
  ])('lets %s through', (text) => {
    expect(looksLikeAddress(text)).toBe(false);
  });

  it('is enforced where a place is made, not only hinted', () => {
    expect(() => makePublicPlace({ kind: 'cafe', label: '12 Baker Street', airportIata: asIata('LHR') })).toThrow();
  });
});

describe('a stored label never takes a screen down', () => {
  it('builds a place from an address-shaped label when reading, and refuses it when writing', () => {
    expect(() => makePublicPlace({ kind: 'cafe', label: '12 Baker Street', airportIata: asIata('LHR') })).toThrow();
    const read = makePublicPlace({ kind: 'cafe', label: '12 Baker Street', airportIata: asIata('LHR') }, { vetLabel: false });
    expect(read.isPublicGround).toBe(true);
  });
});

describe('reading a stored place never throws', () => {
  it('reads a blank stored label as somewhere public', () => {
    const p = makePublicPlace({ kind: 'cafe', label: '  ', airportIata: asIata('LHR') }, { vetLabel: false });
    expect(p.label).toBe('Somewhere public');
    expect(() => makePublicPlace({ kind: 'cafe', label: '  ', airportIata: asIata('LHR') })).toThrow();
  });
});
