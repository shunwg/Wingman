import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { asMessageId, asPersonId } from '@domain/ids';
import { meetChannelId, rideChannelId, type Message } from '@domain/index';
import { useStore } from '@state/store';
import { demoState } from '@state/account/reducers';
import { MY_TRIPS, SEED_NOW } from '@data/seed/trips';
import { PlanRefusedError } from '@state/machines/plan';
import { usePlanForChannel, usePlansForTrip } from './plans';
import { useSaidYes } from './requests';
import { tripForRide } from './rides';

/**
 * Agreed plans, against the real store: the seeded demo, the persisted log,
 * the FSM guards and the derivation all have to agree, and each is a place the
 * wiring can be wrong while every unit underneath still passes.
 */

const PRIYA_REQ = 'req_seed_priya';
const room = String(meetChannelId(PRIYA_REQ));
const LHR_TRIP = MY_TRIPS[0]!;

const reset = (mode: 'demo' | 'local' = 'demo') => {
  const demo = demoState('dev_test');
  useStore.setState({ ...demo, now: SEED_NOW, account: { ...demo.account, mode } }, false);
};

const acceptPriya = () => act(() => useStore.getState().advanceRequest(PRIYA_REQ, 'accepted', asPersonId('you')));
const plan = () => renderHook(() => usePlanForChannel(room)).result.current;
const proposalsIn = (id: string) =>
  useStore.getState().messages.filter((m) => String(m.channelId) === id && m.body.kind === 'proposal');

beforeEach(() => reset());

describe('the demo room has something to say yes to', () => {
  it('opens Priya\'s room with her suggestion inside her own window, and no plan yet', () => {
    acceptPriya();
    const p = plan()!;
    expect(p.plan).toBeNull();
    const [hers] = proposalsIn(room);
    expect(String(hers!.from)).toBe('priya');
    expect(p.states.get(String(hers!.id))).toBe('agreeable');
    if (hers!.body.kind !== 'proposal') throw new Error('unreachable');
    expect(hers!.body.window.from >= '2026-09-02T18:10:00Z').toBe(true);
    expect(hers!.body.placeKind).toBe('cafe');
  });
});

describe('agreeing', () => {
  it('makes a plan, a meet on public ground, and a line on the trip', () => {
    acceptPriya();
    const [hers] = proposalsIn(room);
    act(() => useStore.getState().agreeTo(room, String(hers!.id)));

    const p = plan()!;
    expect(String(p.plan?.proposal.id)).toBe(String(hers!.id));
    expect(p.meet?.place.isPublicGround).toBe(true);
    expect(p.meet?.place.kind).toBe('cafe');
    expect(p.states.get(String(hers!.id))).toBe('agreed');

    const rows = renderHook(() => usePlansForTrip(LHR_TRIP)).result.current;
    expect(rows.map((r) => r.title)).toContain('Coffee at the gate with Priya');
  });

  it('refuses your own suggestion — proposing is already your half of the yes', () => {
    reset('local');
    acceptPriya();
    act(() =>
      useStore.getState().post(
        { id: room as never, kind: 'meet', title: 'Priya', memberIds: [asPersonId('you'), asPersonId('priya')], createdBy: asPersonId('you'), createdAt: SEED_NOW },
        { kind: 'proposal', meetKind: 'gate_coffee', window: { from: '2026-09-02T18:40:00Z' as never, to: '2026-09-02T19:10:00Z' as never }, placeLabel: 'Gate 4', placeKind: 'gate' },
      ),
    );
    const mine = proposalsIn(room).find((m) => String(m.from) === 'you')!;
    expect(() => useStore.getState().agreeTo(room, String(mine.id))).toThrow(PlanRefusedError);
  });

  it('refuses a yes in a room you are not in', () => {
    expect(() => useStore.getState().agreeTo('meet:somebody_else', 'm1')).toThrow(PlanRefusedError);
  });
});

describe('it only changes by agreement', () => {
  it('stands when a newer time is suggested, and names the offer', () => {
    acceptPriya();
    const [hers] = proposalsIn(room);
    act(() => useStore.getState().agreeTo(room, String(hers!.id)));

    // Priya suggests something else. The plan must not move by itself.
    const newer: Message = {
      id: asMessageId('m_priya_later'),
      channelId: room as never,
      from: asPersonId('priya'),
      at: SEED_NOW,
      body: { kind: 'proposal', meetKind: 'gate_coffee', window: { from: '2026-09-02T19:00:00Z' as never, to: '2026-09-02T19:20:00Z' as never }, placeLabel: 'Gate 9', placeKind: 'gate' },
    };
    act(() => useStore.setState((s) => ({ messages: [...s.messages, newer] })));

    const p = plan()!;
    expect(String(p.plan?.proposal.id)).toBe(String(hers!.id));
    expect(String(p.offer?.id)).toBe('m_priya_later');
    expect(p.states.get('m_priya_later')).toBe('agreeable');

    act(() => useStore.getState().agreeTo(room, 'm_priya_later'));
    expect(String(plan()!.plan?.proposal.id)).toBe('m_priya_later');
  });

  it('comes off when called off, and the trip line goes with it', () => {
    acceptPriya();
    const [hers] = proposalsIn(room);
    act(() => useStore.getState().agreeTo(room, String(hers!.id)));
    act(() => useStore.getState().callOffPlan(room));
    expect(plan()!.plan).toBeNull();
    expect(renderHook(() => usePlansForTrip(LHR_TRIP)).result.current).toHaveLength(0);
    expect(() => useStore.getState().callOffPlan(room)).toThrow(PlanRefusedError);
  });

  it('in the demo, a time you suggest is agreed to — through the same rules as a real yes', () => {
    acceptPriya();
    act(() =>
      useStore.getState().post(
        { id: room as never, kind: 'meet', title: 'Priya', memberIds: [asPersonId('you'), asPersonId('priya')], createdBy: asPersonId('you'), createdAt: SEED_NOW },
        { kind: 'proposal', meetKind: 'gate_coffee', window: { from: '2026-09-02T18:40:00Z' as never, to: '2026-09-02T19:10:00Z' as never }, placeLabel: 'Gate 4', placeKind: 'gate' },
      ),
    );
    const p = plan()!;
    expect(String(p.plan?.agreedBy)).toBe('priya');
    expect(p.meet?.place.label).toBe('Gate 4');
  });
});

describe('a car has a plan once two people are in it', () => {
  it('puts a seat you took on your own trip — not the host\'s', () => {
    act(() => useStore.getState().claimSeat('ride_jonas_marina'));
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_jonas_marina')!;
    // The regression: a passenger's car used to be filtered by the host's trip id.
    expect(String(tripForRide(ride, useStore.getState().myTrips, 'you')?.id)).toBe(String(LHR_TRIP.id));

    const rows = renderHook(() => usePlansForTrip(LHR_TRIP)).result.current;
    const car = rows.find((r) => r.kind === 'car');
    expect(car?.meet.place.kind).toBe('taxi_rank');
    expect(car?.channelId).toBe(String(rideChannelId('ride_jonas_marina')));
  });

  it('rates each rider separately — a second rating does not erase the first', () => {
    const r = useStore.getState();
    const input = { showedUp: 'on_time' as const, respectedBoundaries: true, accurateProfile: true, wouldMeetAgain: true, flags: [] };
    act(() => r.rate('ride:ride_mira_tiong', asPersonId('mira'), input));
    act(() => useStore.getState().rate('ride:ride_mira_tiong', asPersonId('jonas'), input));
    const ratings = useStore.getState().ratings.filter((x) => String(x.meetId) === 'ride:ride_mira_tiong');
    expect(ratings.map((x) => String(x.rateeId)).sort()).toEqual(['jonas', 'mira']);
  });
});

describe('someone says yes to you', () => {
  const hello = () =>
    useStore.getState().sendRequest({
      fromPersonId: asPersonId('you'),
      toPersonId: asPersonId('jonas'),
      tripId: LHR_TRIP.id,
      overlapRef: { kind: 'same_flight' },
      proposal: { kind: 'ride_share', window: { from: '2026-09-03T09:30:00Z' as never, to: '2026-09-03T10:30:00Z' as never } },
      message: 'Share the ride in?',
      expiresAt: '2026-09-03T10:30:00Z' as never,
    });

  it('arrives in the demo, and shows until you open the room', () => {
    let id = '';
    act(() => {
      id = String(hello().id);
    });
    act(() => useStore.getState().answerDemoRequest(id));
    expect(useStore.getState().requests.find((r) => String(r.id) === id)?.status).toBe('accepted');

    const yes = renderHook(() => useSaidYes()).result.current;
    expect(yes.map((y) => y.channelId)).toEqual([String(meetChannelId(id))]);

    act(() => useStore.getState().markRead(String(meetChannelId(id))));
    expect(renderHook(() => useSaidYes()).result.current).toHaveLength(0);
  });

  it('never arrives in a real account, because nobody is there to send it', () => {
    reset('local');
    let id = '';
    act(() => {
      id = String(hello().id);
    });
    act(() => useStore.getState().answerDemoRequest(id));
    expect(useStore.getState().requests.find((r) => String(r.id) === id)?.status).toBe('sent');
  });
});

describe('the car\'s money and its pickup note', () => {
  it('only the host can state them, and the room hears that the note changed — not the note', () => {
    expect(() => useStore.getState().setRideFare('ride_jonas_marina', { amountMinor: 3000, currency: 'SGD' })).toThrow();

    act(() => useStore.getState().setRideFare('ride_you_cph', { amountMinor: 45000, currency: 'DKK' }));
    expect(useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')?.fare).toEqual({
      amountMinor: 45000,
      currency: 'DKK',
    });
    act(() => useStore.getState().setRideFare('ride_you_cph', null));
    expect(useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')?.fare).toBeUndefined();

    act(() => useStore.getState().setPickupNote('ride_you_cph', '  Outside the bakery on Store Kongensgade  '));
    const ride = useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')!;
    expect(ride.pickupNote).toBe('Outside the bakery on Store Kongensgade');
    const said = useStore.getState().messages.filter((m) => String(m.channelId) === 'ride:ride_you_cph');
    expect(said.every((m) => !(m.body.kind === 'system' && m.body.text.includes('bakery')))).toBe(true);
  });
});
