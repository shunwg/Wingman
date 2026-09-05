import { useMemo, useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Chip, ToggleChip } from '@design/primitives/Chip';
import { PersonCard } from '@design/patterns/PersonCard';
import { compilePolicy, previewAs, type ViewerPersona } from '@privacy/index';
import { bucketPhrase } from '@lib/bucket';
import { personById } from '@data/seed/people';
import { decoratePerson, useCircles } from '@state/selectors/circles';
import { useStore } from '@state/store';

/**
 * Safety, on You.
 *
 * Three answers a careful person wants before they trust the board: what a
 * stranger actually sees (rendered by the same `redact()` a stranger's
 * device would run, not a description of it), who you have hidden and how to
 * undo it, and what you have reported. No counts of who can see you appear
 * here — a figure on a settings screen is a nudge, and the preview is the
 * honest version of the same question.
 */

const PERSONAS: ViewerPersona[] = [
  {
    id: 'stranger',
    label: 'An unverified stranger in your city',
    facets: { gender: '*', assurance: 0, stampKinds: [], circleIds: [], intents: '*', proximity: 'same_city', channel: 'app' },
  },
  {
    id: 'verified',
    label: 'Someone ID-verified on your flight',
    facets: {
      gender: '*',
      assurance: 3,
      stampKinds: ['government_eid'],
      circleIds: [],
      intents: '*',
      proximity: 'same_flight',
      channel: 'app',
    },
  },
];

export function SafetySection() {
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const reports = useStore((s) => s.reports);
  const unblockPerson = useStore((s) => s.unblockPerson);
  const [personaId, setPersonaId] = useState<string>('stranger');
  const circles = useCircles();

  const circleKey = me.memberships.filter((m) => m.display !== 'paused').map((m) => String(m.circleId)).join(',');
  const preview = useMemo(() => {
    const ownCircleIds = circleKey ? circleKey.split(',') : [];
    const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0]!;
    const r = previewAs(me, compilePolicy(me.privacy, ownCircleIds), persona, { now, ownCircleIds, onTrip: true });
    return { ...r, view: decoratePerson(r.view, circles) };
  }, [me, now, personaId, circleKey, circles]);

  return (
    <section className="panel">
      <h3 className="panel__title">Safety</h3>

      <p className="panel__note">What they would see, rendered exactly as their device would render it.</p>
      <div className="panel__row">
        {PERSONAS.map((p) => (
          <ToggleChip key={p.id} selected={personaId === p.id} onClick={() => setPersonaId(p.id)}>
            {p.label}
          </ToggleChip>
        ))}
      </div>
      {preview.visible ? (
        <div className="preview">
          <PersonCard person={preview.view} context="Preview" />
        </div>
      ) : (
        <div className="circlecard__locked">
          They cannot see you.
          {preview.reasons.length > 0 && ` ${preview.reasons.map((r) => r.text).join(' ')}`}
        </div>
      )}

      <h4 className="panel__subtitle">Hidden from you</h4>
      {me.blocked.length === 0 ? (
        <p className="panel__note">Nobody. Hide anyone from the menu on their card or in a room.</p>
      ) : (
        <ul className="hiddenlist">
          {me.blocked.map((id) => (
            <li key={String(id)} className="hiddenlist__row">
              <span>{personById(String(id))?.firstName ?? 'Someone'}</span>
              <Button size="sm" variant="quiet" onClick={() => unblockPerson(id)}>
                Unhide
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="panel__note">
        {reports.length === 0 ? (
          'Nothing reported.'
        ) : (
          <>
            <Chip tone="neutral">{bucketPhrase(reports.length, 'report', 'reports')} sent</Chip> Kept on this
            device until Wingman has a server.
          </>
        )}
      </p>
    </section>
  );
}
