import { useMemo } from 'react';
import type { Circle, PublicCircleBadge, RedactedPerson } from '@domain/index';
import { redact } from '@privacy/index';
import { SEED_CIRCLES } from '@data/seed/circles';
import { SEED_PEOPLE } from '@data/seed/people';
import { useStore } from '../store';

/**
 * Circles, resolved.
 *
 * `redact()` may not know what a circle is called — the privacy engine cannot
 * reach a lookup table, and rightly so. A badge crosses that boundary carrying
 * ids only, and this is the layer allowed to know both: it fills in the short
 * name, the kind, the mark, and the first badge the member wears.
 *
 * Your own circles come first, because they are yours.
 */
export function allCircles(mine: Circle[]): Circle[] {
  return [...mine, ...SEED_CIRCLES];
}

export function decorateBadge(badge: PublicCircleBadge, circles: Circle[]): PublicCircleBadge {
  const circle = circles.find((c) => String(c.id) === String(badge.circleId));
  if (!circle) return badge;
  const firstId = badge.badgeIds?.[0];
  const first = firstId ? circle.badges?.find((b) => b.id === firstId) : undefined;
  return {
    ...badge,
    shortName: circle.shortName,
    kind: circle.kind,
    crestSeed: circle.crestSeed,
    ...(circle.crestUrl ? { crestUrl: circle.crestUrl } : {}),
    ...(first ? { badge: { label: first.label, tone: first.tone } } : {}),
  };
}

export function decoratePerson(person: RedactedPerson, circles: Circle[]): RedactedPerson {
  if (person.circles.length === 0) return person;
  return { ...person, circles: person.circles.map((b) => decorateBadge(b, circles)) };
}

export function useCircles(): Circle[] {
  const mine = useStore((s) => s.myCircles);
  return useMemo(() => allCircles(mine), [mine]);
}

export function useCircle(id: string): Circle | undefined {
  return useCircles().find((c) => String(c.id) === id);
}

/**
 * The members of a circle you are allowed to see: those who chose
 * `show_badge` there, redacted to the browsing rung. `match_only` members are
 * matched against and never listed — that is the opt-in the brief asked for.
 * The seed cast is the only population until a backend exists.
 */
export function useCircleMembers(circleId: string): RedactedPerson[] {
  const circles = useCircles();
  const me = useStore((s) => s.me);
  return useMemo(
    () =>
      SEED_PEOPLE.filter(
        (p) =>
          String(p.id) !== String(me.id) &&
          p.memberships.some((m) => String(m.circleId) === circleId && m.display === 'show_badge'),
      ).map((p) => decoratePerson(redact(p, 0), circles)),
    [circleId, circles, me.id],
  );
}
