/**
 * The five steps, in order, and which of them may be skipped.
 *
 * `privacy` is not skippable on purpose: who can see you is decided before
 * the board exists, not discovered afterwards. Everything else is a
 * convenience — a person with a name and one sentence is a complete person.
 */
export type SignupStep = 'about' | 'work' | 'privacy' | 'verify' | 'trip';

export const SIGNUP_STEPS: readonly SignupStep[] = ['about', 'work', 'privacy', 'verify', 'trip'];

export const SKIPPABLE: ReadonlySet<SignupStep> = new Set<SignupStep>(['work', 'verify', 'trip']);

export const STEP_TITLE: Record<SignupStep, string> = {
  about: 'About you',
  work: 'What you do',
  privacy: 'Who can see you',
  verify: 'Prove it is you',
  trip: 'Your next flight',
};

export function isSignupStep(s: string | undefined): s is SignupStep {
  return (SIGNUP_STEPS as readonly string[]).includes(s ?? '');
}
