import { useMemo } from 'react';
import type { Circle, RedactedPerson } from '@domain/index';
import { redact } from '@privacy/index';
import { SEED_PEOPLE } from '@data/seed/people';
import { circleIsLive } from '@data/seed/circles';
import { useStore } from '../store';
import { allCircles, decoratePerson } from './circles';

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

export function eventBoards(
  me: { id: string; memberships: { circleId: unknown; display: string }[] },
  circles: Circle[],
  today: string,
): EventBoard[] {
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
      const now = new Date(`${today}T00:00:00Z`).getTime();
      const daysLeft = Math.max(0, Math.round((end - now) / 86_400_000));
      const members = SEED_PEOPLE.filter(
        (p) =>
          String(p.id) !== me.id &&
          p.memberships.some((m) => String(m.circleId) === String(circle.id) && m.display === 'show_badge'),
      ).map((p) => decoratePerson(redact(p, 0), circles));
      return { circle, daysLeft, members };
    });
}

export function useEventBoards(): EventBoard[] {
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const myCircles = useStore((s) => s.myCircles);
  return useMemo(
    () => eventBoards({ id: String(me.id), memberships: me.memberships }, allCircles(myCircles), String(now).slice(0, 10)),
    [me, now, myCircles],
  );
}
