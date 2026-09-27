import { useMemo } from 'react';
import type { Circle, Person, PublicCircleBadge, RedactedPerson } from '@domain/index';
import type { ISODateTime } from '@domain/time';
import { admitsListing, compilePolicy, redact } from '@privacy/index';
import { selfFacets } from '@matching/index';
import { tripIsOver } from '@domain/index';
import { SEED_CIRCLES, circleIsLive } from '@data/seed/circles';
import { seedPool } from '@data/seed/trips';
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
 * `show_badge` there, and whose own audience admits you — a block either way,
 * "verified only", "women only" and the rest, via `admitsListing` — redacted
 * to the browsing rung. `match_only` members are matched against and never
 * listed — that is the opt-in the brief asked for. The seed cast is the only
 * population until a backend exists.
 *
 * Shared by the circle page and the event board, so the two lists cannot
 * disagree about who is on them.
 */
export function listedMembers(circleId: string, me: Person, now: ISODateTime, circles: Circle[]): RedactedPerson[] {
  const mine = me.memberships.filter((m) => m.display !== 'paused').map((m) => String(m.circleId));
  // Members are listed to members. The page is open to anyone who finds the
  // circle, and a list of who is in it is not (round 5).
  if (!mine.includes(circleId)) return [];
  // "When not travelling" is off by default: you appear because you are going
  // somewhere, not as a standing listing. So a member who kept it off is
  // listed while they have a trip still to come or underway — or while the
  // event this circle is, is on.
  const circle = circles.find((c) => String(c.id) === circleId);
  const liveEvent = Boolean(
    circle && circle.kind === 'conference' && circle.runs && circleIsLive(circle, String(now).slice(0, 10)),
  );
  const travelling = (p: Person) =>
    p.privacy.discoverability.offTrip ||
    liveEvent ||
    seedPool().some(
      (e) => String(e.person.id) === String(p.id) && e.trip.visibility.listing !== 'hidden' && !tripIsOver(e.trip, now),
    );
  const viewer = selfFacets(me, mine, { proximity: 'none', channel: 'app', onTrip: false });
  return SEED_PEOPLE.filter((p) => {
    if (String(p.id) === String(me.id)) return false;
    if (!p.memberships.some((m) => String(m.circleId) === circleId && m.display === 'show_badge')) return false;
    if (!travelling(p)) return false;
    const theirs = p.memberships.map((m) => String(m.circleId));
    const subject = selfFacets(p, theirs, { proximity: 'none', channel: 'app', onTrip: false });
    return admitsListing(compilePolicy(p.privacy, theirs), viewer, subject, now);
  }).map((p) => decoratePerson(redact(p, 0), circles));
}

export function useCircleMembers(circleId: string): RedactedPerson[] {
  const circles = useCircles();
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  return useMemo(() => listedMembers(circleId, me, now, circles), [circleId, circles, me, now]);
}
