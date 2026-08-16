import type { Circle } from '@domain/index';
import { asCircleId } from '@domain/ids';
import { asISODate, asUtc } from '@domain/time';

/**
 * Seeded circles.
 *
 * Two admission shapes, because they are the two the brief names: a school that
 * admits by alumni email domain, and an employer that admits by its own. The
 * third is invite-only, which is what conferences and private communities
 * actually use — a domain is no good when the members work everywhere.
 */
export const SEED_CIRCLES: Circle[] = [
  {
    id: asCircleId('insead'),
    name: 'INSEAD',
    shortName: 'INSEAD',
    kind: 'school',
    admission: { kind: 'email_domain', domains: ['insead.edu', 'alumni.insead.edu'] },
    crestSeed: 'insead-crest',
    membersOnly: false,
    memberCount: 1840,
    createdAt: asUtc('2026-01-04T09:00:00Z'),
  },
  {
    id: asCircleId('northwind'),
    name: 'Northwind Grid',
    shortName: 'Northwind',
    kind: 'employer',
    admission: { kind: 'email_domain', domains: ['northwindgrid.com'] },
    crestSeed: 'northwind-crest',
    // Colleagues should only be discoverable to colleagues — an employer circle
    // that leaks outward is a directory of who is travelling where, which is
    // exactly the thing a company should not publish.
    membersOnly: true,
    memberCount: 312,
    createdAt: asUtc('2026-02-11T09:00:00Z'),
  },
  {
    id: asCircleId('gridweek'),
    name: 'Grid Week Singapore 2026',
    shortName: 'Grid Week',
    kind: 'conference',
    admission: { kind: 'invite_code' },
    crestSeed: 'gridweek-crest',
    membersOnly: false,
    memberCount: 96,
    // Four days. After that the circle stops matching anyone, which is the
    // difference between a delegate list and a permanent directory of who
    // attended what.
    runs: { from: asISODate('2026-09-02'), to: asISODate('2026-09-06') },
    createdAt: asUtc('2026-07-20T09:00:00Z'),
  },
];

/** Is this circle matching right now? Permanent circles always are. */
export function circleIsLive(circle: Circle, today: string): boolean {
  if (!circle.runs) return true;
  return today >= String(circle.runs.from) && today <= String(circle.runs.to);
}

export const circleById = (id: string): Circle | undefined =>
  SEED_CIRCLES.find((c) => c.id === id);
