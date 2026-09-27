import { useMemo } from 'react';
import type { Circle, Person, RedactedPerson } from '@domain/index';
import type { ISODateTime } from '@domain/time';
import { circleIsLive } from '@data/seed/circles';
import { useStore } from '../store';
import { allCircles, listedMembers } from './circles';

/**
 * The event board.
 *
 * A live conference is a place before it is a journey: a delegate who lives
 * in the host city has no flight and still has a room full of people worth
 * meeting. For each live event circle you are in that has a venue, this is
 * its members who chose to be seen — redacted to the browsing rung — with
 * the days left. It is a list, not a ranking; the matching engine ranks
 * journeys, and this is not one.
 */
export interface EventBoard {
  circle: Circle;
  daysLeft: number;
  members: RedactedPerson[];
}

export function eventBoards(me: Person, circles: Circle[], now: ISODateTime): EventBoard[] {
  const today = String(now).slice(0, 10);
  return circles
    .filter(
      (c) =>
        c.kind === 'conference' &&
        c.venue &&
        c.runs &&
        circleIsLive(c, today) &&
        me.memberships.some((m) => String(m.circleId) === String(c.id) && m.display !== 'paused'),
    )
    .map((circle) => {
      const end = new Date(`${circle.runs!.to}T00:00:00Z`).getTime();
      const start = new Date(`${today}T00:00:00Z`).getTime();
      const daysLeft = Math.max(0, Math.round((end - start) / 86_400_000));
      // The circle page's list, not a second one: a person you hid, or whose
      // audience does not admit you, is off both.
      const members = listedMembers(String(circle.id), me, now, circles);
      return { circle, daysLeft, members };
    });
}

export function useEventBoards(): EventBoard[] {
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const myCircles = useStore((s) => s.myCircles);
  return useMemo(() => eventBoards(me, allCircles(myCircles), now), [me, now, myCircles]);
}
