import type { PolicyReason, PolicyRuleId, RideAudience } from '@domain/index';
import { anyAudience, seatsAutomatically } from '@domain/index';
import type { ISODateTime } from '@domain/time';
import { RIDE_AUDIENCE_RULES } from '../rules/registry';
import { policyCopy } from '../copy';
import { runRules } from '../resolve';
import type { CompiledPolicy, PersonFacets } from '../types';

/**
 * May this viewer see — and take — a seat in this car?
 *
 * The answer is computed on read and never stored. A stored verdict is the
 * failure mode rule 2 exists to prevent: the host flips the car to women-only,
 * and a cached yes leaves a man holding a seat under a rule that no longer
 * exists.
 *
 * Two questions, deliberately separate. *Seeing* the car is a privacy question
 * answered here. Whether the car is going anywhere near where the viewer is
 * going is a matching question, answered in `matching/filters/rideFilters.ts` —
 * and `privacy/` may not import `matching/`, which is enforced, so the two
 * cannot quietly merge into one function that is hard to reason about.
 */

export interface RideAudienceInput {
  audience: RideAudience;
  /** The person considering the seat. */
  viewer: PersonFacets;
  /** The host, whose car it is. */
  host: PersonFacets;
  /**
   * The host's own compiled policy.
   *
   * Carried because `RuleContext` requires it, and passed honestly rather than
   * stubbed: the rules that read it are the two surface rules, which
   * `RIDE_AUDIENCE_RULES` deliberately excludes.
   */
  hostPolicy: CompiledPolicy;
  now: ISODateTime;
  /** Whether this viewer arrived holding the car's invite code. */
  holdsInviteCode?: boolean;
}

export interface RideAudienceVerdict {
  /** Whether the car may be shown to this viewer at all. */
  visible: boolean;
  /**
   * Whether they may take a seat outright, or the host confirms first.
   *
   * Circle and link cars seat themselves — those people were admitted to
   * something already. A fully open car does not: "anyone who matches" means a
   * stranger in a car with you, and the car is the one surface where this
   * product should stay conservative.
   */
  seatsAutomatically: boolean;
  deniedBy: PolicyRuleId[];
  reasons: PolicyReason[];
}

/**
 * The rule actually evaluated for a car.
 *
 * A ride's attribute filters are optional, so the base is the permissive rule.
 * The circle door then overrides `circles` — the door is the authority on which
 * circles may enter, and `makeRide()` has already refused an empty list, so a
 * car cannot be circle-locked to nobody by accident. `circleScope` would deny an
 * empty list anyway, which is the belt to that braces.
 */
function effectiveRule(audience: RideAudience) {
  const base = audience.kind === 'open' ? audience.rules : (audience.rules ?? anyAudience());
  if (audience.kind !== 'circles') return base;
  return { ...base, circles: { onlyCircles: audience.circleIds } };
}

export function evaluateRideAudience(input: RideAudienceInput): RideAudienceVerdict {
  const { audience, viewer, host, hostPolicy, now } = input;
  const selfSeating = seatsAutomatically(audience);

  // The host always sees their own car. Not a special case so much as the
  // absence of one: no rule in the registry is written to answer "may I see
  // myself", and running them would deny a women-only car to a male host.
  if (String(viewer.id) === String(host.id)) {
    return { visible: true, seatsAutomatically: selfSeating, deniedBy: [], reasons: [] };
  }

  const deniedBy: PolicyRuleId[] = [];
  const reasons: PolicyReason[] = [];

  // A link-only car is invisible without the link, and says so in words that
  // describe the door rather than its occupants.
  if (audience.kind === 'invite' && !input.holdsInviteCode) {
    deniedBy.push('ride.invite');
    reasons.push({ ruleId: 'ride.invite', side: 'theirs', text: policyCopy('ride.invite', 'theirs') });
  }

  const ran = runRules(
    RIDE_AUDIENCE_RULES,
    viewer,
    host,
    { rule: effectiveRule(audience), policy: hostPolicy, now },
    'theirs',
  );

  deniedBy.push(...ran.denied);
  reasons.push(...ran.reasons);

  return {
    visible: deniedBy.length === 0,
    seatsAutomatically: selfSeating,
    deniedBy,
    reasons,
  };
}
