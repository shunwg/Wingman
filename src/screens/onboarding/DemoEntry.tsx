import { useEffect, useRef, useState } from 'react';
import { Button } from '@design/primitives/Button';
import { useStore } from '@state/store';
import { go } from './useSignup';

/**
 * `#/demo` — the one-tap stakeholder link.
 *
 * Seeds Alex, three trips and Priya's request, then leaves. Works whether or
 * not anyone was onboarded, which is what makes the URL safe to put in a
 * deck. The ref guards against StrictMode's double effect.
 *
 * Except over a real profile. The link used to replace one silently — its
 * trips, its conversations, its hides and any report not yet sent — because
 * somebody tapped a link in a deck. A local account is asked first.
 */
export function DemoEntry() {
  const startDemo = useStore((s) => s.startDemo);
  // Any local profile, finished or half-made: a half-made one is still what
  // somebody typed.
  const hasProfile = useStore((s) => s.account.mode === 'local');
  const [confirmed, setConfirmed] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (hasProfile && !confirmed) return;
    fired.current = true;
    go(startDemo());
  }, [startDemo, hasProfile, confirmed]);

  if (hasProfile && !confirmed) {
    return (
      <div className="empty">
        <h2 className="empty__title display">Replace your profile with the demo?</h2>
        <p className="empty__body">
          This device holds your own profile. The demo would replace it — your trips, your
          conversations and anyone you have hidden — and nothing is kept anywhere else.
        </p>
        <Button variant="secondary" onClick={() => go('#/')}>
          Keep my profile
        </Button>
        <Button variant="danger" onClick={() => setConfirmed(true)}>
          Replace it with the demo
        </Button>
      </div>
    );
  }

  return (
    <p className="screennote" role="status">
      Setting up the demo…
    </p>
  );
}
