import { useMemo } from 'react';
import type { FlightSegment, JourneyStage, MeetMessage, MeetRequest } from '@domain/index';
import { STAGE_ORDER } from '@domain/meet';
import { seedPool } from '@data/seed/trips';
import { personById } from '@data/seed/people';
import { useStore } from '@state/store';

/**
 * One meet room.
 *
 * Terminals are *derived from the flight*, never asked for. The trip already
 * knows that SQ317 leaves Heathrow from T2 and lands at Changi in T3, so making
 * someone type it is asking them to re-enter something the app was told when
 * they added the ticket — and to be wrong about it under pressure, at the one
 * moment being wrong costs them the meeting.
 *
 * Which of the two terminals is the right one depends on where they are in the
 * journey: before boarding it is the departure terminal, after landing it is
 * the arrival one. That is what the stage is for.
 */

export interface RoomParticipant {
  id: string;
  firstName: string;
  avatarSeed: string;
  photoUrl?: string;
  stage?: JourneyStage;
  stageAt?: string;
  /** Where they are right now, as far as the flight can tell us. */
  terminal?: string;
  airportIata?: string;
  flightNo?: string;
}

const AFTER_LANDING: JourneyStage[] = [
  'landed',
  'through_immigration',
  'through_baggage',
  'at_meeting_point',
];

/**
 * Which terminal someone is standing in.
 *
 * Anchored on the airport the *meet* is at, not on the first segment of the
 * trip. Two bugs came out of the naive version and both were the same mistake:
 *
 *  · A connecting passenger is not at their departure airport. Priya's first
 *    leg is DEL→LHR, so reading `segments[0].terminalFrom` asked for the
 *    terminal at Delhi — which is undefined, and which she left hours ago. She
 *    is at Heathrow T2, and that is `terminalTo` of the leg that *arrives*
 *    where the meet is.
 *
 *  · Your own trips live in the store, not in the seeded pool, so looking
 *    yourself up in the pool returned nothing and your own card read "No
 *    flight" while you were standing in T2.
 *
 * So: find the leg that touches the meeting airport, and take the terminal on
 * the side that faces it. Departing from there means `terminalFrom`; arriving
 * there means `terminalTo`.
 */
function terminalFor(
  segments: FlightSegment[],
  airportIata: string | undefined,
  stage: JourneyStage | undefined,
) {
  if (segments.length === 0) return {};

  const arriving = segments.find((s) => String(s.to) === airportIata);
  const departing = segments.find((s) => String(s.from) === airportIata);

  // Once they have landed, the arrival side is the live one even if they also
  // depart from here later.
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

function latestStage(messages: MeetMessage[], personId: string) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (String(m.from) !== personId || m.body.kind !== 'stage') continue;
    return { stage: m.body.stage, at: String(m.at) };
  }
  return undefined;
}

export function useMeetRoom(requestId: string) {
  const me = useStore((s) => s.me);
  const myTrips = useStore((s) => s.myTrips);
  const requests = useStore((s) => s.requests);
  const allMessages = useStore((s) => s.messages);
  const postStage = useStore((s) => s.postStage);
  const postText = useStore((s) => s.postText);

  return useMemo(() => {
    const request: MeetRequest | undefined = requests.find((r) => String(r.id) === requestId);
    // Only an accepted request has a room. A room you can open before the other
    // person has agreed is a channel for pestering somebody who has not replied.
    if (!request || request.status !== 'accepted') {
      return { request: undefined } as const;
    }

    const messages = allMessages
      .filter((m) => String(m.requestId) === requestId)
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));

    const otherId = String(
      request.fromPersonId === me.id ? request.toPersonId : request.fromPersonId,
    );
    const other = personById(otherId);

    const mineStage = latestStage(messages, String(me.id));
    const theirsStage = latestStage(messages, otherId);

    // The airport this meet is actually at — the anchor both terminals resolve
    // against. Without it, a connecting passenger's terminal is read off the
    // wrong leg of their trip.
    const meetAirport = request.overlapRef.airport
      ? String(request.overlapRef.airport)
      : undefined;

    // My own segments come from the store; everyone else's from the pool.
    const mySegments = (myTrips.find((t) => t.id === request.tripId) ?? myTrips[0])?.segments ?? [];
    const theirSegments =
      seedPool().find((e) => String(e.person.id) === otherId)?.trip.segments ?? [];

    const mine: RoomParticipant = {
      id: String(me.id),
      firstName: me.firstName,
      avatarSeed: me.avatar.seed,
      ...(me.avatar.photoUrl ? { photoUrl: me.avatar.photoUrl } : {}),
      ...(mineStage ? { stage: mineStage.stage, stageAt: mineStage.at } : {}),
      ...terminalFor(mySegments, meetAirport, mineStage?.stage),
    };

    const theirs: RoomParticipant = {
      id: otherId,
      firstName: other?.firstName ?? 'They',
      avatarSeed: other?.avatar.seed ?? otherId,
      ...(other?.avatar.photoUrl ? { photoUrl: other.avatar.photoUrl } : {}),
      ...(theirsStage ? { stage: theirsStage.stage, stageAt: theirsStage.at } : {}),
      ...terminalFor(theirSegments, meetAirport, theirsStage?.stage),
    };

    return {
      request,
      messages,
      mine,
      theirs,
      /** Both in the same building, and both past the checkpoint. */
      sameTerminal:
        Boolean(mine.terminal) &&
        mine.terminal === theirs.terminal &&
        mine.airportIata === theirs.airportIata,
      progress: STAGE_ORDER.indexOf(mine.stage ?? ('' as JourneyStage)),
      postStage,
      postText,
    } as const;
  }, [requestId, requests, allMessages, me, myTrips, postStage, postText]);
}
