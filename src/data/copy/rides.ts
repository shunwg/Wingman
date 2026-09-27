import type { RideAudience, RideDirection } from '@domain/index';

/**
 * What a car's door actually means, in words.
 *
 * Two persona walks arrived at the same failure independently: the three doors
 * have genuinely different *consent* models, and the only thing carrying that
 * difference was one verb on the guest's button — "Take the seat" against "Ask
 * for a seat". A host choosing "A circle" had no way to know she was waiving
 * her own confirmation, and "Circle only" reads as a tightening, which is the
 * exact inverse of what it does.
 *
 * So the consent model is now stated on every surface a car appears on, in the
 * voice of whoever is reading it, and it lives here rather than being retyped
 * per screen — three copies of a sentence about consent is three chances for
 * one of them to be wrong.
 */

export interface DoorCopy {
  /** The short label on a chip, in the host's voice. */
  chip: string;
  /** The same chip on somebody else's car — "You approve" is wrong there. */
  guestChip: string;
  /** What the host is agreeing to, on her own car. */
  host: string;
  /** What a would-be passenger is being told. */
  guest: string;
  /** The button on the guest's screen. Matches the consent model exactly. */
  action: string;
  /** True when someone can seat themselves with no word from the host. */
  selfSeating: boolean;
}

export const DOOR_COPY: Record<RideAudience['kind'], DoorCopy> = {
  open: {
    chip: 'You approve each person',
    guestChip: 'The host approves each person',
    host: 'Anyone whose journey matches can ask. Nobody gets in without your yes.',
    guest: 'The host approves each passenger. Asking does not take the seat.',
    action: 'Ask for a seat',
    selfSeating: false,
  },
  circles: {
    chip: 'Circle members seat themselves',
    guestChip: 'Circle members seat themselves',
    // The word "only" is deliberately not the whole story here. It is true
    // that nobody outside the circle sees the car, and it is also true that
    // anybody inside it can get in without asking — and the second half is
    // the part a host needs to have understood before she offers.
    host: 'Members of this circle can take a seat without asking you first. Nobody outside it can see the car.',
    guest: 'You are in this circle, so the seat is yours to take.',
    action: 'Take the seat',
    selfSeating: true,
  },
  invite: {
    chip: 'Anyone with the link seats themselves',
    guestChip: 'Anyone with the link seats themselves',
    host: 'Whoever you send the link to can take a seat without asking you first. The car is invisible to everyone else.',
    guest: 'You followed the host’s link, so the seat is yours to take.',
    action: 'Take the seat',
    selfSeating: true,
  },
};

/**
 * Where the car is met, and where it is not.
 *
 * This replaces a sentence that said a car is "arranged on public ground, like
 * every other meet". The taxi rank is public ground; the car is not, and it is
 * the one surface in this product you cannot walk away from. Saying otherwise
 * was the only place the app addressed the difference and it got it backwards.
 */
export function rideGround(direction: RideDirection): string {
  // A car heading for the airport has no taxi rank at its start; it said it
  // did, and the app's own plan for that car put it at the pickup point.
  const where =
    direction === 'from_airport'
      ? 'You meet at the taxi rank, which is public'
      : 'You meet at the pickup point, a neighbourhood the host named';
  return `${where}, and Wingman never shares an address. The car itself is not public — it is the one meet you cannot walk out of, so you choose who is in it and you can change your mind up to the kerb.`;
}

/** A seat line, in the reader's words. `name` is "You" for the reader. */
export function seatLineText(change: 'took' | 'in' | 'out', name: string): string {
  const you = name === 'You';
  if (change === 'took') return `${name} took a seat.`;
  if (change === 'in') return you ? 'You are in.' : `${name} is in.`;
  return you ? 'You are no longer in the car.' : `${name} is no longer in the car.`;
}

/** What the fare line promises, and what it does not. */
export const RIDE_FARE_NOTE =
  'Split evenly between whoever is in the car. Wingman does not take payment or settle it for you — you sort it out between you, as you would in any cab.';
