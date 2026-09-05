import { Button } from '@design/primitives/Button';
import { Sheet } from '@design/primitives/Sheet';
import type { MeetRequest } from '@domain/index';
import { FIELD_LABEL, FIELD_LEVEL, PROFESSIONAL_FIELD_LEVEL, linkLevel } from '@privacy/index';
import { useStore } from '@state/store';

/**
 * What a yes reveals — said before it is said.
 *
 * Computed from the ladder, not written by hand, so this sheet cannot drift
 * from what `redact()` will actually release at rung 2. The terminal line is
 * the one thing the ladder does not cover: it appears once you post an
 * update, and only then.
 */
export function AcceptSheet({
  request,
  firstName,
  onClose,
  onConfirm,
}: {
  request: MeetRequest;
  firstName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const me = useStore((s) => s.me);

  const reveals: string[] = [];
  for (const [field, level] of Object.entries(FIELD_LEVEL)) {
    if (level === 2) reveals.push(FIELD_LABEL[field as keyof typeof FIELD_LABEL] ?? field);
  }
  if (PROFESSIONAL_FIELD_LEVEL.company === 2 && me.professional.company) reveals.push('Where you work');
  for (const l of me.links) {
    if (linkLevel(l) === 2) reveals.push(`Your ${l.network === 'website' ? 'website' : l.network} link`);
  }
  reveals.push('Your terminal — once you post an update in the room');

  return (
    <Sheet
      open
      title={`Meet ${firstName}?`}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Not yet
          </Button>
          <Button onClick={onConfirm}>Yes, meet</Button>
        </>
      }
    >
      <p className="sheet__body">
        {firstName} proposed {request.proposal.kind.replace(/_/g, ' ')}. Saying yes opens a room
        and shows them:
      </p>
      <ul className="reveal">
        {reveals.map((r) => (
          <li key={r} className="reveal__item">
            {r}
          </li>
        ))}
      </ul>
      <p className="sheet__body">
        Nothing else. You can hide or report them at any time, and a yes is not a commitment
        to keep talking.
      </p>
    </Sheet>
  );
}
