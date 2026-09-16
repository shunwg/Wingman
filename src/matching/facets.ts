import type { CircleId, Person } from '@domain/index';
import type { PersonFacets } from '@privacy/types';
import { maxAssurance } from './filters/hardFilters';
import { activeAxes } from './filters/intent';

/**
 * The facet tuple for the person holding the phone.
 *
 * Extracted because two callers now need it and a second hand-written copy is
 * how a privacy model quietly develops two answers to the same question: the
 * board's engine builds it to decide who it may show, and the ride selectors
 * build it to decide which cars may be shown. If `assurance` were computed one
 * way here and another way there, a verified-only car would admit exactly the
 * people a verified-only profile excludes, and nothing would fail.
 *
 * `proximity` and `onTrip` are caller-supplied, because they describe a *pair*
 * and a moment rather than a person — see the note on `PersonFacets.proximity`.
 */
export function selfFacets(
  me: Person,
  circleIds: string[],
  at: Pick<PersonFacets, 'proximity' | 'onTrip' | 'channel'>,
): PersonFacets {
  return {
    id: me.id,
    gender: me.gender,
    assurance: maxAssurance(me),
    stampKinds: me.verifications.filter((v) => !v.revokedAt).map((v) => v.kind),
    circleIds: circleIds as CircleId[],
    intents: activeAxes(me.intent),
    blocked: me.blocked,
    proximity: at.proximity,
    channel: at.channel,
    onTrip: at.onTrip,
  };
}
