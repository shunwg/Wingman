import type { AirportIndex, MeetKind, Person } from '@domain/index';
import { localTime } from '@domain/time';
import type { RouteReceipt, RouteReceiptLine, TravelOverlap } from '../types';

/**
 * Why this person is on your board, in sentences.
 *
 * The score is never shown. Handing someone "87% compatible" about a stranger
 * is both unpleasant and dishonest — it implies a precision the model does not
 * have, and it invites people to compare humans on a scale. Reasons are more
 * useful anyway: "you are both on SK4489 for nine hours" tells you something
 * actionable in a way a percentage never does.
 *
 * Facts are rendered in mono; everything else is prose.
 */

const KIND_PHRASE: Record<MeetKind, string> = {
  gate_coffee: 'a coffee near the gate',
  lounge: 'the lounge',
  terminal_walk: 'a walk round the terminal',
  ride_share: 'sharing the ride in',
  meal: 'a meal',
  drinks: 'a drink',
  business_intro: 'a proper introduction',
  coworking: 'working alongside each other',
};

export interface ReceiptInput {
  me: Person;
  them: Person;
  strongest: TravelOverlap;
  allOverlaps: TravelOverlap[];
  proposable: MeetKind[];
  airports: AirportIndex;
}

export function buildReceipt(input: ReceiptInput): RouteReceipt {
  const { strongest, proposable, airports } = input;
  const lines: RouteReceiptLine[] = [];
  let headline: string;

  switch (strongest.kind) {
    case 'same_flight': {
      headline = `You are both on ${strongest.flightNo}`;
      lines.push({ label: 'Flight', value: strongest.flightNo, mono: true });
      lines.push({ label: 'In the air', value: durationLabel(strongest.durationMin), mono: true });
      break;
    }

    case 'shared_layover': {
      const name = airports.get(strongest.airport)?.city ?? strongest.airport;
      // The usable window leads: at a gate the decision is made on that
      // number, not on which airport you both already know you are in.
      headline = `${strongest.usableMin} min together, connecting through ${name}`;
      lines.push({
        label: 'Realistically',
        value: `${strongest.usableMin} min together`,
        mono: true,
      });
      lines.push({
        label: 'Overlapping',
        value: windowLabel(strongest.window, strongest.airport, airports),
        mono: true,
      });
      lines.push({ label: 'Airport', value: strongest.airport, mono: true });
      if (!strongest.sameTerminal) {
        // Say it plainly. A terminal change is the difference between a coffee
        // and a brisk walk, and finding that out at the airport is too late.
        lines.push({ label: 'Note', value: 'Different terminals. Allow for the transit' });
      }
      break;
    }

    case 'same_airport_window': {
      const name = airports.get(strongest.airport)?.city ?? strongest.airport;
      headline = `${strongest.usableMin} min together at ${name}`;
      lines.push({
        label: 'Realistically',
        value: `${strongest.usableMin} min together`,
        mono: true,
      });
      lines.push({
        label: 'Overlapping',
        value: windowLabel(strongest.window, strongest.airport, airports),
        mono: true,
      });
      lines.push({ label: 'Airport', value: strongest.airport, mono: true });
      break;
    }

    case 'same_city_night': {
      headline = 'You are in the same city that night';
      lines.push({ label: 'Night', value: strongest.night, mono: true });
      break;
    }

    case 'overlapping_stay': {
      headline =
        strongest.days === 1
          ? 'You are in the same city on the same day'
          : `You overlap for ${strongest.days} days`;
      lines.push({
        label: 'Dates',
        value: `${strongest.overlap.from} → ${strongest.overlap.to}`,
        mono: true,
      });
      break;
    }
  }

  /* Shared ground beyond the itinerary. */
  const topics = sharedItems(input.me.intent.topics, input.them.intent.topics);
  if (topics.length > 0) {
    lines.push({ label: 'Both into', value: topics.slice(0, 3).join(', ') });
  }

  const langs = sharedItems(input.me.intent.languages, input.them.intent.languages);
  if (langs.length > 1) {
    lines.push({ label: 'Shared languages', value: langs.join(', ').toUpperCase(), mono: true });
  }

  /* Anything else you overlap on, beyond the headline. */
  const others = input.allOverlaps.filter((o) => o.kind !== strongest.kind);
  if (others.length > 0) {
    lines.push({ label: 'Also', value: secondaryLabel(others[0]!) });
  }

  return { headline, lines, suggestion: suggestionFor(proposable) };
}

function suggestionFor(kinds: MeetKind[]): string {
  if (kinds.length === 0) return '';
  const phrases = kinds.slice(0, 2).map((k) => KIND_PHRASE[k]);
  const joined = phrases.length === 2 ? `${phrases[0]} or ${phrases[1]}` : phrases[0]!;
  return `Enough time for ${joined}.`;
}

function secondaryLabel(o: TravelOverlap): string {
  switch (o.kind) {
    case 'same_flight':
      return `the same flight, ${o.flightNo}`;
    case 'shared_layover':
      return `a connection at ${o.airport}`;
    case 'same_airport_window':
      return `time at ${o.airport}`;
    case 'same_city_night':
      return 'the same city that night';
    case 'overlapping_stay':
      return o.days === 1 ? 'the same day in town' : `${o.days} days in the same city`;
  }
}

function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function windowLabel(
  w: { from: string; to: string },
  iata: string,
  airports: AirportIndex,
): string {
  const zone = airports.zone(iata as never);
  if (!zone) return `${w.from.slice(11, 16)}–${w.to.slice(11, 16)}`;
  return `${localTime(w.from as never, zone)}–${localTime(w.to as never, zone)}`;
}

function sharedItems(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set(b.map((s) => s.toLowerCase()));
  return a.filter((x) => set.has(x.toLowerCase()));
}
