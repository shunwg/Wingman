import hero from '@assets/hero-terminal.webp';
import { Wordmark } from '@design/brand/Wordmark';
import { Button } from '@design/primitives/Button';
import { useStore } from '@state/store';
import { WelcomeCards } from './WelcomeCards';
import { go } from './useSignup';

/**
 * The front door.
 *
 * Two ways in, and both are honest about what they are: a profile that lives
 * on this device, or the seeded demo. The hero is a terminal at dusk — the
 * one photograph in the app that is not a person, because the product is the
 * place before it is the people.
 */
export function WelcomeScreen() {
  const beginSignup = useStore((s) => s.beginSignup);
  const startDemo = useStore((s) => s.startDemo);
  const resumable = useStore((s) => s.account.mode === 'local' && s.me.displayName.length > 0);

  return (
    <div className="welcome">
      <div className="welcome__hero">
        <img src={hero} alt="" width={1200} height={900} />
        <div className="welcome__mark">
          <Wordmark size={30} tone="mono" />
        </div>
      </div>

      <WelcomeCards />

      <div className="welcome__actions">
        <Button
          full
          size="lg"
          onClick={() => {
            beginSignup();
            go('#/signup/about');
          }}
        >
          {resumable ? 'Pick up where you left off' : 'Create my profile'}
        </Button>
        <Button full size="lg" variant="secondary" onClick={() => go(startDemo())}>
          Try the demo as Alex
        </Button>
        <p className="welcome__fine">
          Your profile lives on this device until Wingman has a server. Nothing leaves it.
        </p>
      </div>
    </div>
  );
}
