import type { ChannelKind, MeetKind, MeetRequest, ProposalBody, PublicPlace } from '@domain/index';
import { addMinutes, epoch, type ISODateTime } from '@domain/time';

/**
 * Scripted replies, so the demo feels alive without pretending to be a server.
 *
 * One per channel kind per turn, chosen by how many messages the channel
 * already holds — deterministic, and honest: nobody is typing on the other
 * end, and the copy on the screen says so.
 */
const REPLIES: Record<ChannelKind, string[]> = {
  meet: [
    'Perfect. I am by the window seats near the coffee place.',
    'Got it. Two minutes away.',
    'See you there.',
  ],
  circle: [
    'Good to know, thanks for posting.',
    'Count me in for that.',
    'Someone said the same thing in the lounge earlier.',
  ],
  group: [
    'Works for me.',
    'I can do that time.',
    'Sounds good, see you all there.',
  ],
};

export function scriptedReply(kind: ChannelKind, turn: number): string {
  const list = REPLIES[kind];
  return list[turn % list.length]!;
}

/**
 * What a seeded person suggests the moment you say yes to their hello.
 *
 * Demo only, deterministic, and inside the window their request was about —
 * the half hour after it opens, or after now if it has already opened. It is
 * there so the first room anyone opens in the demo has something to say yes
 * to; without it the plan strip is reachable only by suggesting a time
 * yourself, which a first-time visitor has no reason to try.
 */
export function scriptedProposal(request: MeetRequest, now: ISODateTime): ProposalBody {
  const w = request.proposal.window;
  const opens = epoch(w.from) > epoch(now) ? w.from : roundUp(now, 15);
  const from = epoch(opens) < epoch(w.to) ? opens : w.from;
  const to = addMinutes(from, 30);
  const airport = request.overlapRef.airport ? String(request.overlapRef.airport) : '';
  const place = request.proposal.place;
  return {
    kind: 'proposal',
    meetKind: request.proposal.kind,
    window: { from, to },
    placeLabel: place?.label ?? `${SCRIPTED_PLACE[request.proposal.kind].label}${airport ? `, ${airport}` : ''}`,
    placeKind: place?.kind ?? SCRIPTED_PLACE[request.proposal.kind].kind,
  };
}

const SCRIPTED_PLACE: Record<MeetKind, { kind: PublicPlace['kind']; label: string }> = {
  gate_coffee: { kind: 'cafe', label: 'The coffee bar by the departures board' },
  lounge: { kind: 'lounge', label: 'Lounge reception' },
  terminal_walk: { kind: 'terminal_landmark', label: 'Under the departures board' },
  ride_share: { kind: 'taxi_rank', label: 'The taxi rank' },
  meal: { kind: 'restaurant', label: 'The restaurant by the gates' },
  drinks: { kind: 'restaurant', label: 'The bar by the gates' },
  business_intro: { kind: 'cafe', label: 'The coffee bar by the departures board' },
  coworking: { kind: 'lounge', label: 'The work tables past security' },
};

function roundUp(t: ISODateTime, stepMin: number): ISODateTime {
  const ms = stepMin * 60_000;
  return new Date(Math.ceil(epoch(t) / ms) * ms).toISOString().replace('.000Z', 'Z') as ISODateTime;
}
