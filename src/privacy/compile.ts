import type { PrivacyPolicy } from '@domain/index';
import type { CompiledPolicy, ReferencedFacet } from './types';
import { applyPresets } from './presets';

/**
 * Turn a stored policy into the thing the engine evaluates.
 *
 * Two jobs. The first is applying presets so `women_only` becomes both halves
 * of the rule pair. The second is quieter but load-bearing for the audience
 * screen: working out **which facets any active rule actually reads**.
 *
 * That set is what makes "who can see me right now" computable at all. You
 * cannot enumerate a global population, but you can partition it by the two or
 * three attributes your own policy cares about — and everything your policy
 * ignores collapses to a single wildcard row. A policy touching gender and
 * assurance yields a handful of segments, not a combinatorial explosion.
 */
export function compilePolicy(policy: PrivacyPolicy, ownCircleIds: string[] = []): CompiledPolicy {
  const { audience, seeking } = applyPresets(policy, ownCircleIds);

  const audienceOnly = new Set<ReferencedFacet>();
  if (audience.genders !== 'any') audienceOnly.add('gender');
  if (audience.minAssurance > 0) audienceOnly.add('assurance');
  if (audience.requiredStampKinds.length > 0) audienceOnly.add('stampKinds');
  if (audience.circles !== 'any') audienceOnly.add('circleIds');
  if (audience.intents !== 'any') audienceOnly.add('intents');

  // Proximity only matters when the surfaces are not uniformly open — if
  // everything is on, where someone is standing changes nothing.
  const d = policy.discoverability;
  const allSurfacesOpen = d.onFlight && d.inTerminal && d.inCity && d.offTrip;
  if (!allSurfacesOpen) audienceOnly.add('proximity');

  // Channel is always referenced. A guardian holding a live token and a circle
  // admin can see things no browsing user can, and an audience report that
  // leaves them out is not an answer to "who can see me".
  audienceOnly.add('channel');

  const referenced = new Set<ReferencedFacet>(audienceOnly);
  if (seeking.genders !== 'any') referenced.add('gender');
  if (seeking.minAssurance > 0) referenced.add('assurance');
  if (seeking.circles !== 'any') referenced.add('circleIds');
  if (seeking.intents !== 'any') referenced.add('intents');

  return {
    source: policy,
    audience,
    seeking,
    referencedFacets: [...referenced],
    audienceFacets: [...audienceOnly],
    presets: policy.presets,
  };
}
