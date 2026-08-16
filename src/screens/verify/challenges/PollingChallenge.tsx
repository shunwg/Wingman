import { Button } from '@design/primitives/Button';
import type { PollState, StampChallenge } from '@stamps/index';

/**
 * `polling` — confirm on another device, and wait here.
 *
 * The reference is the anti-phishing step and it is the most important thing on
 * this screen, so it is set large and in mono. It is shown, never typed: a
 * reference you type is one an attacker can ask you for, and the whole point is
 * that you compare what is here against what your phone shows and stop if they
 * differ. The instruction to stop is stated, because "if these do not match,
 * something is wrong" is not obvious to someone who has not seen it before.
 */
export function PollingChallenge({
  challenge,
  poll,
  onCancel,
}: {
  challenge: StampChallenge;
  poll?: PollState;
  onCancel: () => void;
}) {
  return (
    <div className="verify__body">
      {challenge.reference && (
        <div className="verify__ref">
          <span className="verify__reflabel">Check this matches your phone</span>
          <strong className="verify__refcode mono">{challenge.reference}</strong>
        </div>
      )}

      <p className="verify__waiting">{challenge.waitingCopy}</p>

      <p className="verify__status" role="status">
        {poll?.status === 'pending' ? 'Waiting for confirmation…' : 'Ready when you are.'}
      </p>

      <div className="verify__actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
