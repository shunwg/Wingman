import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { OptionRow } from '@design/primitives/OptionRow';
import { Sheet } from '@design/primitives/Sheet';
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
    <Sheet
      open
      title="Not this time"
      label="Decline this request"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Decline</Button>
        </>
      }
    >
      <p className="sheet__body">
        They will just see that this closed. Not the reason, not when you read it, and not
        whether you read it at all.
      </p>

      <div className="sheet__options">
        {REASONS.map((r) => (
          <OptionRow
            key={r.id}
            label={r.label}
            note={r.note}
            selected={reason === r.id}
            onClick={() => setReason(r.id)}
          />
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
    </Sheet>
  );
}
