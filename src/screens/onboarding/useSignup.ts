import { useStore } from '@state/store';
import { SIGNUP_STEPS, SKIPPABLE, type SignupStep } from './steps';

/** Hash navigation without importing the router (which imports us). */
export const go = (hash: string) => {
  window.location.hash = hash;
};

/**
 * Moving through the steps. Back always works; Skip only where the table
 * says so; finishing hands the deferred destination (an invitation, say)
 * back to the router.
 */
export function useSignup(step: SignupStep) {
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const index = SIGNUP_STEPS.indexOf(step);
  const count = SIGNUP_STEPS.length;

  const finish = () => go(completeOnboarding());
  const next = () => {
    const n = SIGNUP_STEPS[index + 1];
    if (n) go(`#/signup/${n}`);
    else finish();
  };
  const back = () => {
    const p = SIGNUP_STEPS[index - 1];
    go(p ? `#/signup/${p}` : '#/welcome');
  };
  const canSkip = SKIPPABLE.has(step);
  const skip = () => {
    if (canSkip) next();
  };

  return { index, count, next, back, skip, canSkip, finish };
}
