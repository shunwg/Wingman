import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import type { StampChallenge } from '@stamps/index';
import { mockCodeFor } from '@stamps/index';

/**
 * `input` — something the person can type.
 *
 * Two steps in one shape: the value, then the code that was sent to it. The
 * provider supplies both the copy and the validation rule, so this file has no
 * idea what an email address looks like and cannot drift from the engine's
 * opinion of one.
 */
export function InputChallenge({
  challenge,
  onSubmit,
  onCancel,
}: {
  challenge: StampChallenge;
  onSubmit: (answer: string) => void;
  onCancel: () => void;
}) {
  const prompt = challenge.prompt!;
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    const check = prompt.validate(value);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    setSent(true);
  };

  return (
    <div className="verify__body">
      {!sent ? (
        <>
          <label className="field">
            <span className="field__label">{prompt.label}</span>
            <input
              className="field__input"
              type={prompt.kind === 'email' ? 'email' : 'text'}
              inputMode={prompt.kind === 'code' ? 'numeric' : 'email'}
              autoComplete={prompt.kind === 'email' ? 'email' : 'off'}
              placeholder={prompt.placeholder}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'input-error' : 'input-hint'}
            />
            <span className="field__hint" id="input-hint">
              {prompt.hint}
            </span>
          </label>

          {/* Errors are announced, not just coloured. */}
          {error && (
            <p className="field__error" id="input-error" role="alert">
              {error}
            </p>
          )}

          <div className="verify__actions">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={send} disabled={value.trim().length === 0}>
              Send me a code
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="verify__waiting">{challenge.waitingCopy}</p>

          {/* No mail is actually sent, so the code is shown rather than hidden
              behind an inbox that will never receive anything. Labelled as a
              stand-in, because a flow that looks real but is not is how a demo
              gets mistaken for a product. */}
          <p className="verify__mocknote">
            Nothing was emailed — this is a stand-in. Your code is{' '}
            <strong className="mono">{mockCodeFor(challenge.sessionId)}</strong>.
          </p>

          <label className="field">
            <span className="field__label">Six-digit code</span>
            <input
              className="field__input mono"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>

          <div className="verify__actions">
            <Button variant="secondary" onClick={() => setSent(false)}>
              Back
            </Button>
            <Button onClick={() => onSubmit(`${value}|${code}`)} disabled={code.length !== 6}>
              Verify
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
