import type { MeetKind } from '@domain/index';

/**
 * What each meet kind is called, everywhere it is named — on a card's
 * footer, on the ask-to-meet chips, on the open-to toggles in the profile.
 * One table, so the same kind never has two names.
 */
export const MEET_KIND_LABEL: Record<MeetKind, string> = {
  gate_coffee: 'Coffee at the gate',
  lounge: 'The lounge',
  terminal_walk: 'Walk the terminal',
  ride_share: 'Share the ride in',
  meal: 'A meal',
  drinks: 'A drink',
  business_intro: 'An introduction',
  coworking: 'Cowork',
};

export const MEET_KIND_ORDER: readonly MeetKind[] = [
  'gate_coffee',
  'lounge',
  'terminal_walk',
  'ride_share',
  'meal',
  'drinks',
  'business_intro',
  'coworking',
];
