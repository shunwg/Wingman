import { useEffect, useRef } from 'react';
import { useStore } from '@state/store';
import { go } from './useSignup';

/**
 * `#/demo` — the one-tap stakeholder link.
 *
 * Seeds Alex, three trips and Priya's request, then leaves. Works whether or
 * not anyone was onboarded, which is what makes the URL safe to put in a
 * deck. The ref guards against StrictMode's double effect.
 */
export function DemoEntry() {
  const startDemo = useStore((s) => s.startDemo);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    go(startDemo());
  }, [startDemo]);

  return (
    <p className="screennote" role="status">
      Setting up the demo…
    </p>
  );
}
