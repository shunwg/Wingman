import type { GuardianScope, ISODateTime } from '@domain/index';
import { addMinutes } from '@domain/time';

/**
 * Guardian scope presets.
 *
 * Offered as three named postures rather than six toggles. Asking someone to
 * configure a safety feature field by field, in the moment they are deciding
 * whether to meet a stranger, is asking them at the worst possible time — so
 * the presets carry the thinking and the toggles stay available underneath.
 */

export type GuardianPresetId = 'full' | 'balanced' | 'minimal';

export interface GuardianPreset {
  id: GuardianPresetId;
  label: string;
  explainer: string;
  build(meetEndsAt: ISODateTime): GuardianScope;
}

export const GUARDIAN_PRESETS: Record<GuardianPresetId, GuardianPreset> = {
  full: {
    id: 'full',
    label: 'Everything',
    explainer:
      'They see your live location, where you are meeting, and who you are meeting. Raises an alarm automatically if you do not check out.',
    build: (endsAt) => ({
      liveLocation: true,
      meetDetails: 'full',
      counterpartIdentity: 'name_and_photo',
      autoEscalateIfNoCheckOut: true,
      checkOutBy: addMinutes(endsAt, 30),
    }),
  },
  balanced: {
    id: 'balanced',
    label: 'Where and when',
    explainer:
      'They see your live location and the place and time — but only the first name of who you are meeting.',
    build: (endsAt) => ({
      liveLocation: true,
      meetDetails: 'place_and_time',
      counterpartIdentity: 'first_name',
      autoEscalateIfNoCheckOut: true,
      checkOutBy: addMinutes(endsAt, 30),
    }),
  },
  minimal: {
    id: 'minimal',
    label: 'Just check on me',
    explainer:
      'They see only that you are out and when you expect to be done. No location, no details. They are told if you do not check out.',
    build: (endsAt) => ({
      liveLocation: false,
      meetDetails: 'time_only',
      counterpartIdentity: 'none',
      autoEscalateIfNoCheckOut: true,
      checkOutBy: addMinutes(endsAt, 30),
    }),
  },
};

export const GUARDIAN_PRESET_LIST: GuardianPreset[] = Object.values(GUARDIAN_PRESETS);

/**
 * A plain-language description of what a scope actually shares.
 *
 * Used on the arming screen and on the traveller's own live view, so the person
 * being watched always knows exactly what is being shared about them. A safety
 * feature the user cannot audit is a different kind of risk.
 */
export function describeScope(scope: GuardianScope): string[] {
  const lines: string[] = [];
  lines.push(scope.liveLocation ? 'Your live location' : 'Not your location');
  lines.push(
    scope.meetDetails === 'full'
      ? 'The place and time you are meeting'
      : scope.meetDetails === 'place_and_time'
        ? 'The place and time you are meeting'
        : 'Only when you expect to be done',
  );
  lines.push(
    scope.counterpartIdentity === 'name_and_photo'
      ? "The other person's name and photo"
      : scope.counterpartIdentity === 'first_name'
        ? "Only the other person's first name"
        : 'Nothing about the other person',
  );
  if (scope.autoEscalateIfNoCheckOut) {
    lines.push('They are alerted if you do not check out in time');
  }
  return lines;
}
