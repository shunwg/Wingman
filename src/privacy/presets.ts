import type { AudienceRule, CircleId, PrivacyPolicy, PrivacyPresetId } from '@domain/index';
import { ASSURANCE } from '@domain/verification';

/**
 * Presets, and why the UI edits these instead of the raw rules.
 *
 * Visibility is two rules — `audience` (who may see me) and `seeking` (who I
 * want in my feed) — and the gap between them is where the worst privacy bugs
 * live.
 *
 * The canonical failure: a woman sets `audience.genders = ['woman']`, because
 * that is the setting labelled "who can see me". She is now invisible to men,
 * and her feed is still full of them. She asked to be in a women-only space and
 * got half of one, with no indication that the other half exists.
 *
 * So `women_only` compiles to *both* halves, atomically, and the policy editor
 * exposes the preset rather than the pair. Raw editing lives behind "advanced"
 * and warns when the two sides disagree.
 *
 * On `nonbinary`: this preset narrows to `['woman']` only. Whether a
 * women-only space should also admit nonbinary people is a real question that
 * different communities answer differently, and it is not one to smuggle into
 * a default. Anyone wanting a different set builds it in the advanced editor,
 * where the asymmetry is visible and deliberate.
 */

type Half = Partial<AudienceRule>;
interface PresetSpec {
  id: PrivacyPresetId;
  label: string;
  /** One sentence, in the user's own terms, describing what this does. */
  explainer: string;
  audience: Half;
  seeking: Half;
}

export const PRESETS: Record<PrivacyPresetId, PresetSpec> = {
  women_only: {
    id: 'women_only',
    label: 'Women only',
    explainer: 'Only women can see you, and you will only see women. Both directions.',
    audience: { genders: ['woman'] },
    seeking: { genders: ['woman'] },
  },
  verified_only: {
    id: 'verified_only',
    label: 'Verified people only',
    explainer:
      'Only people who have verified at least one account can see you, and you will only see them.',
    audience: { minAssurance: ASSURANCE.social },
    seeking: { minAssurance: ASSURANCE.social },
  },
  id_verified_only: {
    id: 'id_verified_only',
    label: 'ID-verified only',
    explainer:
      'Only people who have proved a legal identity — BankID or equivalent — can see you, and you will only see them. The strictest setting.',
    audience: { minAssurance: ASSURANCE.identity },
    seeking: { minAssurance: ASSURANCE.identity },
  },
  professional_only: {
    id: 'professional_only',
    label: 'Professional only',
    explainer: 'You appear only to people open to professional meets, and you only see them.',
    audience: { intents: ['professional'] },
    seeking: { intents: ['professional'] },
  },
  circles_only: {
    id: 'circles_only',
    label: 'My circles only',
    explainer:
      'Only members of circles you belong to can see you, and you will only see fellow members.',
    audience: { circles: 'any' }, // replaced with the real circle list at compile time
    seeking: { circles: 'any' },
  },
};

export const PRESET_LIST: PresetSpec[] = Object.values(PRESETS);

/** The most restrictive value wins when several presets touch the same field. */
function mergeHalf(base: AudienceRule, half: Half, ownCircleIds: string[]): AudienceRule {
  const out: AudienceRule = { ...base };

  if (half.genders && half.genders !== 'any') {
    out.genders =
      base.genders === 'any'
        ? half.genders
        : base.genders.filter((g) => (half.genders as string[]).includes(g));
  }

  if (half.minAssurance !== undefined) {
    out.minAssurance = Math.max(base.minAssurance, half.minAssurance) as AudienceRule['minAssurance'];
  }

  if (half.requiredStampKinds?.length) {
    out.requiredStampKinds = [...new Set([...base.requiredStampKinds, ...half.requiredStampKinds])];
  }

  if (half.intents && half.intents !== 'any') {
    out.intents =
      base.intents === 'any'
        ? half.intents
        : base.intents.filter((i) => (half.intents as string[]).includes(i));
  }

  if (half.circles) {
    // `circles_only` means "the circles I am actually in", resolved at compile
    // time rather than stored — so joining or leaving a circle does not require
    // rewriting the policy, and a stale circle id cannot linger in a rule.
    const own = ownCircleIds as CircleId[];
    const existing = base.circles === 'any' ? null : base.circles.onlyCircles;
    out.circles = {
      onlyCircles: existing ? existing.filter((c) => own.includes(c)) : own,
    };
  }

  return out;
}

/**
 * Apply every active preset to both halves of a policy.
 *
 * Returns the rules the engine actually evaluates. The stored `PrivacyPolicy`
 * keeps the presets *and* the raw rules; this is where they become one thing.
 */
export function applyPresets(
  policy: PrivacyPolicy,
  ownCircleIds: string[],
): { audience: AudienceRule; seeking: AudienceRule } {
  let audience = policy.audience;
  let seeking = policy.seeking;

  for (const id of policy.presets) {
    const spec = PRESETS[id];
    if (!spec) continue;
    audience = mergeHalf(audience, spec.audience, ownCircleIds);
    seeking = mergeHalf(seeking, spec.seeking, ownCircleIds);
  }

  return { audience, seeking };
}

/**
 * Whether the two halves disagree in a way the owner probably did not intend.
 *
 * Surfaced as a warning in the advanced editor — an asymmetric policy is
 * legitimate, but it is almost never what someone means when they set it by
 * hand, so it should at least be said out loud.
 */
export function isAsymmetric(audience: AudienceRule, seeking: AudienceRule): boolean {
  const g = JSON.stringify(audience.genders) !== JSON.stringify(seeking.genders);
  const a = audience.minAssurance !== seeking.minAssurance;
  return g || a;
}

export const defaultAudienceRule = (): AudienceRule => ({
  genders: 'any',
  minAssurance: 0,
  requiredStampKinds: [],
  circles: 'any',
  intents: 'any',
  blocked: [],
});

/**
 * The starting policy for a new account.
 *
 * `offTrip: false` is the default worth defending: off a trip, you are not on
 * this app at all. It makes Wingman something you appear on because you are
 * travelling rather than a standing public listing of yourself, and it removes
 * a whole category of ambient exposure without anyone having to think about it.
 */
export const defaultPolicy = (): PrivacyPolicy => ({
  presets: [],
  audience: defaultAudienceRule(),
  seeking: defaultAudienceRule(),
  disclosure: {},
  guardian: { promptOnEveryMeet: true, autoEscalateDefault: true },
  discoverability: { onFlight: true, inTerminal: true, inCity: true, offTrip: false },
  version: 1,
});
