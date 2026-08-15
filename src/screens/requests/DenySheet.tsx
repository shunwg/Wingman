import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import type { DenialRecord, MeetRequest } from '@domain/index';
import { useStore } from '@state/store';

/**
 * Saying no.
 *
 * The design problem: the reason is genuinely useful to trust and safety, and
 * genuinely harmful to hand to the sender. So it is collected here, kept, and
 * never surfaced — the sender sees only that the request closed, with no
 * distinction between declined, withdrawn, expired and revoked.
 *
 * "This made me uncomfortable" is separated from the other three on purpose.
 * If declining honestly risked a confrontation, people would pick the softest
 * option available, and the signal would evaporate exactly when it mattered.
 * Choosing it here quietly blocks by default and reports.
 */

const REASONS: { id: DenialRecord['reason']; label: string; note?: string }[] = [
  { id: 'not_this_trip', label: 'Not this trip' },
  { id: 'different_plans', label: 'My plans changed' },
  { id: 'not_a_fit', label: 'Not a fit' },
  {
    id: 'uncomfortable',
    label: 'This made me uncomfortable',
    note: 'Blocks them and flags it to us. They are told nothing.',
  },
];

export function DenySheet({ request, onClose }: { request: MeetRequest; onClose: () => void }) {
  const denyRequest = useStore((s) => s.denyRequest);
  const now = useStore((s) => s.now);
  const [reason, setReason] = useState<DenialRecord['reason']>('not_this_trip');
  const [alsoBlock, setAlsoBlock] = useState(false);

  const uncomfortable = reason === 'uncomfortable';

  const submit = () => {
    denyRequest(String(request.id), {
      at: now,
      reason,
      // Choosing "uncomfortable" blocks by default: someone in that position
      // should not also have to find a second switch.
      alsoBlock: uncomfortable ? true : alsoBlock,
      alsoReport: uncomfortable,
    });
    onClose();
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Decline this request">
      <div className="sheet__scrim" onClick={onClose} />
      <div className="sheet__panel">
        <h2 className="sheet__title display">Not this time</h2>
        <p className="sheet__body">
          They will just see that this closed. Not the reason, not when you read it, and not
          whether you read it at all.
        </p>

        <div className="sheet__options">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`optrow ${reason === r.id ? 'is-selected' : ''}`}
              aria-pressed={reason === r.id}
              onClick={() => setReason(r.id)}
            >
              <span className="optrow__label">{r.label}</span>
              {r.note && <span className="optrow__note">{r.note}</span>}
            </button>
          ))}
        </div>

        {!uncomfortable && (
          <label className="checkrow">
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={(e) => setAlsoBlock(e.target.checked)}
            />
            <span>Also block them</span>
          </label>
        )}

        <div className="sheet__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Decline</Button>
        </div>
      </div>
    </div>
  );
}
