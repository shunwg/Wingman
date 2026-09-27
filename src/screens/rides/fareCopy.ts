import type { Ride } from '@domain/index';
import { fareEach } from '@domain/index';
import { money } from '@screens/money';

/**
 * What a car will cost *you*, in the words each viewer needs.
 *
 * "Cheaper split three ways than two" is the entire pitch of a shared cab, and
 * it only lands with a number on it. So the figure is always per person, always
 * rounded up, and always the one the reader would actually pay: a passenger
 * browsing sees the share *with them in*, someone already in sees today's share
 * and what it drops to if the car fills.
 *
 * Every line says "about". It is the host's guess at a meter nobody has read.
 */
export interface FareCopy {
  /** Short, for a card: "About €38 each with you in". */
  short: string;
  /** The per-person figure alone, for the big number on the car. */
  each?: string;
  /** What the big number means. */
  detail: string;
}

export function fareCopy(ride: Ride, ridersNow: number, inCar: boolean, hostName: string): FareCopy {
  if (ride.fareSplit === 'host_pays') {
    const verb = hostName === 'You' ? 'are' : 'is';
    return { short: `${hostName} ${verb} covering it`, detail: `${hostName} ${verb} covering the fare.` };
  }
  if (!ride.fare) {
    // The split itself is said by the fare note under this line; repeating it
    // here printed the same sentence twice.
    return { short: 'Fare split evenly', detail: 'No estimate yet.' };
  }
  const { currency, amountMinor } = ride.fare;
  const total = money(amountMinor, currency);
  if (!inCar) {
    const withYou = fareEach(ride, ridersNow + 1)!;
    return {
      short: `About ${money(withYou, currency)} each with you in`,
      each: money(withYou, currency),
      detail: `each with you in — about ${total} for the car, split ${ridersNow + 1} ways.`,
    };
  }
  const now = fareEach(ride, ridersNow)!;
  const full = fareEach(ride, ride.seatsTotal)!;
  const fills = ridersNow < ride.seatsTotal && full < now;
  return {
    short: fills ? `About ${money(now, currency)} each · ${money(full, currency)} if it fills` : `About ${money(now, currency)} each`,
    each: money(now, currency),
    detail: fills
      ? `each now — about ${total} for the car. ${money(full, currency)} each if it fills.`
      : `each — about ${total} for the car, split ${ridersNow} ways.`,
  };
}
