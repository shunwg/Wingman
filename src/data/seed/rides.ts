import type { Ride } from '@domain/index';
import { anyAudience, asCircleId, asIata, asPersonId, asRideId, asUtc, makeRide } from '@domain/index';
import { MY_TRIPS, PLACES, tripFor } from './trips';

/**
 * The seeded shared cars.
 *
 * Three, chosen to make every side of the feature reachable on a first run
 * without anybody having to create anything first:
 *
 *   1. Jonas's car — an INSEAD classmate on your own flight, going where you
 *      are going, with one seat left. This is the flagship: the stated first
 *      customers are a business-school cohort who converge on the same weekend
 *      flights and split cabs, and it is reachable in two taps from the board.
 *   2. Mira's car — the same airport, a different neighbourhood, an open door.
 *      Proves the "nearest end first" ordering against Jonas's, and proves the
 *      open door's host-confirms behaviour.
 *   3. Your own car to Copenhagen airport — the other direction, hosted by you,
 *      so the host's view exists before you have made one.
 *
 * Nobody new was invented for these. Jonas and Mira are already on SQ317 in the
 * seed, already headed to Marina Bay and Tiong Bahru respectively, and Jonas is
 * already in the INSEAD circle — which is also the circle `ME.memberships`
 * already carries, so the circle door is open to you without any setup.
 */

const JONAS_TRIP = tripFor('jonas');
const MIRA_TRIP = tripFor('mira');
const LUCAS_TRIP = tripFor('lucas');

/**
 * Landing at Changi at 09:00Z. The cars leave between 09:30 and 10:30 — long
 * enough after the wheels stop for immigration and a bag, short enough that it
 * is the same car ride.
 */
const CHANGI_PICKUP = { from: asUtc('2026-09-03T09:30:00Z'), to: asUtc('2026-09-03T10:30:00Z') };

export const SEED_RIDES: Ride[] = [
  ...(JONAS_TRIP
    ? [
        makeRide({
          id: asRideId('ride_jonas_marina'),
          hostPersonId: asPersonId('jonas'),
          tripId: JONAS_TRIP.id,
          direction: 'from_airport',
          airportIata: asIata('SIN'),
          point: { ...PLACES.marinaBay },
          window: CHANGI_PICKUP,
          // Two seats: his and one more. "One seat left" is the whole tension
          // of the screen, and it needs no fictional passenger to produce.
          seatsTotal: 2,
          audience: { kind: 'circles', circleIds: [asCircleId('insead')] },
          // A metered Changi–Marina Bay taxi with the airport surcharge; the
          // host's guess, as every estimate in the app is.
          fare: { amountMinor: 3600, currency: 'SGD' },
          pickupNote: 'Taxi queue at T3 arrivals, by door 5. Look for the INSEAD tote.',
          createdAt: asUtc('2026-09-02T18:00:00Z'),
        }),
      ]
    : []),

  ...(MIRA_TRIP
    ? [
        makeRide({
          id: asRideId('ride_mira_tiong'),
          hostPersonId: asPersonId('mira'),
          tripId: MIRA_TRIP.id,
          direction: 'from_airport',
          airportIata: asIata('SIN'),
          point: { ...PLACES.tiongBahru },
          window: CHANGI_PICKUP,
          seatsTotal: 4,
          audience: { kind: 'open', rules: anyAudience() },
          fare: { amountMinor: 3200, currency: 'SGD' },
          createdAt: asUtc('2026-09-02T19:20:00Z'),
        }),
      ]
    : []),

  // The to-airport direction, joinable rather than merely hostable. Lucas is
  // already on SQ317 with you, so he is already in London before it — and
  // 20:00 out of Heathrow means leaving town in the early evening. Without
  // this, the demo could only ever show the airport-to-town half.
  ...(LUCAS_TRIP
    ? [
        makeRide({
          id: asRideId('ride_lucas_lhr'),
          hostPersonId: asPersonId('lucas'),
          tripId: LUCAS_TRIP.id,
          direction: 'to_airport',
          airportIata: asIata('LHR'),
          point: { ...PLACES.southBank },
          window: { from: asUtc('2026-09-02T17:00:00Z'), to: asUtc('2026-09-02T18:00:00Z') },
          seatsTotal: 4,
          audience: { kind: 'open', rules: anyAudience() },
          fare: { amountMinor: 9500, currency: 'GBP' },
          createdAt: asUtc('2026-09-02T09:00:00Z'),
        }),
      ]
    : []),

  ...(MY_TRIPS[1]
    ? [
        makeRide({
          id: asRideId('ride_you_cph'),
          hostPersonId: asPersonId('you'),
          tripId: MY_TRIPS[1].id,
          direction: 'to_airport',
          airportIata: asIata('CPH'),
          point: { ...PLACES.indreBy },
          // Leaving town at midday for a 15:00 flight out. The to-airport
          // direction is the half people actually dread, and until this feature
          // existed the domain could not express it at all.
          window: { from: asUtc('2026-09-20T11:30:00Z'), to: asUtc('2026-09-20T12:30:00Z') },
          seatsTotal: 4,
          audience: { kind: 'open', rules: anyAudience() },
          createdAt: asUtc('2026-09-02T20:00:00Z'),
        }),
      ]
    : []),
];

export const rideById = (id: string): Ride | undefined =>
  SEED_RIDES.find((r) => String(r.id) === id);
