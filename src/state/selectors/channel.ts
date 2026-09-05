import { useMemo } from 'react';
import type {
  AvatarSpec,
  Channel,
  Circle,
  FlightSegment,
  JourneyStage,
  MeetRequest,
  Message,
} from '@domain/index';
import { seedPool } from '@data/seed/trips';
import { personById } from '@data/seed/people';
import { useStore } from '../store';
import { allCircles } from './circles';
import { channelsFor, messagesFor } from './inbox';
import { useRequests } from './requests';

/**
 * One channel, resolved: its messages, who is in it, and — for a meet — where
 * each of you is.
 *
 * Terminals are *derived from the flight*, never asked for. The trip already
 * knows that SQ317 leaves Heathrow from T2, so making someone type it asks
 * them to re-enter what the app was told when they added the ticket, and to
 * be wrong about it under pressure.
 *
 * The other person's terminal appears only once they have posted a stage
 * update. Their flight tells us where they must be; showing it before they
 * have said anything turns a yes-to-coffee into a location disclosure they
 * did not make.
 */

export interface Participant {
  id: string;
  firstName: string;
  avatar: AvatarSpec;
  isMe: boolean;
  stage?: JourneyStage;
  stageAt?: string;
  terminal?: string;
  airportIata?: string;
  flightNo?: string;
}

const AFTER_LANDING: JourneyStage[] = ['landed', 'through_immigration', 'through_baggage', 'at_meeting_point'];

/**
 * Which terminal someone is standing in, anchored on the airport the meet is
 * at rather than the first segment of their trip — a connecting passenger is
 * not at their departure airport.
 */
export function terminalFor(
  segments: FlightSegment[],
  airportIata: string | undefined,
  stage: JourneyStage | undefined,
): Pick<Participant, 'terminal' | 'airportIata' | 'flightNo'> {
  if (segments.length === 0) return {};
  const arriving = segments.find((s) => String(s.to) === airportIata);
  const departing = segments.find((s) => String(s.from) === airportIata);
  const landed = stage ? AFTER_LANDING.includes(stage) : false;
  const pick = landed ? (arriving ?? departing) : (departing ?? arriving);
  if (!pick) {
    const first = segments[0]!;
    return { airportIata: String(first.from), flightNo: first.flightNo };
  }
  const facingArrival = String(pick.to) === airportIata;
  const terminal = facingArrival ? pick.terminalTo : pick.terminalFrom;
  return {
    ...(terminal ? { terminal } : {}),
    airportIata: airportIata ?? String(facingArrival ? pick.to : pick.from),
    flightNo: pick.flightNo,
  };
}

export function latestStage(messages: Message[], personId: string) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (String(m.from) !== personId || m.body.kind !== 'stage') continue;
    return { stage: m.body.stage, at: String(m.at) };
  }
  return undefined;
}

export interface ChannelView {
  channel: Channel;
  messages: Message[];
  circle?: Circle;
  request?: MeetRequest;
  /** Meet: [me, them]. Group: everyone. Circle: empty (members are a count). */
  participants: Participant[];
  mine?: Participant;
  theirs?: Participant;
  sameTerminal: boolean;
  muted: boolean;
}

export function useChannel(channelId: string): ChannelView | undefined {
  const me = useStore((s) => s.me);
  const myTrips = useStore((s) => s.myTrips);
  const myCircles = useStore((s) => s.myCircles);
  const stored = useStore((s) => s.channels);
  const allMessages = useStore((s) => s.messages);
  const muted = useStore((s) => s.muted);
  const { accepted } = useRequests();

  return useMemo(() => {
    const circleIds = me.memberships.map((m) => String(m.circleId));
    const channel = channelsFor(me.id, accepted, circleIds, stored).find((c) => String(c.id) === channelId);
    if (!channel) return undefined;

    const messages = messagesFor(channel.id, allMessages);
    const circles = allCircles(myCircles);
    const circle = channel.circleId ? circles.find((c) => String(c.id) === String(channel.circleId)) : undefined;
    const isMuted = muted.includes(channelId);

    if (channel.kind === 'meet') {
      const request = accepted.find((r) => String(r.id) === String(channel.requestId));
      const otherId = String(channel.memberIds.find((id) => id !== me.id) ?? '');
      const other = personById(otherId);
      const meetAirport = request?.overlapRef.airport ? String(request.overlapRef.airport) : undefined;
      const mineStage = latestStage(messages, String(me.id));
      const theirsStage = latestStage(messages, otherId);
      const mySegments = (myTrips.find((t) => t.id === request?.tripId) ?? myTrips[0])?.segments ?? [];
      const theirSegments = seedPool().find((e) => String(e.person.id) === otherId)?.trip.segments ?? [];

      const mine: Participant = {
        id: String(me.id),
        firstName: me.firstName || 'You',
        avatar: me.avatar,
        isMe: true,
        ...(mineStage ? { stage: mineStage.stage, stageAt: mineStage.at } : {}),
        ...terminalFor(mySegments, meetAirport, mineStage?.stage),
      };
      const theirs: Participant = {
        id: otherId,
        firstName: other?.firstName ?? 'They',
        avatar: other?.avatar ?? me.avatar,
        isMe: false,
        ...(theirsStage ? { stage: theirsStage.stage, stageAt: theirsStage.at } : {}),
        // Only after they have said where they are.
        ...(theirsStage ? terminalFor(theirSegments, meetAirport, theirsStage.stage) : {}),
      };
      return {
        channel,
        messages,
        ...(circle ? { circle } : {}),
        ...(request ? { request } : {}),
        participants: [mine, theirs],
        mine,
        theirs,
        sameTerminal:
          Boolean(mine.terminal) && mine.terminal === theirs.terminal && mine.airportIata === theirs.airportIata,
        muted: isMuted,
      };
    }

    const participants: Participant[] = channel.memberIds.map((id) => {
      if (id === me.id) return { id: String(id), firstName: me.firstName || 'You', avatar: me.avatar, isMe: true };
      const p = personById(String(id));
      return { id: String(id), firstName: p?.firstName ?? 'Member', avatar: p?.avatar ?? me.avatar, isMe: false };
    });
    return { channel, messages, ...(circle ? { circle } : {}), participants, sameTerminal: false, muted: isMuted };
  }, [channelId, me, myTrips, myCircles, stored, allMessages, muted, accepted]);
}

/** Who wrote a message, for a bubble's name line. */
export function authorName(personId: string, meId: string, meFirstName: string): string {
  if (personId === meId) return meFirstName || 'You';
  return personById(personId)?.firstName ?? 'Member';
}
