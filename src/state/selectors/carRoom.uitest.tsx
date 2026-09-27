import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { asPersonId, asRideId } from '@domain/ids';
import { anyAudience, makeRide, rideChannelId, type Ride } from '@domain/index';
import { useStore } from '@state/store';
import { demoState } from '@state/account/reducers';
import { MY_TRIPS, SEED_NOW } from '@data/seed/trips';
import { useChannel } from './channel';
import { useInbox } from './inbox';
import { useSeatAsks } from './rides';
import { seatLineText } from '@data/copy/rides';
import { personById } from '@data/seed/people';

/**
 * The car's room, from the QA round of 2026-09-27: who is in it has to follow
 * who is in the car, and seat changes have to be said where the car can see.
 */

const reset = () => {
  const demo = demoState('dev_test');
  useStore.setState({ ...demo, now: SEED_NOW }, false);
};
beforeEach(reset);

/** The room's lines as a reader who is none of the people named would see them. */
const lines = (rideId: string) =>
  useStore
    .getState()
    .messages.filter((m) => String(m.channelId) === String(rideChannelId(rideId)))
    .map((m) =>
      m.body.kind === 'system'
        ? m.body.text
        : m.body.kind === 'seat'
          ? seatLineText(m.body.change, String(m.from) === 'you' ? 'Alex' : (personById(String(m.from))?.firstName ?? 'Someone'))
          : '',
    );

/** Put Mira in your own car, as if she had taken the seat. */
const miraInYourCar = () => {
  act(() =>
    useStore.setState((s) => ({
      rides: s.rides.map((r) =>
        String(r.id) === 'ride_you_cph'
          ? {
              ...r,
              claims: [
                {
                  personId: asPersonId('mira'),
                  status: 'confirmed' as const,
                  askedAt: SEED_NOW,
                  history: [{ at: SEED_NOW, by: 'system' as const, from: 'requested' as const, to: 'confirmed' as const }],
                },
              ],
            }
          : r,
      ),
    })),
  );
  act(() => useStore.getState().openRideRoom('ride_you_cph'));
};

describe('who is in the car room follows who is in the car', () => {
  it('drops a passenger the host takes the seat back from, and tells the car', () => {
    miraInYourCar();
    const room = String(rideChannelId('ride_you_cph'));
    expect(renderHook(() => useChannel(room)).result.current?.participants.map((p) => p.id)).toContain('mira');

    act(() => useStore.getState().removeSeat('ride_you_cph', asPersonId('mira')));
    const after = renderHook(() => useChannel(room)).result.current;
    expect(after?.participants.map((p) => p.id)).not.toContain('mira');
    expect(after?.channel.memberIds.map(String)).toEqual(['you']);
    // The same neutral sentence as leaving: the others learn the seat is free,
    // not who ended it.
    expect(lines('ride_you_cph')).toContain('Mira is no longer in the car.');
  });
});

describe('a host’s no stands', () => {
  it('a removed passenger cannot sit down again through the link', () => {
    const linkCar: Ride = {
      ...makeRide({
        id: asRideId('ride_link'),
        hostPersonId: asPersonId('jonas'),
        tripId: MY_TRIPS[0]!.id,
        direction: 'from_airport',
        airportIata: 'SIN' as never,
        point: { lat: 1.28, lon: 103.86, label: 'Marina Bay' },
        window: { from: '2026-09-03T09:30:00Z' as never, to: '2026-09-03T10:30:00Z' as never },
        seatsTotal: 4,
        audience: { kind: 'invite', rules: anyAudience() },
        createdAt: SEED_NOW,
        inviteCode: 'ABCDEF',
      }),
      claims: [{ personId: asPersonId('you'), status: 'removed_by_host', askedAt: SEED_NOW, history: [] }],
    };
    act(() => useStore.setState((s) => ({ rides: [...s.rides, linkCar] })));
    act(() => useStore.getState().claimSeat('ride_link', { code: 'ABCDEF' }));
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_link')!;
    expect(ride.claims).toHaveLength(1);
    expect(ride.claims[0]!.status).toBe('removed_by_host');
  });
});

describe('a self-seating door still tells the car', () => {
  it('says so in the room when somebody takes a seat, and when they leave', () => {
    act(() => useStore.getState().claimSeat('ride_jonas_marina'));
    expect(lines('ride_jonas_marina')).toContain('Alex took a seat.');
    act(() => useStore.getState().withdrawSeat('ride_jonas_marina'));
    expect(lines('ride_jonas_marina')).toContain('Alex is no longer in the car.');
    // …and the room is gone from the leaver's inbox.
    const rows = renderHook(() => useInbox('all')).result.current.rows;
    expect(rows.some((r) => String(r.channelId) === String(rideChannelId('ride_jonas_marina')))).toBe(false);
  });
});

describe('the host changing the fare is said in the room', () => {
  it('when there was a number before', () => {
    miraInYourCar();
    act(() => useStore.getState().setRideFare('ride_you_cph', { amountMinor: 40000, currency: 'DKK' }));
    act(() => useStore.getState().setRideFare('ride_you_cph', { amountMinor: 52000, currency: 'DKK' }));
    expect(lines('ride_you_cph')).toContain('The host changed the estimate to about 520 DKK for the car.');
  });
});

describe('a host hears about a seat request without opening the car', () => {
  it('lists Tobias waiting on your car, and stops once you answer', () => {
    const asks = () => renderHook(() => useSeatAsks()).result.current;
    expect(asks().map((a) => String(a.claim.personId))).toEqual(['tobias']);
    act(() => useStore.getState().confirmSeat('ride_you_cph', asPersonId('tobias')));
    expect(asks()).toHaveLength(0);
    expect(lines('ride_you_cph')).toContain('Tobias is in.');
  });
});

describe('round 2: the car holds what it holds', () => {
  it('a host cannot say yes to more people than there are seats', () => {
    // Jonas's car has two seats: his and one more. You take the one.
    act(() => useStore.getState().claimSeat('ride_jonas_marina'));
    const full = useStore.getState().rides.find((r) => String(r.id) === 'ride_jonas_marina')!;
    expect(full.claims.filter((c) => c.status === 'confirmed')).toHaveLength(1);

    // Your own four-seat car: three can be confirmed, not four.
    const people = ['tobias', 'mira', 'lucas', 'priya'].map(asPersonId);
    act(() =>
      useStore.setState((s) => ({
        rides: s.rides.map((r) =>
          String(r.id) === 'ride_you_cph'
            ? { ...r, claims: people.map((p) => ({ personId: p, status: 'requested' as const, askedAt: SEED_NOW, history: [] })) }
            : r,
        ),
      })),
    );
    for (const p of people) act(() => useStore.getState().confirmSeat('ride_you_cph', p));
    const mine = useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!;
    expect(mine.claims.filter((c) => c.status === 'confirmed')).toHaveLength(3);
  });

  it('removing a trip calls off the car you host on it, and tells the car', () => {
    miraInYourCar();
    const tripId = String(useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!.tripId);
    act(() => useStore.getState().removeTrip(tripId));
    expect(useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')?.status).toBe('cancelled');
    expect(lines('ride_you_cph').some((l) => l.includes('called the car off'))).toBe(true);
  });
});

describe('round 2: a hide looks like any other departure', () => {
  it('says the same line in the car as leaving does', () => {
    miraInYourCar();
    act(() => useStore.getState().blockPerson(asPersonId('mira')));
    expect(lines('ride_you_cph')).toContain('Mira is no longer in the car.');
  });

  it('a hidden rider stays out when the car is then called off', () => {
    miraInYourCar();
    act(() => useStore.getState().blockPerson(asPersonId('mira')));
    act(() => useStore.getState().cancelRide('ride_you_cph'));
    const room = String(rideChannelId('ride_you_cph'));
    expect(renderHook(() => useChannel(room)).result.current?.channel.memberIds.map(String)).toEqual(['you']);
  });

  it('un-settles a trip that was settled with them', () => {
    act(() => useStore.getState().advanceRequest('req_seed_priya', 'accepted', asPersonId('you')));
    expect(useStore.getState().myTrips[0]!.outcome).toBeDefined();
    act(() => useStore.getState().blockPerson(asPersonId('priya')));
    expect(useStore.getState().myTrips[0]!.outcome).toBeUndefined();
  });
});

describe('round 2: a seat line is about the person, not built from what they typed', () => {
  it('stores who and what changed, with the person as its author — never the text of a name', () => {
    act(() => useStore.getState().setMe({ firstName: 'Jonas is no longer in the car. Mira\u200B' }));
    act(() => useStore.getState().claimSeat('ride_jonas_marina'));
    const seat = useStore
      .getState()
      .messages.find((m) => String(m.channelId) === String(rideChannelId('ride_jonas_marina')) && m.body.kind === 'seat')!;
    expect(seat.body).toEqual({ kind: 'seat', change: 'took' });
    expect(String(seat.from)).toBe('you');
  });

  it('cleans a name where it is set — no zero-width characters, and capped', () => {
    act(() => useStore.getState().setMe({ firstName: '\u200B' }));
    expect(useStore.getState().me.firstName).toBe('');
    act(() => useStore.getState().setMe({ firstName: 'x'.repeat(200) }));
    expect(useStore.getState().me.firstName.length).toBe(30);
  });

  it('a rider reads the room from when they joined, not before', () => {
    // Before you sit down, the host says something in the room.
    act(() => useStore.getState().openRideRoom('ride_jonas_marina'));
    act(() =>
      useStore.setState((s) => ({
        messages: [
          ...s.messages,
          {
            id: 'm_before' as never,
            channelId: rideChannelId('ride_jonas_marina'),
            from: asPersonId('jonas'),
            at: SEED_NOW,
            body: { kind: 'text' as const, text: 'Omar was in this car and left.' },
          },
        ],
      })),
    );
    act(() => useStore.getState().claimSeat('ride_jonas_marina'));
    const view = renderHook(() => useChannel(String(rideChannelId('ride_jonas_marina')))).result.current!;
    expect(view.messages.some((m) => m.body.kind === 'text' && m.body.text.includes('Omar'))).toBe(false);
    expect(view.messages[0]!.body).toEqual({ kind: 'seat', change: 'took' });
  });

  it('a fellow passenger you hide in someone else\u2019s car is hidden in its room', () => {
    // Lucas's car, with you and Mira both in it. Neither of you is the host, so
    // the hide cannot end either seat — it has to hide her from you.
    const confirmed = (id: string) => ({
      personId: asPersonId(id),
      status: 'confirmed' as const,
      askedAt: SEED_NOW,
      history: [{ at: SEED_NOW, by: 'system' as const, from: 'requested' as const, to: 'confirmed' as const }],
    });
    act(() =>
      useStore.setState((s) => ({
        rides: s.rides.map((r) => (String(r.id) === 'ride_lucas_lhr' ? { ...r, claims: [confirmed('you'), confirmed('mira')] } : r)),
      })),
    );
    act(() => useStore.getState().openRideRoom('ride_lucas_lhr'));
    act(() =>
      useStore.setState((s) => ({
        messages: [
          ...s.messages,
          { id: 'm_mira' as never, channelId: rideChannelId('ride_lucas_lhr'), from: asPersonId('mira'), at: SEED_NOW, body: { kind: 'text' as const, text: 'Hi all' } },
        ],
      })),
    );
    act(() => useStore.getState().blockPerson(asPersonId('mira')));
    const view = renderHook(() => useChannel(String(rideChannelId('ride_lucas_lhr')))).result.current!;
    expect(view.participants.map((p) => p.id)).not.toContain('mira');
    expect(view.messages.some((m) => String(m.from) === 'mira')).toBe(false);
  });
});
