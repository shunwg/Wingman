import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { ToggleChip } from '@design/primitives/Chip';
import { OptionRow } from '@design/primitives/OptionRow';
import { Sheet } from '@design/primitives/Sheet';
import type { PersonId, Rating, SafetyFlag } from '@domain/index';
import { REPORT_REASONS } from '@domain/index';
import { useStore } from '@state/store';

/**
 * Thirty seconds after a meet.
 *
 * Conduct, not quality: did they turn up, would you meet again, was anything
 * wrong. No stars, nothing about looks. It doubles as the guardian check-out,
 * because "I'm safe" and "how was it" are the same moment.
 */
export function AfterMeetSheet({
  channelId,
  otherId,
  firstName,
  onClose,
}: {
  channelId: string;
  otherId: PersonId;
  firstName: string;
  onClose: () => void;
}) {
  const rate = useStore((s) => s.rate);
  const checkOut = useStore((s) => s.checkOut);
  const [showedUp, setShowedUp] = useState<Rating['showedUp']>('on_time');
  const [again, setAgain] = useState<boolean | null>(null);
  const [flags, setFlags] = useState<SafetyFlag[]>([]);

  const toggleFlag = (f: SafetyFlag) =>
    setFlags((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));

  return (
    <Sheet
      open
      title={`How was meeting ${firstName}?`}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Later
          </Button>
          <Button
            disabled={again === null}
            onClick={() => {
              rate(channelId, otherId, {
                showedUp,
                respectedBoundaries: !flags.includes('pushy') && !flags.includes('unsafe'),
                accurateProfile: !flags.includes('misrepresented'),
                wouldMeetAgain: again === true,
                flags,
              });
              checkOut();
              onClose();
            }}
          >
            Done
          </Button>
        </>
      }
    >
      <div className="sheet__options">
        <OptionRow label="They were there" selected={showedUp === 'on_time'} onClick={() => setShowedUp('on_time')} />
        <OptionRow label="They were late" selected={showedUp === 'late'} onClick={() => setShowedUp('late')} />
        <OptionRow label="They did not show" selected={showedUp === 'no_show'} onClick={() => setShowedUp('no_show')} />
      </div>
      <p className="sheet__body">Would you meet {firstName} again?</p>
      <div className="panel__row">
        <ToggleChip selected={again === true} onClick={() => setAgain(true)}>
          Yes
        </ToggleChip>
        <ToggleChip selected={again === false} onClick={() => setAgain(false)}>
          No
        </ToggleChip>
      </div>
      <p className="sheet__body">Anything wrong? Only trust and safety ever sees this.</p>
      <div className="panel__row">
        {REPORT_REASONS.filter((r) => r.id !== 'other').map((r) => (
          <ToggleChip key={r.id} selected={flags.includes(r.id as SafetyFlag)} onClick={() => toggleFlag(r.id as SafetyFlag)}>
            {r.label}
          </ToggleChip>
        ))}
      </div>
    </Sheet>
  );
}
