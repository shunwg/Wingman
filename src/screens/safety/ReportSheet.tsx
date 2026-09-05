import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Field } from '@design/primitives/Field';
import { OptionRow } from '@design/primitives/OptionRow';
import { Sheet } from '@design/primitives/Sheet';
import type { Message, PersonId, SafetyReport } from '@domain/index';
import { REPORT_REASONS } from '@domain/index';
import { useStore } from '@state/store';

/**
 * Report someone, or one thing they said.
 *
 * Hiding them is checked by default and separate: a report is for trust and
 * safety, hiding is for you, and the person is told about neither. The sheet
 * says where the report goes, which for now is nowhere but this device.
 */
export function ReportSheet({
  personId,
  firstName,
  message,
  onClose,
}: {
  personId: PersonId;
  firstName: string;
  /** Reporting one message rather than the person. */
  message?: Message;
  onClose: () => void;
}) {
  const reportPerson = useStore((s) => s.reportPerson);
  const reportMessage = useStore((s) => s.reportMessage);
  const blockPerson = useStore((s) => s.blockPerson);
  const [reason, setReason] = useState<SafetyReport['reason']>('pushy');
  const [note, setNote] = useState('');
  const [alsoHide, setAlsoHide] = useState(true);

  const submit = () => {
    if (message) {
      reportMessage(message, reason, note);
      if (alsoHide) blockPerson(personId);
    } else {
      reportPerson(personId, reason, note, alsoHide);
    }
    onClose();
  };

  return (
    <Sheet
      open
      title={message ? 'Report this message' : `Report ${firstName}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit}>
            Report
          </Button>
        </>
      }
    >
      <p className="sheet__body">
        Kept on this device until Wingman has a server. {firstName} is told nothing. Hiding is
        immediate.
      </p>
      <div className="sheet__options">
        {REPORT_REASONS.map((r) => (
          <OptionRow key={r.id} label={r.label} selected={reason === r.id} onClick={() => setReason(r.id)} />
        ))}
      </div>
      <Field label="Anything else" hint="Optional.">
        <textarea
          className="field__input"
          rows={2}
          maxLength={240}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <label className="checkrow">
        <input type="checkbox" checked={alsoHide} onChange={(e) => setAlsoHide(e.target.checked)} />
        <span>Also hide {firstName} from me</span>
      </label>
    </Sheet>
  );
}
