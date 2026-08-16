import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import type { StampChallenge } from '@stamps/index';

/**
 * `redirect` — an OAuth hop.
 *
 * With real credentials this leaves the page and comes back with a code. Under
 * a mock there is nowhere to go, so the same two steps are shown honestly:
 * hand off, then confirm what came back. Keeping the shape identical means the
 * screen does not change when the credentials arrive.
 */
export function RedirectChallenge({
  challenge,
  label,
  onSubmit,
  onCancel,
}: {
  challenge: StampChallenge;
  label: string;
  onSubmit: (answer: string) => void;
  onCancel: () => void;
}) {
  const mocked = challenge.url?.startsWith('#/') ?? true;
  const [handle, setHandle] = useState('');

  if (!mocked) {
    return (
      <div className="verify__body">
        <p className="verify__waiting">{challenge.waitingCopy}</p>
        <div className="verify__actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => window.location.assign(challenge.url!)}>
            Continue to {label}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="verify__body">
      <p className="verify__mocknote">
        {label} is not connected yet, so nothing is checked. Type the handle you want on your
        profile and it will be stamped as if it had been.
      </p>

      <label className="field">
        <span className="field__label">Your {label} handle</span>
        <input
          className="field__input"
          value={handle}
          placeholder="alexferrand"
          autoComplete="off"
          onChange={(e) => setHandle(e.target.value)}
        />
      </label>

      <div className="verify__actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSubmit(handle)} disabled={handle.trim().length === 0}>
          Connect
        </Button>
      </div>
    </div>
  );
}
