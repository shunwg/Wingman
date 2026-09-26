import { useEffect } from 'react';
import { useStore } from '@state/store';

/**
 * In the demo, the people you say hello to answer.
 *
 * Nobody is on the other end of a demo. Without this the sender's half of the
 * product — waiting, a yes arriving, the room opening with a time in it — could
 * not be reached at all, and the signature moment only ever played on *your*
 * yes to somebody else.
 *
 * The one timer in the app lives here, at the shell, because the engines have
 * no clock and the store has only the simulated one. The answer itself goes
 * through `answerDemoRequest`, and so through the request FSM, like any other.
 * In a real account the store refuses it: there, nobody has answered.
 */

/** Long enough to see "Request sent", short enough that nobody wanders off. */
export const DEMO_ANSWER_MS = 4000;

export function useDemoAnswers(): void {
  const demo = useStore((s) => s.account.mode === 'demo');
  // A string, so the effect re-runs only when the set of open hellos changes.
  const waiting = useStore((s) =>
    s.requests
      .filter((r) => r.fromPersonId === s.me.id && (r.status === 'sent' || r.status === 'viewed'))
      .map((r) => String(r.id))
      .join(','),
  );
  const answer = useStore((s) => s.answerDemoRequest);

  useEffect(() => {
    if (!demo || !waiting) return;
    const timers = waiting.split(',').map((id) => window.setTimeout(() => answer(id), DEMO_ANSWER_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [demo, waiting, answer]);
}
