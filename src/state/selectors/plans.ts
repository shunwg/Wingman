import { useMemo } from 'react';
import type { CityKey, IataCode, Meet, MeetRequest, Message, PersonId, Trip } from '@domain/index';
import {
  agreedPlan,
  calledOffIn,
  canAgree,
  meetChannelId,
  meetForRide,
  meetFromPlan,
  rideChannelId,
  rideRoute,
  type AgreedPlan,
  type ProposalMessage,
} from '@domain/index';
import { epoch, type ISODateTime } from '@domain/time';
import { personById } from '@data/seed/people';
import { MEET_KIND_LABEL } from '@data/copy/meetKinds';
import { PLAN_COPY } from '@data/copy/plans';
import { useStore } from '../store';
import { messagesFor } from '../log';
import { useRequests } from './requests';
import { tripForRide } from './rides';

/**
 * Agreed plans, as the screens read them.
 *
 * Everything here is derived from the room's log (a pairwise meet) or from the
 * car itself (a shared ride) on every read. Nothing is stored: a plan that was
 * called off a second ago is gone from the strip, the card and the trip in the
 * same render, because there was never a copy of it to go stale.
 */

/** What a suggestion card in the room should offer. */
export type ProposalState =
  /** It is the plan. */
  | 'agreed'
  /** Someone else's, in the future, the newest thing on the table — That works. */
  | 'agreeable'
  /** Yours, still open. */
  | 'waiting'
  /** Its time has started. */
  | 'passed'
  /** A newer suggestion took its place. */
  | 'replaced';

const isProposal = (m: Message): m is ProposalMessage => m.body.kind === 'proposal';

export interface RoomPlan {
  plan: AgreedPlan | null;
  /** The plan as a meet on public ground — `makeMeet()`'s product. */
  meet: Meet | null;
  /**
   * The newest suggestion you could say yes to while a plan already stands.
   * The strip names it so the standing plan is never mistaken for the new one.
   */
  offer: ProposalMessage | null;
  /** Per suggestion id, what its card should say. */
  states: Map<string, ProposalState>;
}

export interface PlaceAnchor {
  airportIata?: IataCode;
  cityKey?: CityKey;
}

/**
 * Which airport or city a room's plan belongs to.
 *
 * `makePublicPlace()` refuses a place anchored to nothing, deliberately. The
 * request names its airport or city for every overlap but one: two people on
 * the same flight share a flight, not a place, so the anchor comes from your
 * trip — the arrival end for a shared ride in, the departure end otherwise.
 * No anchor at all means no meet: the room still shows the plan, but it is not
 * placed on a trip it cannot be tied to.
 */
export function anchorFor(request: MeetRequest, myTrips: readonly Trip[]): PlaceAnchor | null {
  const o = request.overlapRef;
  if (o.airport) return { airportIata: o.airport };
  if (o.cityKey) return { cityKey: o.cityKey };
  const trip = myTrips.find((t) => String(t.id) === String(request.tripId));
  const seg = request.proposal.kind === 'ride_share' ? trip?.segments.at(-1) : trip?.segments[0];
  if (!seg) return null;
  return { airportIata: request.proposal.kind === 'ride_share' ? seg.to : seg.from };
}

/** Pure: the room's plan and the state of every suggestion in it. */
export function roomPlan(
  log: readonly Message[],
  meId: PersonId,
  now: ISODateTime,
  ctx: { request: MeetRequest; participants: PersonId[]; anchor: PlaceAnchor | null },
): RoomPlan {
  const plan = agreedPlan(log, ctx.participants);
  // The same rule the domain uses: only a call-off that ended the plan, from
  // someone in the room. Any plan_off at all used to mark a card "Replaced".
  const calledOff = calledOffIn(log, ctx.participants);
  const proposals = log.filter(isProposal);
  const newest = proposals.at(-1);
  const states = new Map<string, ProposalState>();

  for (const p of proposals) {
    const id = String(p.id);
    if (plan && String(plan.proposal.id) === id) states.set(id, 'agreed');
    else if (epoch(now) >= epoch(p.body.window.from)) states.set(id, 'passed');
    else if (p !== newest || calledOff.has(id)) states.set(id, 'replaced');
    else if (String(p.from) === String(meId)) states.set(id, 'waiting');
    else states.set(id, canAgree(log, id, meId, now, ctx.participants) === null ? 'agreeable' : 'replaced');
  }

  const offer =
    plan && newest && states.get(String(newest.id)) === 'agreeable' ? newest : null;

  const meet =
    plan && ctx.anchor
      ? meetFromPlan(plan, { requestId: ctx.request.id, participants: ctx.participants, ...ctx.anchor })
      : null;
  return { plan, meet, offer, states };
}

/** A meet room's plan. Undefined for any other kind of room. */
export function usePlanForChannel(channelId: string): RoomPlan | undefined {
  const stored = useStore((s) => s.messages);
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const myTrips = useStore((s) => s.myTrips);
  const { accepted } = useRequests();

  return useMemo(() => {
    const request = accepted.find((r) => String(meetChannelId(r.id)) === channelId);
    if (!request) return undefined;
    return roomPlan(messagesFor(channelId, stored), me.id, now, {
      request,
      participants: [request.fromPersonId, request.toPersonId],
      anchor: anchorFor(request, myTrips),
    });
  }, [channelId, stored, me.id, now, accepted, myTrips]);
}

/** One line on a trip: what, when, with whom, and which room to open. */
export interface TripPlanRow {
  key: string;
  meet: Meet;
  channelId: string;
  /** "Coffee at the gate with Priya" / "Shared car · SIN → Marina Bay". */
  title: string;
  kind: 'meet' | 'car';
  /** Either of you said you can't make it after the yes. */
  doubt: boolean;
}

/**
 * Which of your trips a pairwise meet belongs to.
 *
 * The request's own trip when it is yours — you sent it. When it was sent to
 * you, the id names the *sender's* trip, so fall back to your trip that passes
 * through the meet's airport nearest the meet's time.
 */
function tripForMeet(meet: Meet, request: MeetRequest, myTrips: readonly Trip[]): Trip | undefined {
  const own = myTrips.find((t) => String(t.id) === String(request.tripId));
  if (own) return own;
  const airport = meet.place.airportIata ? String(meet.place.airportIata) : undefined;
  if (!airport) return undefined;
  const at = epoch(meet.window.from);
  let best: { trip: Trip; gap: number } | undefined;
  for (const t of myTrips) {
    for (const s of t.segments) {
      const touches =
        String(s.from) === airport ? epoch(s.departUtc) : String(s.to) === airport ? epoch(s.arriveUtc) : undefined;
      if (touches === undefined) continue;
      const gap = Math.abs(touches - at);
      if (!best || gap < best.gap) best = { trip: t, gap };
    }
  }
  return best?.trip;
}

/** Every plan on one of your trips, soonest first. */
export function usePlansForTrip(trip: Trip): TripPlanRow[] {
  const stored = useStore((s) => s.messages);
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const myTrips = useStore((s) => s.myTrips);
  const rides = useStore((s) => s.rides);
  const { accepted } = useRequests();

  return useMemo(() => {
    const rows: TripPlanRow[] = [];

    for (const request of accepted) {
      if (request.fromPersonId !== me.id && request.toPersonId !== me.id) continue;
      const otherId = request.fromPersonId === me.id ? request.toPersonId : request.fromPersonId;
      if (me.blocked.includes(otherId)) continue;
      const channelId = String(meetChannelId(request.id));
      const { meet } = roomPlan(messagesFor(channelId, stored), me.id, now, {
        request,
        participants: [request.fromPersonId, request.toPersonId],
        anchor: anchorFor(request, myTrips),
      });
      if (!meet) continue;
      if (String(tripForMeet(meet, request, myTrips)?.id) !== String(trip.id)) continue;
      const other = request.fromPersonId === me.id ? request.toPersonId : request.fromPersonId;
      const name = personById(String(other))?.firstName ?? 'them';
      const log = messagesFor(channelId, stored);
      const yesAt = log.map((m) => m.body.kind).lastIndexOf('agreed');
      const doubt = log
        .slice(yesAt + 1)
        .some((m) => m.body.kind === 'stage' && m.body.stage === 'cannot_make_it');
      rows.push({
        key: channelId,
        meet,
        channelId,
        title: `${MEET_KIND_LABEL[meet.kind]} with ${name}`,
        kind: 'meet',
        doubt,
      });
    }

    for (const ride of rides) {
      const meet = meetForRide(ride);
      if (!meet) continue;
      if (!meet.participants.some((p) => String(p) === String(me.id))) continue;
      if (String(tripForRide(ride, myTrips, String(me.id))?.id) !== String(trip.id)) continue;
      const route = rideRoute(ride);
      rows.push({
        key: String(ride.id),
        meet,
        channelId: String(rideChannelId(String(ride.id))),
        title: `${PLAN_COPY.trip.car} · ${route.from} → ${route.to}`,
        kind: 'car',
        doubt: false,
      });
    }

    return rows.sort((a, b) => epoch(a.meet.window.from) - epoch(b.meet.window.from));
  }, [accepted, stored, me.id, me.blocked, now, myTrips, rides, trip.id]);
}
