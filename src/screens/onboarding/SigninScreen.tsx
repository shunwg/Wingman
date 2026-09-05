import { Wordmark } from '@design/brand/Wordmark';
import { Button } from '@design/primitives/Button';
import { useStore } from '@state/store';
import { go } from './useSignup';

/**
 * Sign in — honestly a stand-in.
 *
 * Accounts live on this device until Wingman has a server, so "signing in"
 * means picking up a half-made profile here, or starting one. The screen
 * says so rather than drawing a password field that checks nothing.
 */
export function SigninScreen() {
  const mode = useStore((s) => s.account.mode);
  const onboarded = useStore((s) => s.onboarded);
  const beginSignup = useStore((s) => s.beginSignup);
  const startDemo = useStore((s) => s.startDemo);
  const resumable = mode === 'local' && !onboarded;

  return (
    <div className="welcome">
      <div className="panel__stack">
        <Wordmark size={30} />
        <h2 className="empty__title display">Sign in</h2>
        <p className="panel__note">
          Your profile lives on this device until Wingman has a server, so there is nothing to
          sign in to yet — only something to pick up, or to start.
        </p>
      </div>
      <div className="welcome__actions">
        {resumable ? (
          <Button full size="lg" onClick={() => go('#/signup/about')}>
            Pick up where you left off
          </Button>
        ) : (
          <Button
            full
            size="lg"
            onClick={() => {
              beginSignup();
              go('#/signup/about');
            }}
          >
            Create my profile
          </Button>
        )}
        <Button full size="lg" variant="secondary" onClick={() => go(startDemo())}>
          Try the demo as Alex
        </Button>
      </div>
    </div>
  );
}
