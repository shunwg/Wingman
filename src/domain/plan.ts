import type { IataCode, MeetId, MeetRequestId, PersonId, RideId } from './ids';
import { asMeetId } from './ids';
import { epoch, type ISODateTime } from './time';
import type { Message } from './channel';
import type { Meet, MeetMessageBody, PublicPlace } from './meet';
import { makeMeet, makePublicPlace } from './guards';
import { riders, type Ride } from './ride';

/**
 * The agreed plan.
 *
 * A room's whole job is to turn a yes-to-meet into a time and a place, and
 * until v9 it could not: a suggestion could be put in a calendar or answered
 * with another, but nobody could say yes to it, so no room ever produced a
 * plan and `makeMeet()` had no caller.
 *
 * The plan is **derived from the room's log**, never stored. Saying yes posts
 * an `agreed` message naming the suggestion; calling it off posts a `plan_off`
 * naming it too. The plan is whatever the log says it is at the moment you
 * read it — so it cannot disagree with the messages both people can see, and
 * rule 2 holds without anyone having to remember it.
 *
 * It changes only by agreement. A newer suggestion is an offer; the plan that
 * stands is untouched until the other person says yes to the new one.
 */

export type ProposalBody = Extract<MeetMessageBody, { kind: 'proposal' }>;
export type ProposalMessage = Message & { body: ProposalBody };

export interface AgreedPlan {
  proposal: ProposalMessage;
  agreedBy: PersonId;
  agreedAt: ISODateTime;
}

/**
 * Why a yes is refused.
 *
 * `own` — suggesting a time is already your half of the yes; agreeing to your
 * own would let one person make a plan alone. `past` — a time that has started
 * cannot be agreed to. `superseded` — somebody has suggested something newer,
 * and the conversation has moved past this offer. `already` — it is the plan.
 * `called_off` — this one was the plan and was called off; saying yes to it
 * again would let one person put back what the other just took down.
 * `not_in_room` — only the people the room belongs to can agree anything in it.
 */
export type AgreeRefusal = 'not_a_proposal' | 'own' | 'past' | 'superseded' | 'already' | 'called_off' | 'not_in_room';

const isProposal = (m: Message | undefined): m is ProposalMessage => m?.body.kind === 'proposal';

/**
 * The rules, once. The store's write path and the log's read path both call
 * this, so a replayed or hand-edited log cannot produce a plan the app would
 * have refused to write.
 */
function refusal(
  log: readonly Message[],
  current: AgreedPlan | null,
  proposalId: string,
  by: PersonId,
  at: ISODateTime,
  members?: readonly PersonId[],
): AgreeRefusal | null {
  if (members && !members.some((m) => String(m) === String(by))) return 'not_in_room';
  const index = log.findIndex((m) => String(m.id) === proposalId);
  const proposal = log[index];
  if (!isProposal(proposal)) return 'not_a_proposal';
  if (members && !members.some((m) => String(m) === String(proposal.from))) return 'not_a_proposal';
  if (String(proposal.from) === String(by)) return 'own';
  // Instants, not strings: `addMinutes` writes milliseconds and the seed does
  // not, and '18:10:00.000Z' sorts before '18:10:00Z'.
  if (epoch(at) >= epoch(proposal.body.window.from)) return 'past';
  // A yes cannot come before the thing it answers.
  if (epoch(at) < epoch(proposal.at)) return 'not_a_proposal';
  if (current && String(current.proposal.id) === proposalId) return 'already';
  if (log.slice(index + 1).some(isProposal)) return 'superseded';
  if (calledOffIn(log, members).has(proposalId)) return 'called_off';
  return null;
}

/**
 * Suggestions that were the plan and were called off by someone in the room.
 *
 * Only those. A `plan_off` naming a suggestion that was never the plan — or
 * sent by someone outside the room — used to make that suggestion dead too,
 * which let one person kill the other's offer before it was ever answered.
 */
function calledOffIn(log: readonly Message[], members?: readonly PersonId[]): Set<string> {
  const dead = new Set<string>();
  const member = (p: PersonId) => !members || members.some((x) => String(x) === String(p));
  let current: string | null = null;
  for (let i = 0; i < log.length; i++) {
    const m = log[i]!;
    if (m.body.kind === 'agreed' && member(m.from)) {
      const target = log.slice(0, i).find((x) => String(x.id) === String(m.body.kind === 'agreed' ? m.body.proposalId : ''));
      if (isProposal(target) && String(target.from) !== String(m.from) && epoch(m.at) >= epoch(target.at)) {
        if (!dead.has(String(target.id))) current = String(target.id);
      }
    } else if (m.body.kind === 'plan_off' && member(m.from) && current === String(m.body.proposalId)) {
      dead.add(current);
      current = null;
    }
  }
  return dead;
}

const PLACE_KINDS: ReadonlySet<string> = new Set([
  'gate', 'lounge', 'terminal_landmark', 'cafe', 'restaurant', 'taxi_rank', 'station', 'hotel_lobby', 'pickup_point',
]);
/** A stored kind the type no longer knows reads as a landmark, not a crash. */
const PUBLIC_KIND_OR_LANDMARK = (k: string | undefined): PublicPlace['kind'] =>
  k && PLACE_KINDS.has(k) ? (k as PublicPlace['kind']) : 'terminal_landmark';

/** Can `by` say yes to this suggestion at `at`, given what has been said so far? */
export function canAgree(
  log: readonly Message[],
  proposalId: string,
  by: PersonId,
  at: ISODateTime,
  members?: readonly PersonId[],
): AgreeRefusal | null {
  return refusal(log, agreedPlan(log, members), proposalId, by, at, members);
}

/** Calling off needs a plan, and the one you meant. */
export function canCallOff(
  log: readonly Message[],
  proposalId: string,
  members?: readonly PersonId[],
): 'no_plan' | null {
  const plan = agreedPlan(log, members);
  return plan && String(plan.proposal.id) === proposalId ? null : 'no_plan';
}

/**
 * Walk the room in order; the last valid yes that has not been called off wins.
 *
 * `members`, when given, are the only people whose yes or call-off counts —
 * a line from anyone else in a replayed or hand-edited log is ignored, as the
 * write path would have refused it.
 */
export function agreedPlan(log: readonly Message[], members?: readonly PersonId[]): AgreedPlan | null {
  let plan: AgreedPlan | null = null;
  const member = (p: PersonId) => !members || members.some((x) => String(x) === String(p));
  for (let i = 0; i < log.length; i++) {
    const m = log[i]!;
    if (m.body.kind === 'agreed') {
      const before = log.slice(0, i);
      const id = String(m.body.proposalId);
      if (refusal(before, plan, id, m.from, m.at, members) !== null) continue;
      const proposal = before.find((x) => String(x.id) === id) as ProposalMessage;
      plan = { proposal, agreedBy: m.from, agreedAt: m.at };
    } else if (m.body.kind === 'plan_off') {
      if (member(m.from) && plan && String(plan.proposal.id) === String(m.body.proposalId)) plan = null;
    }
  }
  return plan;
}

/** Where the agreed plan is, as a place the type system accepts as public ground. */
export function planPlace(
  plan: AgreedPlan,
  anchor: { airportIata?: IataCode; cityKey?: PublicPlace['cityKey'] },
): PublicPlace {
  return makePublicPlace(
    {
      kind: PUBLIC_KIND_OR_LANDMARK(plan.proposal.body.placeKind),
      label: plan.proposal.body.placeLabel,
      ...(anchor.airportIata ? { airportIata: anchor.airportIata } : {}),
      ...(anchor.cityKey ? { cityKey: anchor.cityKey } : {}),
    },
    // Reading what is already in the room: never throw on it.
    { vetLabel: false },
  );
}

/*
 * Meet ids are derived from what the meet came from, like room ids are. The
 * strings deliberately equal the room ids (`meet:<request>`, `ride:<ride>`):
 * ratings were keyed by a room id cast to a MeetId before a meet existed, and
 * choosing the same string means every one of them still resolves.
 */
export const meetIdForRequest = (requestId: MeetRequestId | string): MeetId =>
  asMeetId(`meet:${String(requestId)}`);
export const meetIdForRide = (rideId: RideId | string): MeetId => asMeetId(`ride:${String(rideId)}`);

/** The meet a room belongs to: a request's room or a car's. A circle's General has none. */
export function meetIdForChannel(channelId: string): MeetId | undefined {
  if (channelId.startsWith('meet:')) return meetIdForRequest(channelId.slice('meet:'.length));
  if (channelId.startsWith('ride:')) return meetIdForRide(channelId.slice('ride:'.length));
  return undefined;
}

/** The pairwise meet an agreed plan stands for. */
export function meetFromPlan(
  plan: AgreedPlan,
  ctx: {
    requestId: MeetRequestId;
    participants: PersonId[];
    airportIata?: IataCode;
    cityKey?: PublicPlace['cityKey'];
  },
): Meet {
  return makeMeet({
    id: meetIdForRequest(ctx.requestId),
    participants: ctx.participants,
    kind: plan.proposal.body.meetKind,
    origin: { kind: 'request', requestId: ctx.requestId },
    place: planPlace(plan, ctx),
    window: plan.proposal.body.window,
  });
}

/**
 * A car's plan, straight from the car.
 *
 * Nobody negotiates it: the host owns the window, and the riders are whoever is
 * confirmed. It exists from the moment there are two people in the car, so the
 * guardian and ratings have something to attach to; it is gone once the car is
 * called off.
 *
 * Leaving the airport, everyone meets at the rank. Heading for it, they meet
 * at the pickup point — a neighbourhood centroid by construction, never an
 * address.
 */
export function meetForRide(ride: Ride): Meet | null {
  if (ride.status === 'cancelled') return null;
  const people = riders(ride);
  if (people.length < 2) return null;
  const place =
    ride.direction === 'from_airport'
      ? makePublicPlace({ kind: 'taxi_rank', label: `Taxi rank · ${String(ride.airportIata)}`, airportIata: ride.airportIata })
      : makePublicPlace(
          {
            kind: 'pickup_point',
            label: ride.point.label,
            airportIata: ride.airportIata,
            lat: ride.point.lat,
            lon: ride.point.lon,
          },
          { vetLabel: false },
        );
  return makeMeet({
    id: meetIdForRide(ride.id),
    participants: people,
    kind: 'ride_share',
    origin: { kind: 'ride', rideId: ride.id },
    place,
    window: ride.window,
  });
}
