import type { CityKey, IataCode, MeetId, PersonId } from './ids';
import type { Meet, MeetOrigin, PublicPlace } from './meet';
import type { Redacted } from './person';
import type { MeetKind } from './intent';
import type { TimeWindow } from './time';

/**
 * Constructors and narrowing helpers.
 *
 * Types stop wrong *shapes*. These stop wrong *values* — the cases where the
 * shape is fine and the content is the problem.
 */

const PUBLIC_KINDS: ReadonlySet<PublicPlace['kind']> = new Set([
  'gate',
  'lounge',
  'terminal_landmark',
  'cafe',
  'restaurant',
  'taxi_rank',
  'station',
  'hotel_lobby',
  'pickup_point',
]);

/**
 * Whether a piece of text reads like somebody's address.
 *
 * `PublicPlace` makes a private address unrepresentable as a *type*, but a
 * label is free text, and three reviewers showed that "Storgata 12, flat 3"
 * went straight into a suggestion, a car's pickup point and its pickup note.
 * This is a heuristic, not a proof — it catches the shapes an address actually
 * takes (a number beside a street word, a flat or room number, a postcode) and
 * leaves "Gate 12", "door 5" and "Terminal 3" alone. Its job is to stop the
 * honest mistake; a determined person can always misspell a street.
 */
export function looksLikeAddress(text: string): boolean {
  // Full-width digits and zero-width spaces are the two ways an address slips
  // past a pattern by accident (a phone keyboard) or on purpose. Normalise first.
  // Every invisible format character (soft hyphen, invisible times, direction
  // marks) and the combining grapheme joiner go too, and the common non-Latin
  // digit sets read as digits.
  const t = text
    .normalize('NFKC')
    .replace(/[\p{Cf}\u034F]/gu, '')
    .replace(/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F]/g, (d) => {
      const c = d.codePointAt(0)!;
      return String(c - (c >= 0x0966 ? 0x0966 : c >= 0x06f0 ? 0x06f0 : 0x0660));
    })
    .trim();
  // "12 Baker Street", "14 Cloudesley Square" — a number, a few words, a
  // street word. "St" only when it is not "St Pancras": Saint, not Street.
  // The words between may carry digits — "350 5th Ave" — as long as each has a
  // letter. "Grove", "Place" and "Row" join the list; "Court", "Park", "Walk"
  // and "Terrace" stay off it, because an airport has a food court, a car
  // park, a five-minute walk and a Pier 1 Terrace bar.
  const numberThenStreet =
    /\b\d{1,5}[a-z]?,?\s+(?:[\p{L}\d'.-]*\p{L}[\p{L}\d'.-]*\s+){0,3}(?:street|road|rd|avenue|ave|lane|ln|drive|dr|close(?!\s+to\b)|crescent|boulevard|blvd|square|sq|mews|grove|place|row)\b/iu;
  // "221B Baker St": a name between the number and "St". "Platform 5, St
  // Pancras" has none — that St is a saint.
  const numberThenSt = /\b\d{1,5}[a-z]?,?\s+(?:[\p{L}\d'.-]*\p{L}[\p{L}\d'.-]*\s+){1,3}st\b/iu;
  // "Storgata 12", "Kongensgade 3", "Hauptstraße 7" — a compound street name,
  // then a number. Only as a suffix of a longer word, so "Gate 12" is a gate.
  const compoundThenNumber =
    /\p{L}{2,}(?:gade|gata|gatan|gasse|vej|vei|veien|vägen|väg|straße|strasse|weg|laan|gate|damm|allee|platz)\s+\d{1,5}[a-z]?\b/iu;
  // "Rue de Rivoli 12", "Calle Mayor 5".
  const latinThenNumber =
    /\b(?:rue|calle|carrer|avenida|rua|corso|viale|piazza)\s+(?:[\p{L}'.-]+\s+){0,3}\d{1,5}\b|\bC\/\s*\p{L}+(?:\s+\p{L}+){0,2}\s+\d{1,5}\b/iu;
  // "22 allée des Cygnes", "10 quai de Conti".
  const numberThenFrench = /\b\d{1,5}[a-z]?,?\s+(?:allée|quai|impasse|chemin|cours)\b/iu;
  // "4 Queens Gate", "3 Cheyne Walk", "14 Elm Park Gardens": English street
  // words an airport also uses, so only after a capitalised name — and never
  // after the airport's own words ("Level 3 Food Court", "Terminal 2 Car
  // Park", "Pier 1 Terrace bar", "Terminal 1 Departure Gate").
  const namedPlace = t.match(
    /\b\d{1,5}[a-z]?,?\s+((?:\p{Lu}[\p{L}'.-]*\s+){1,3})(?:Gate|Walk|Gardens|Terrace|Court|Park|Hill|Embankment|Loop)\b/u,
  );
  const airportLead =
    /^(?:food|car|coach|taxi|bus|staff|short|long|stay|departures?|arrivals?|boarding|main|north|south|east|west|transfer|terminal|pier|level|hall|gate|lounge|jewel|canopy|topiary|butterfly|sunflower|cactus|garden)\b/i;
  const namedPlaceStreet = Boolean(namedPlace && !airportLead.test(namedPlace[1]!.trim()));
  // "Via Roma 12" — but "via" is English too ("coffee via Gate 12"), so only
  // a capitalised name that is not an airport word.
  const viaStreet = t.match(/\bvia\s+(\p{Lu}\p{Ll}+)\s+\d{1,5}\b/iu);
  // A flat is somebody's home by definition.
  const flat = /\b(?:flat|apt|apartment|leilighet)\s*#?\s*\d+/i;
  const ukPostcode = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/;
  // "Karl Johans gate 22" — a capitalised name, a Nordic street word, a number…
  // Phones capitalise the first word only ("Karl johans gate 22"), so the name
  // may be capitalised or end in the Nordic genitive -s; "gt." is how Oslo
  // abbreviates "gate".
  // "gate" is also English, so a Nordic "gate" needs the genitive -s it always
  // has ("Karl Johans gate", "Thorvald Meyers gate") — "Changi gate 12" is an
  // airport. The other Nordic street words take a capitalised name or an -s.
  const nordicGate = t.match(/\b(\p{L}{3,}s)\s+(?:gate|gt\.?)\s+\d{1,5}[a-zA-Z]?\b/u);
  const nordicOther = t.match(/\b(\p{L}{3,})\s+(?:gata|gatan|vei|veien|vej|gade|plass|torg|allé|alle|allee)\s+\d{1,5}[a-zA-Z]?\b/iu);
  const nordic = nordicGate ?? nordicOther;
  const named = nordicGate ? true : nordic ? /^\p{Lu}/u.test(nordic[1]!) || /s$/i.test(nordic[1]!) : false;
  // …but "Departures gate 12" and "Schengen gate 12" are airports, not Oslo.
  const airportWord =
    /^(?:departures?|arrivals?|terminal|domestic|international|pier|north|south|east|west|main|satellite|schengen|concourse|zone|level|hall|area|transfer|bus)$/i;
  const nordicNamedStreet = Boolean(nordic && named && !airportWord.test(nordic[1]!));
  const viaNamedStreet = Boolean(viaStreet && !airportWord.test(viaStreet[1]!) && !/^(?:gate|door|exit|platform|carousel|belt|pier|terminal)$/i.test(viaStreet[1]!));
  // "Prinsengracht 263", "Damstraat 5", "Friedrichstr. 12".
  const dutchGermanCompound = /\p{L}{2,}(?:straat|gracht|kade|singel|plein|str\.)\s*\d{1,5}[a-z]?\b/iu;
  // "12 rue de Rivoli", "5 via Roma".
  const numberThenLatin = /\b\d{1,5}[a-z]?,?\s+(?:(?:bis|ter)\s+)?(?:rue|via|calle|avenida|avenue|boulevard|bd|bld)\b/iu;
  // "Baker Street 12" — the English word after a capitalised name.
  const namedEnglishThenNumber = /\b\p{Lu}[\p{L}'.-]+\s+(?:Street|Road|Avenue|Lane|Drive|Square)\.?\s+\d{1,5}\b/u;
  // A hotel room or suite: three or four digits. Round 3 raised English
  // "room" to four digits to let "Meeting room 101, Hall B" through, and
  // "Radisson Blu, room 412" went through with it — the one number that is
  // someone's bedroom. Three digits again, unless the word before says it is a
  // room at a conference.
  const hotelRoom =
    /\b(?:rom|værelse|zimmer|chambre|habitación|suite)\s*#?\s*\d{3,4}\b|(?:^|\s)#\d{3,4}\b/iu;
  const conferenceRoom =
    /^(?:meeting|conference|board|seminar|function|breakout|class|lecture|training|workshop|committee|press|green|prayer|quiet|waiting|interview|reading|study)$/i;
  const englishRoom = Array.from(t.matchAll(/(?:(\p{L}+)\s+)?\b(?:room|rm)\.?\s*(?:no\.?\s*|number\s*)?#?\s*\d{3,4}\b/giu)).some(
    (m) => !(m[1] && conferenceRoom.test(m[1])),
  );
  // "Singapore 238823" — a six-digit postcode after the city.
  const sgPostcode = /\bsingapore\s+\d{6}\b/i;
  // A position is an address by another name: coordinates, a plus code, a
  // what3words triple, a map link.
  const position =
    /-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}|\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b|\/\/\/[a-z]+\.[a-z]+\.[a-z]+|maps\.(?:google|apple)\.|goo\.gl\/maps|maps\.app\.goo/i;
  // Singapore: "#05-12" is a unit, "Blk 123" a block.
  const singapore = /#\s?\d{1,3}-\d{1,5}\b|\bblk\s*\d{1,4}\b/i;
  return (
    nordicNamedStreet ||
    viaNamedStreet ||
    englishRoom ||
    namedPlaceStreet ||
    [
      numberThenStreet,
      numberThenSt,
      compoundThenNumber,
      latinThenNumber,
      flat,
      ukPostcode,
      dutchGermanCompound,
      numberThenLatin,
      numberThenFrench,
      namedEnglishThenNumber,
      hotelRoom,
      singapore,
      position,
      sgPostcode,
    ].some((r) => r.test(t))
  );
}

/**
 * The only sanctioned way to build a meeting point.
 *
 * Every meet happens on public ground. Not as a guideline in a help article —
 * as the only thing this constructor will produce. Somebody's flat cannot be
 * expressed as a `PublicPlace`, so it cannot reach a `Meet`.
 */
export function makePublicPlace(
  input: {
    kind: PublicPlace['kind'];
    label: string;
    airportIata?: IataCode;
    cityKey?: CityKey;
    lat?: number;
    lon?: number;
  },
  /**
   * `vetLabel: false` for *reading* a place that was already written. The
   * address check is a write-time guard; running it on read meant a label saved
   * before the check existed — or synced from someone else — threw inside a
   * render and blanked the Trips tab. The kind and the anchor are still checked.
   */
  opts: { vetLabel?: boolean } = {},
): PublicPlace {
  if (!PUBLIC_KINDS.has(input.kind)) {
    throw new Error(`Meets happen on public ground. Refused place kind: ${String(input.kind)}`);
  }
  if (!input.label.trim()) {
    // Reading a stored place with no label is a gap in the data, not a reason
    // to take a screen down; writing one is still refused.
    if (opts.vetLabel === false) return { ...input, label: 'Somewhere public', isPublicGround: true };
    throw new Error('A meeting point needs a label someone can actually navigate to.');
  }
  if (opts.vetLabel !== false && looksLikeAddress(input.label)) {
    throw new Error('A meeting point is a public place, never an address.');
  }
  if (!input.airportIata && !input.cityKey) {
    throw new Error('A meeting point must be anchored to an airport or a city.');
  }
  return { ...input, isPublicGround: true };
}

/**
 * Meet kinds that more than two people can share.
 *
 * Every kind is listed in one of the two sets below, deliberately, with no
 * default — so adding a ninth `MeetKind` breaks the exhaustiveness test in
 * guards.test.ts rather than silently inheriting whichever answer was easier.
 *
 * A car, a table and a desk hold a group. The airside kinds do not, because
 * they are bounded by a layover and a gate bench; and a business introduction
 * is between two people by definition — three makes it a meeting, which is a
 * different thing with different consent.
 */
export const GROUP_KINDS: ReadonlySet<MeetKind> = new Set<MeetKind>([
  'ride_share',
  'meal',
  'drinks',
  'coworking',
]);

/** Meet kinds that are between exactly two people. */
export const PAIR_ONLY_KINDS: ReadonlySet<MeetKind> = new Set<MeetKind>([
  'gate_coffee',
  'lounge',
  'terminal_walk',
  'business_intro',
]);

/**
 * The only sanctioned way to build a meet.
 *
 * `Meet.participants` used to be a `[PersonId, PersonId]` tuple, and the tuple
 * was doing real work: it made "three people at a gate coffee" unrepresentable.
 * Widening it so a taxi can exist would have thrown that away, so the invariant
 * moved here instead of disappearing — the same trade `makePublicPlace()` makes,
 * where the type cannot express the rule and the constructor refuses to build
 * the value.
 */
export function makeMeet(input: {
  id: MeetId;
  participants: PersonId[];
  kind: MeetKind;
  origin: MeetOrigin;
  place: PublicPlace;
  window: TimeWindow;
}): Meet {
  const { participants: people, kind } = input;
  if (people.length < 2) {
    throw new Error(`A meet is at least two people. Got ${people.length}.`);
  }
  if (new Set(people.map(String)).size !== people.length) {
    throw new Error('The same person cannot be in a meet twice.');
  }
  if (!GROUP_KINDS.has(kind) && people.length > 2) {
    throw new Error(`A ${kind} is between two people. Got ${people.length}.`);
  }
  return {
    id: input.id,
    participants: [...people],
    origin: input.origin,
    kind,
    place: input.place,
    window: input.window,
    status: 'scheduled',
    checkIns: {},
    guardianSessionIds: [],
    ratingIds: [],
  };
}

export const isPublicPlace = (v: unknown): v is PublicPlace =>
  typeof v === 'object' &&
  v !== null &&
  (v as PublicPlace).isPublicGround === true &&
  PUBLIC_KINDS.has((v as PublicPlace).kind);

/** Narrow a possibly-withheld field to its value. */
export function visible<T>(v: T | Redacted): v is T {
  return !(typeof v === 'object' && v !== null && (v as Redacted).__redacted === true);
}

/** Read a possibly-withheld field, with a fallback for the withheld case. */
export function orElse<T>(v: T | Redacted, fallback: T): T {
  return visible(v) ? v : fallback;
}

/**
 * Kinds that need the two people to be airside together. Used by the layover
 * rules — a landside coffee during an airside connection is not a thing.
 */
export const AIRSIDE_KINDS: ReadonlySet<MeetKind> = new Set<MeetKind>([
  'gate_coffee',
  'lounge',
  'terminal_walk',
]);

/** Kinds that only make sense once you have left the airport. */
export const CITY_KINDS: ReadonlySet<MeetKind> = new Set<MeetKind>([
  'meal',
  'drinks',
  'coworking',
]);

export function exhaustive(v: never, context: string): never {
  throw new Error(`Unhandled case in ${context}: ${JSON.stringify(v)}`);
}
