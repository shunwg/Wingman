import { Stepper } from '@design/primitives/Stepper';
import { STEP_TITLE, SIGNUP_STEPS, type SignupStep } from './steps';
import { useSignup } from './useSignup';
import { AboutStep } from './steps/AboutStep';
import { WorkStep } from './steps/WorkStep';
import { PrivacyStep } from './steps/PrivacyStep';
import { VerifyStep } from './steps/VerifyStep';
import { TripStep } from './steps/TripStep';

/**
 * The five steps under one stepper.
 *
 * Each step owns its own fields and decides what "Next" writes; this screen
 * only knows the order and the title. Back is always there, and the router
 * keeps the current step in the URL so a refresh mid-signup lands on the same
 * step with whatever was already saved.
 */
export function SignupScreen({ step }: { step: SignupStep }) {
  const nav = useSignup(step);

  return (
    <section className="signup">
      <Stepper
        index={nav.index}
        count={SIGNUP_STEPS.length}
        title={STEP_TITLE[step]}
        onBack={nav.back}
      />
      {step === 'about' && <AboutStep onNext={nav.next} />}
      {step === 'work' && <WorkStep onNext={nav.next} onSkip={nav.skip} />}
      {step === 'privacy' && <PrivacyStep onNext={nav.next} />}
      {step === 'verify' && <VerifyStep onNext={nav.next} onSkip={nav.skip} />}
      {step === 'trip' && <TripStep onFinish={nav.finish} />}
    </section>
  );
}
