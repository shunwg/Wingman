import type { PublicPlace } from '@domain/index';

/**
 * The words around an agreed plan.
 *
 * One table, because the same fact — "you have agreed to meet here, then" —
 * appears in the room's strip, on the card that was agreed, in the log, in the
 * inbox preview and on the trip. Five surfaces writing their own sentence is
 * five chances for one of them to promise something the others do not.
 */

/** What each kind of public place is called on a chip, and on the plan. */
export const PLACE_KIND_LABEL: Record<PublicPlace['kind'], string> = {
  gate: 'Gate',
  cafe: 'Café',
  lounge: 'Lounge',
  taxi_rank: 'Taxi rank',
  terminal_landmark: 'Landmark',
  restaurant: 'Restaurant',
  station: 'Station',
  hotel_lobby: 'Hotel lobby',
  pickup_point: 'Pickup point',
};

/** The kinds offered when suggesting a time — the ones people actually meet at. */
export const PLACE_KIND_CHOICES: readonly PublicPlace['kind'][] = [
  'terminal_landmark',
  'gate',
  'cafe',
  'lounge',
  'taxi_rank',
  'restaurant',
  'hotel_lobby',
];

export const PLAN_COPY = {
  preview: {
    agreed: 'Plan agreed',
    off: 'Plan called off',
  },
  strip: {
    label: 'Agreed',
    change: 'Change time',
    off: 'Call it off',
    calendar: 'Add to calendar',
  },
  card: {
    agree: 'That works',
    agreed: 'Agreed',
    waiting: (name: string) => `Waiting on ${name}`,
    passed: 'That time has passed',
    replaced: 'Replaced by a newer suggestion',
  },
  log: {
    agreedMine: 'You agreed.',
    agreedTheirs: (name: string) => `${name} agreed.`,
    offMine: 'You called it off.',
    offTheirs: (name: string) => `${name} called it off.`,
  },
  /** They said they can't make it, after the yes. */
  theyCant: (name: string) => `${name} can’t make it. Call it off, or suggest another time.`,
  /** You said so. */
  iCant: (name: string) => `You said you can’t make it. Call it off so ${name} is not left waiting.`,
  /** A plan stands and a different time is on the table. */
  pending: (name: string) => `${name} suggested a change. The plan stands until one of you says yes to it.`,
  none: 'No plan yet. Suggest a time, or say yes to one.',
  trip: {
    title: 'Plans',
    car: 'Shared car',
  },
  /** Confirming before a yes is taken back. */
  offConfirm: 'Call off the plan? The room stays open, and either of you can suggest another time.',
} as const;
