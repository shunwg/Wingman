import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Field } from '@design/primitives/Field';
import { Sheet } from '@design/primitives/Sheet';
import { bucketPhrase } from '@lib/bucket';
import { useCircleAdmin } from './useCircleAdmin';

/**
 * The organiser's ten minutes.
 *
 * Two numbers a sponsor report needs, both bucketed; a pinned note that
 * lands on the General; and the one destructive action, behind a sheet.
 * Anyone who is not the organiser gets the not-found state, not a disabled
 * version of this.
 */
export function AdminScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const a = useCircleAdmin(id);
  const [note, setNote] = useState(a.isOrganiser ? a.pinned : '');
  const [saved, setSaved] = useState(false);
  const [closing, setClosing] = useState(false);

  if (!a.isOrganiser) {
    return (
      <div className="empty">
        <h2 className="empty__title display">Organisers only</h2>
        <p className="empty__body">Only the person who opened this circle can manage it.</p>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  const closed = a.circle.runs && String(a.circle.runs.to) < '2026-09-02';

  return (
    <>
      <button className="person__back" onClick={onBack} type="button">
        ← {a.circle.shortName}
      </button>

      <div className="stats">
        <div className="stat">
          <span className="stat__n mono">{bucketPhrase(a.circle.memberCount, 'member', 'members').replace(/ members?$/, '')}</span>
          <span className="stat__label">members</span>
        </div>
        <div className="stat">
          <span className="stat__n mono">{bucketPhrase(a.metThrough, 'meet', 'meets').replace(/ meets?$/, '')}</span>
          <span className="stat__label">met through this circle</span>
        </div>
      </div>
      <p className="panel__note">
        Bucketed on purpose. A sponsor report says &ldquo;about a hundred&rdquo;; an exact figure on
        a small circle is a roster.
      </p>

      <section className="panel">
        <h3 className="panel__title">Pinned on General</h3>
        <Field label="Announcement" hint="Registration times, the lounge, tonight's dinner. Up to 280 characters.">
          <textarea
            className="field__input"
            rows={3}
            maxLength={280}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(false);
            }}
          />
        </Field>
        <Button
          size="sm"
          disabled={note.trim().length === 0}
          onClick={() => {
            a.announce(note);
            setSaved(true);
          }}
        >
          {saved ? 'Pinned' : 'Pin it'}
        </Button>
      </section>

      <section className="panel">
        <h3 className="panel__title">Invitations</h3>
        <Button size="sm" variant="secondary" onClick={() => (window.location.hash = `#/circles/${id}/invite`)}>
          Invite people
        </Button>
      </section>

      <section className="panel">
        <h3 className="panel__title">Close the circle</h3>
        <p className="panel__note">
          Stops it matching from today. Members keep their badge history; nobody is findable
          through it any more.
        </p>
        <Button size="sm" variant="danger" disabled={Boolean(closed)} onClick={() => setClosing(true)}>
          {closed ? 'Closed' : 'Close the circle'}
        </Button>
      </section>

      <Sheet
        open={closing}
        title={`Close ${a.circle.shortName}?`}
        onClose={() => setClosing(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setClosing(false)}>
              Keep it open
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                a.close();
                setClosing(false);
              }}
            >
              Close it
            </Button>
          </>
        }
      >
        <p className="sheet__body">It stops matching today. This cannot be undone from here.</p>
      </Sheet>
    </>
  );
}
