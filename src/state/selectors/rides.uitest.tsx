import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { asCircleId, asPersonId } from '@domain/ids';
import { seatsLeft } from '@domain/index';
import { useStore, STORE_VERSION } from '@state/store';
import { demoState } from '@state/account/reducers';
import { SEED_NOW, tripFor } from '@data/seed/trips';
import { useJoinableRides, useMyRides, useRide } from './rides';

/**
 * The ride selectors, against the real store.
 *
 * Not a pure test: the whole point is that the seeded world, the persisted
 * slice and the privacy engine agree, and each of those is a place the wiring
 * can be wrong while every unit underneath still passes.
 */

const reset = () => {
  const demo = demoState('dev_test');
  useStore.setState({ ...demo, now: SEED_NOW }, false);
};

beforeEach(reset);

describe('the store version', () => {
  it('moved when the rides slice appeared', () => {
    // If this fails, a persisted v5 blob is being read as if it had rides.
    expect(STORE_VERSION).toBeGreaterThanOrEqual(6);
  });
});

describe('useJoinableRides', () => {
  it('offers the cars going your way and never your own', () => {
    const { result } = renderHook(() => useJoinableRides());
    const ids = result.current.rows.map((r) => String(r.ride.id));
    expect(ids).toContain('ride_jonas_marina');
    expect(ids).toContain('ride_mira_tiong');
    expect(ids).not.toContain('ride_you_cph');
  });

  it('offers a car in each direction — the feature is not one-way', () => {
    const { result } = renderHook(() => useJoinableRides());
    const dirs = new Set(result.current.rows.map((r) => r.ride.direction));
    expect(dirs).toContain('from_airport');
    expect(dirs).toContain('to_airport');
  });

  it('puts the car going nearest where you are going first', () => {
    // Marina Bay is where you are staying; Tiong Bahru is a few km off.
    const { result } = renderHook(() => useJoinableRides());
    const sinRows = result.current.rows.filter((r) => String(r.ride.airportIata) === 'SIN');
    expect(String(sinRows[0]?.ride.id)).toBe('ride_jonas_marina');
  });

  it('shows the INSEAD car because your membership admits you', () => {
    const { result } = renderHook(() => useJoinableRides());
    const jonas = result.current.rows.find((r) => String(r.ride.id) === 'ride_jonas_marina');
    expect(jonas?.refusal).toBeNull();
    // A circle car seats you outright: you were admitted to something already.
    expect(jonas?.seatsAutomatically).toBe(true);
  });

  it('hides the INSEAD car once you are not in INSEAD, and says so in a bucketed phrase', () => {
    useStore.setState({ me: { ...useStore.getState().me, memberships: [] } });
    const { result } = renderHook(() => useJoinableRides());
    const ids = result.current.rows.map((r) => String(r.ride.id));
    expect(ids).not.toContain('ride_jonas_marina');
    expect(result.current.hiddenNote).toBeTruthy();
    // Bucketed, never an exact small count — rule 3.
    expect(result.current.hiddenNote).not.toMatch(/\b1 car\b/);
  });

  it('hides an open car once its host has blocked you', () => {
    const before = renderHook(() => useJoinableRides());
    expect(before.result.current.rows.map((r) => String(r.ride.id))).toContain('ride_mira_tiong');

    useStore.setState({ me: { ...useStore.getState().me, blocked: [asPersonId('mira')] } });
    const after = renderHook(() => useJoinableRides());
    expect(after.result.current.rows.map((r) => String(r.ride.id))).not.toContain('ride_mira_tiong');
  });
});

describe('useMyRides', () => {
  it('separates the car you host from the ones you have a seat in', () => {
    const { result } = renderHook(() => useMyRides());
    expect(result.current.hosting.map((r) => String(r.ride.id))).toEqual(['ride_you_cph']);
    expect(result.current.riding).toEqual([]);
  });

  it('moves a car into `riding` once you take a seat', () => {
    useStore.getState().claimSeat('ride_jonas_marina');
    const { result } = renderHook(() => useMyRides());
    expect(result.current.riding.map((r) => String(r.ride.id))).toEqual(['ride_jonas_marina']);
  });
});

describe('claiming a seat', () => {
  it('seats you outright in a circle car, and opens its room', () => {
    useStore.getState().claimSeat('ride_jonas_marina');
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_jonas_marina')!;
    const mine = ride.claims.find((c) => String(c.personId) === 'you');
    expect(mine?.status).toBe('confirmed');
    expect(useStore.getState().channels.some((c) => String(c.id) === 'ride:ride_jonas_marina')).toBe(true);
  });

  it('only asks in an open car — the host confirms a stranger', () => {
    useStore.getState().claimSeat('ride_mira_tiong');
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_mira_tiong')!;
    expect(ride.claims.find((c) => String(c.personId) === 'you')?.status).toBe('requested');
  });

  it('takes the last seat and then refuses the next person, without writing a status', () => {
    useStore.getState().claimSeat('ride_jonas_marina');
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_jonas_marina')!;
    expect(seatsLeft(ride)).toBe(0);
    // "Full" is computed, never stored. The car is still open; it simply has
    // no seats — and nothing in the persisted object says otherwise.
    expect(ride.status).toBe('open');
    expect(JSON.stringify(ride)).not.toContain('full');
  });

  it('refuses a second claim from the same person', () => {
    useStore.getState().claimSeat('ride_mira_tiong');
    useStore.getState().claimSeat('ride_mira_tiong');
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_mira_tiong')!;
    expect(ride.claims.filter((c) => String(c.personId) === 'you')).toHaveLength(1);
  });

  it('refuses a seat in a car you cannot see', () => {
    useStore.setState({ me: { ...useStore.getState().me, memberships: [] } });
    useStore.getState().claimSeat('ride_jonas_marina');
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_jonas_marina')!;
    expect(ride.claims).toEqual([]);
  });

  it('refuses a seat in your own car', () => {
    useStore.getState().claimSeat('ride_you_cph');
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!;
    expect(ride.claims).toEqual([]);
  });
});

describe('the host settling a seat', () => {
  const claimFromStranger = () => {
    const rides = useStore.getState().rides.map((r) =>
      String(r.id) === 'ride_you_cph'
        ? {
            ...r,
            claims: [
              { personId: asPersonId('priya'), status: 'requested' as const, askedAt: SEED_NOW, history: [] },
            ],
          }
        : r,
    );
    useStore.setState({ rides });
  };

  it('confirms a seat and opens the room', () => {
    claimFromStranger();
    useStore.getState().confirmSeat('ride_you_cph', asPersonId('priya'));
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!;
    expect(ride.claims[0]!.status).toBe('confirmed');
    expect(ride.claims[0]!.history).toHaveLength(1);
    expect(useStore.getState().channels.some((c) => String(c.id) === 'ride:ride_you_cph')).toBe(true);
  });

  it('declines a seat, and a second decline changes nothing rather than throwing', () => {
    claimFromStranger();
    useStore.getState().declineSeat('ride_you_cph', asPersonId('priya'));
    useStore.getState().declineSeat('ride_you_cph', asPersonId('priya'));
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!;
    expect(ride.claims[0]!.status).toBe('declined');
    expect(ride.claims[0]!.history).toHaveLength(1);
  });

  it('cannot settle a seat in somebody else\'s car', () => {
    useStore.getState().confirmSeat('ride_mira_tiong', asPersonId('priya'));
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_mira_tiong')!;
    expect(ride.claims).toEqual([]);
  });
});

describe('cancelling', () => {
  it('kills every live seat with the car', () => {
    const rides = useStore.getState().rides.map((r) =>
      String(r.id) === 'ride_you_cph'
        ? {
            ...r,
            claims: [
              { personId: asPersonId('priya'), status: 'confirmed' as const, askedAt: SEED_NOW, history: [] },
            ],
          }
        : r,
    );
    useStore.setState({ rides });
    useStore.getState().cancelRide('ride_you_cph');
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!;
    expect(ride.status).toBe('cancelled');
    expect(ride.claims[0]!.status).toBe('revoked_by_policy');
  });

  it('refuses to cancel a car that is not yours', () => {
    useStore.getState().cancelRide('ride_mira_tiong');
    expect(
      useStore.getState().rides.find((r) => String(r.id) === 'ride_mira_tiong')!.status,
    ).toBe('open');
  });
});

describe('hosting', () => {
  it('opens a car on one of your trips and mints a link only for a link car', () => {
    const trip = useStore.getState().myTrips[0]!;
    const open = useStore.getState().hostRide({
      tripId: trip.id,
      direction: 'to_airport',
      airportIata: trip.segments[0]!.from,
      point: { lat: 51.5045, lon: -0.1157, label: 'South Bank' },
      window: { from: SEED_NOW, to: '2026-09-02T19:00:00Z' as never },
      seatsTotal: 3,
      audience: { kind: 'open', rules: { genders: 'any', minAssurance: 0, requiredStampKinds: [], circles: 'any', intents: 'any', blocked: [] } },
    });
    expect(open.inviteCode).toBeUndefined();
    expect(open.status).toBe('open');
    expect(seatsLeft(open)).toBe(2);

    const link = useStore.getState().hostRide({
      tripId: trip.id,
      direction: 'to_airport',
      airportIata: trip.segments[0]!.from,
      point: { lat: 51.5045, lon: -0.1157, label: 'South Bank' },
      window: { from: SEED_NOW, to: '2026-09-02T19:00:00Z' as never },
      seatsTotal: 3,
      audience: { kind: 'invite' },
    });
    expect(link.inviteCode).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('refuses a circle car with no circle, rather than opening it to everyone', () => {
    const trip = useStore.getState().myTrips[0]!;
    expect(() =>
      useStore.getState().hostRide({
        tripId: trip.id,
        direction: 'from_airport',
        airportIata: trip.segments[0]!.to,
        point: { lat: 1.283, lon: 103.8607, label: 'Marina Bay' },
        window: { from: SEED_NOW, to: '2026-09-03T12:00:00Z' as never },
        seatsTotal: 3,
        audience: { kind: 'circles', circleIds: [] },
      }),
    ).toThrow(/nobody/i);
  });
});

describe('useRide', () => {
  it('returns a car you may see and hides one you may not', () => {
    const { result } = renderHook(() => useRide('ride_jonas_marina'));
    expect(result.current?.route).toEqual({ from: 'SIN', to: 'Marina Bay' });

    useStore.setState({ me: { ...useStore.getState().me, memberships: [] } });
    const { result: hidden } = renderHook(() => useRide('ride_jonas_marina'));
    expect(hidden.current).toBeUndefined();
  });

  it('still shows a car you hold a seat in after the door narrows', () => {
    useStore.getState().claimSeat('ride_jonas_marina');
    useStore.setState({
      me: { ...useStore.getState().me, memberships: [] },
      // Keep a membership-free viewer, but the seat is already held.
    });
    const { result } = renderHook(() => useRide('ride_jonas_marina'));
    expect(result.current).toBeDefined();
  });

  it('is undefined for a car that does not exist', () => {
    const { result } = renderHook(() => useRide('ride_nope'));
    expect(result.current).toBeUndefined();
  });
});

describe('unused circle ids', () => {
  it('a circle the viewer is not in does not admit them', () => {
    useStore.setState({
      me: {
        ...useStore.getState().me,
        memberships: [
          {
            circleId: asCircleId('northwind'),
            personId: asPersonId('you'),
            display: 'show_badge',
            joinedAt: SEED_NOW,
            admittedBy: 'email_domain',
            role: 'member',
          },
        ],
      },
    });
    const { result } = renderHook(() => useJoinableRides());
    expect(result.current.rows.map((r) => String(r.ride.id))).not.toContain('ride_jonas_marina');
  });
});

/**
 * Regressions from the 2026-09-16 persona round.
 *
 * Each of these is a hole somebody walked through, written as the walk rather
 * than as the patch — a test named after the fix tends to pass for the wrong
 * reason once the fix moves.
 */
describe('what the persona round found', () => {
  it('hides a car once anyone in it is someone you hid', () => {
    // The adversary's route: she hides me, then takes a seat in a third
    // party's car, and her face comes back on my board beside a named
    // airport and a one-hour window. The audience rules only ever asked
    // about the host.
    const rides = useStore.getState().rides.map((r) =>
      String(r.id) === 'ride_mira_tiong'
        ? {
            ...r,
            claims: [
              { personId: asPersonId('priya'), status: 'confirmed' as const, askedAt: SEED_NOW, history: [] },
            ],
          }
        : r,
    );
    useStore.setState({ rides });

    const before = renderHook(() => useJoinableRides());
    expect(before.result.current.rows.map((r) => String(r.ride.id))).toContain('ride_mira_tiong');

    useStore.setState({ me: { ...useStore.getState().me, blocked: [asPersonId('priya')] } });
    const after = renderHook(() => useJoinableRides());
    expect(after.result.current.rows.map((r) => String(r.ride.id))).not.toContain('ride_mira_tiong');
  });

  it('kills a seat in both directions when you block someone', () => {
    // revokeClaimByPolicy() was written for exactly this and had no caller.
    const rides = useStore.getState().rides.map((r) =>
      String(r.id) === 'ride_you_cph'
        ? {
            ...r,
            claims: [
              { personId: asPersonId('priya'), status: 'confirmed' as const, askedAt: SEED_NOW, history: [] },
            ],
          }
        : r,
    );
    useStore.setState({ rides });

    useStore.getState().blockPerson(asPersonId('priya'));
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!;
    expect(ride.claims[0]!.status).toBe('revoked_by_policy');
  });

  it('does not let the seat count betray a decline', () => {
    // Seats fall when somebody asks and rise when they are refused: an oracle
    // for the one fact the product promises to keep from them.
    const before = seatsLeft(useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!);

    const rides = useStore.getState().rides.map((r) =>
      String(r.id) === 'ride_you_cph'
        ? {
            ...r,
            claims: [
              { personId: asPersonId('priya'), status: 'requested' as const, askedAt: SEED_NOW, history: [] },
            ],
          }
        : r,
    );
    useStore.setState({ rides });
    const whileAsking = seatsLeft(useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!);

    useStore.getState().declineSeat('ride_you_cph', asPersonId('priya'));
    const afterDecline = seatsLeft(useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!);

    expect(whileAsking).toBe(before);
    expect(afterDecline).toBe(before);
  });

  it('does not offer a car from a trip its host has hidden', () => {
    const mira = tripFor('mira')!;
    const listing = mira.visibility.listing;
    try {
      // The hide button and the car row render inside the same card, and the
      // car ignored the button entirely.
      mira.visibility.listing = 'hidden';
      const { result } = renderHook(() => useJoinableRides());
      expect(result.current.rows.map((r) => String(r.ride.id))).not.toContain('ride_mira_tiong');
    } finally {
      mira.visibility.listing = listing;
    }
  });

  it('lets a host take back a seat she already granted', () => {
    const rides = useStore.getState().rides.map((r) =>
      String(r.id) === 'ride_you_cph'
        ? {
            ...r,
            claims: [
              { personId: asPersonId('priya'), status: 'confirmed' as const, askedAt: SEED_NOW, history: [] },
            ],
          }
        : r,
    );
    useStore.setState({ rides });

    useStore.getState().removeSeat('ride_you_cph', asPersonId('priya'));
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!;
    expect(ride.claims[0]!.status).toBe('removed_by_host');
    // And a passenger cannot use it on somebody else's seat.
    expect(ride.claims[0]!.history[0]!.by).toBe('you');
  });

});
