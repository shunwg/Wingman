/**
 * The privacy engine — public API.
 *
 * Everything else imports from here and never from a file inside. Pure, with
 * no clock and no randomness, so the whole thing is provable in plain Node.
 *
 * The two invariants that hold across the module, asserted in resolve.ts:
 *
 *   mutual === aSeesB.visible && bSeesA.visible
 *   level  === min(aSeesB.level, bSeesA.level)
 */

export { compilePolicy } from './compile';
export { canSee, resolveMutual, disclosureLevelFor, levelForRelationship, admitsViewer } from './resolve';
export { redact, redactFully, type RedactContext } from './redact';
export {
  FIELD_LEVEL,
  FIELD_LABEL,
  PROFESSIONAL_FIELD_LEVEL,
  effectiveLevel,
  linkLevel,
  type LadderField,
} from './ladder';
export {
  PRESETS,
  PRESET_LIST,
  applyPresets,
  isAsymmetric,
  defaultPolicy,
  defaultAudienceRule,
} from './presets';
export { policyCopy, COPY_KEYS } from './copy';
export { AUDIENCE_RULES, SEEKING_RULES, ALL_RULES } from './rules/registry';

export { segmentsFor, MAX_SEGMENTS, type SegmentInput } from './audience/segments';
export { estimateSize, withEstimates, basePopulation } from './audience/census';
export { whoCanSeeMe, type AudienceInput } from './audience/report';
export {
  previewAs,
  personasFromSegments,
  type ViewerPersona,
  type PreviewResult,
} from './audience/previewAs';

export {
  armGuardian,
  tickGuardian,
  endGuardian,
  escalateGuardian,
  declineGuardian,
  addPing,
  isLive,
  guardianView,
  GRACE_MINUTES,
  PING_RETENTION_MINUTES,
  MAX_PINGS,
  type ArmInput,
} from './guardian/session';
export {
  GUARDIAN_PRESETS,
  GUARDIAN_PRESET_LIST,
  describeScope,
  type GuardianPreset,
  type GuardianPresetId,
} from './guardian/scope';

export type * from './types';
