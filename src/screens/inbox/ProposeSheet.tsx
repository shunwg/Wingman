import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { ToggleChip } from '@design/primitives/Chip';
import { Field } from '@design/primitives/Field';
import { Sheet } from '@design/primitives/Sheet';
import type { MeetKind, MeetRequest } from '@domain/index';
import { addMinutes, minutesBetween, type ISODateTime } from '@domain/time';
import { MEET_KIND_LABEL, MEET_KIND_ORDER } from '@data/copy/meetKinds';

/**
 * Suggest a time.
 *
 * The room's job is to turn a yes into a meeting. This offers a start inside
 * the window the request was about, a length, and a public place in words —
 * never coordinates, never a gate you did not choose to name. It posts a
 * proposal into the room, which the other person can add to a calendar or
 * answer with another time.
 */
export interface ProposalDraft {
  meetKind: MeetKind;
  window: { from: ISODateTime; to: ISODateTime };
  placeLabel: string;
}

const LENGTHS = [30, 45, 60] as const;

export function ProposeSheet({
  request,
  defaultPlace,
  clock,
  onClose,
  onPost,
}: {
  request: MeetRequest;
  defaultPlace: string;
  /** Renders an instant as local wall-clock, e.g. "12:10". */
  clock: (t: string) => string;
  onClose: () => void;
  onPost: (p: ProposalDraft) => void;
}) {
  const base = request.proposal.window;
  const span = Math.max(0, minutesBetween(base.from, base.to));
  // Starts every half hour across the window, at most four.
  const starts: ISODateTime[] = [];
  for (let m = 0; m <= span - 30 && starts.length < 4; m += 30) starts.push(addMinutes(base.from, m));
  if (starts.length === 0) starts.push(base.from);

  const [kind, setKind] = useState<MeetKind>(request.proposal.kind);
  const [start, setStart] = useState<ISODateTime>(starts[0]!);
  const [length, setLength] = useState<(typeof LENGTHS)[number]>(30);
  const [place, setPlace] = useState(defaultPlace);

  const kinds = [request.proposal.kind, ...MEET_KIND_ORDER.filter((k) => k !== request.proposal.kind)].slice(0, 4);

  return (
    <Sheet
      open
      title="Suggest a time"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={place.trim().length === 0}
            onClick={() => onPost({ meetKind: kind, window: { from: start, to: addMinutes(start, length) }, placeLabel: place.trim().slice(0, 80) })}
          >
            Suggest
          </Button>
        </>
      }
    >
      <div className="ask__kinds" role="group" aria-label="What">
        {kinds.map((k) => (
          <ToggleChip key={k} selected={kind === k} onClick={() => setKind(k)}>
            {MEET_KIND_LABEL[k]}
          </ToggleChip>
        ))}
      </div>
      <h4 className="ask__sub">When</h4>
      <div className="ask__kinds" role="group" aria-label="Start">
        {starts.map((t) => (
          <ToggleChip key={t} selected={start === t} onClick={() => setStart(t)} className="mono">
            {clock(t)}
          </ToggleChip>
        ))}
      </div>
      <div className="ask__kinds" role="group" aria-label="Length">
        {LENGTHS.map((l) => (
          <ToggleChip key={l} selected={length === l} onClick={() => setLength(l)} className="mono">
            {l} min
          </ToggleChip>
        ))}
      </div>
      <Field label="Where" hint="A public place, in words. Never an address.">
        <input className="field__input" value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} />
      </Field>
    </Sheet>
  );
}
