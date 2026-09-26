import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { ToggleChip } from '@design/primitives/Chip';
import { Field } from '@design/primitives/Field';
import { Sheet } from '@design/primitives/Sheet';
import type { MeetKind, MeetRequest, PublicPlace } from '@domain/index';
import { addMinutes, epoch, minutesBetween, type ISODateTime } from '@domain/time';
import { MEET_KIND_LABEL, MEET_KIND_ORDER } from '@data/copy/meetKinds';
import { PLACE_KIND_CHOICES, PLACE_KIND_LABEL } from '@data/copy/plans';
import { useStore } from '@state/store';

/**
 * Suggest a time.
 *
 * The room's job is to turn a yes into a meeting. This offers a start inside
 * the window the request was about, a length, and a public place in words —
 * never coordinates, never a gate you did not choose to name. It posts a
 * proposal into the room, which the other person can say yes to — making it
 * the plan — or answer with another time.
 */
export interface ProposalDraft {
  meetKind: MeetKind;
  window: { from: ISODateTime; to: ISODateTime };
  placeLabel: string;
  /** What sort of public place — so an agreed plan is a typed `PublicPlace`, not a string. */
  placeKind: PublicPlace['kind'];
}

/** The place a kind of meet usually happens at. A default, never a constraint. */
const PLACE_FOR: Record<MeetKind, PublicPlace['kind']> = {
  gate_coffee: 'cafe',
  lounge: 'lounge',
  terminal_walk: 'terminal_landmark',
  ride_share: 'taxi_rank',
  meal: 'restaurant',
  drinks: 'restaurant',
  business_intro: 'cafe',
  coworking: 'lounge',
};

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
  const now = useStore((s) => s.now);
  const base = request.proposal.window;
  const span = Math.max(0, minutesBetween(base.from, base.to));
  // Starts every half hour across the window, at most four — and never one
  // that has already begun, which the other person could not say yes to.
  const starts: ISODateTime[] = [];
  for (let m = 0; m <= span - 30 && starts.length < 4; m += 30) {
    const t = addMinutes(base.from, m);
    if (epoch(t) > epoch(now)) starts.push(t);
  }
  if (starts.length === 0) {
    // The window has gone by; offer the next half hours from now instead.
    const next = new Date(Math.ceil((epoch(now) + 1) / 1_800_000) * 1_800_000).toISOString() as ISODateTime;
    for (let m = 0; m < 120; m += 30) starts.push(addMinutes(next, m));
  }

  const [kind, setKind] = useState<MeetKind>(request.proposal.kind);
  const [start, setStart] = useState<ISODateTime>(starts[0]!);
  const [length, setLength] = useState<(typeof LENGTHS)[number]>(30);
  const [place, setPlace] = useState(defaultPlace);
  const [placeKind, setPlaceKind] = useState<PublicPlace['kind']>(PLACE_FOR[request.proposal.kind]);

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
            onClick={() =>
              onPost({
                meetKind: kind,
                window: { from: start, to: addMinutes(start, length) },
                placeLabel: place.trim().slice(0, 80),
                placeKind,
              })
            }
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
      <h4 className="ask__sub">Where</h4>
      <div className="ask__kinds" role="group" aria-label="What kind of place">
        {PLACE_KIND_CHOICES.map((k) => (
          <ToggleChip key={k} selected={placeKind === k} onClick={() => setPlaceKind(k)}>
            {PLACE_KIND_LABEL[k]}
          </ToggleChip>
        ))}
      </div>
      <Field label="Which one" hint="A public place, in words. Never an address.">
        <input className="field__input" value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} />
      </Field>
    </Sheet>
  );
}
