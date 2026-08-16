import { Button } from '@design/primitives/Button';
import type { PollState, StampChallenge } from '@stamps/index';

/**
 * `deeplink` — hand off to a native app on this device, then wait.
 *
 * The waiting state is the part most likely to be built badly, so it says what
 * is happening rather than showing an unlabelled spinner: the app has been
 * opened, this page is watching, and nothing is lost if you switch away and
 * come back.
 */
export function DeeplinkChallenge({
  challenge,
  poll,
  onOpen,
  onCancel,
}: {
  challenge: StampChallenge;
  poll?: PollState;
  onOpen: () => void;
  onCancel: () => void;
}) {
  const waiting = poll?.status === 'pending';

  return (
    <div className="verify__body">
      <p className="verify__waiting">{challenge.waitingCopy}</p>

      <div className="verify__pulse" aria-hidden="true">
        <span className="verify__dot" />
        <span className="verify__dot" />
        <span className="verify__dot" />
      </div>

      {/* The live region is the label, not the animation — a screen reader gets
          the same information a sighted person gets from the dots moving. */}
      <p className="verify__status" role="status">
        {waiting ? 'Waiting for confirmation…' : 'Ready when you are.'}
      </p>

      <div className="verify__actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onOpen}>Open the app</Button>
      </div>
    </div>
  );
}
