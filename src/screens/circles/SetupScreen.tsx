import { useRef, useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Chip, ToggleChip } from '@design/primitives/Chip';
import { Field } from '@design/primitives/Field';
import { OptionRow } from '@design/primitives/OptionRow';
import { Stepper } from '@design/primitives/Stepper';
import { CircleCrest } from '@design/patterns/CircleCrest';
import { resizeToDataUrl } from '@design/avatar/photo';
import type { Circle } from '@domain/index';
import { admissionSentence } from '@domain/index';
import { inviteLinkFor } from '@data/seed/circles';
import { useCircleSetup, type AdmissionMode } from './useCircleSetup';

/**
 * Opening a circle.
 *
 * The commercial motion in one screen: an organiser names the loop, decides
 * who gets in, names the roles, and gets a link. The middle step is the one
 * that matters, so it is a real choice with the trade-off written under it —
 * a list is closed, endings are provable, a link is a door key.
 */

const KINDS: { id: Circle['kind']; label: string; hint: string }[] = [
  { id: 'conference', label: 'Conference', hint: 'Runs for a few days, then stops matching.' },
  { id: 'school', label: 'School', hint: 'Alumni and students, usually by email ending.' },
  { id: 'employer', label: 'Employer', hint: 'Colleagues only. Never discoverable outside.' },
  { id: 'community', label: 'Community', hint: 'Anything else: a club, a cohort, a crew.' },
];

const MODES: { id: AdmissionMode; label: string; hint: string }[] = [
  { id: 'list', label: 'A list of people', hint: 'Paste addresses. Each person proves theirs to get in; the list is kept as hashes, never as addresses.' },
  { id: 'domain', label: 'Email endings', hint: 'Anyone who proves an address at these endings. The strongest option for a school or an employer.' },
  { id: 'link', label: 'Anyone with the link', hint: 'A door key, not a password. Fine for an open event; weak for anything that should stay closed.' },
];

const TITLES = ['Name and mark', 'Who gets in', 'Badges'];

export function SetupScreen({ onDone }: { onDone: () => void }) {
  const s = useCircleSetup();
  const d = s.draft;
  const fileInput = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  if (s.created) {
    const link = inviteLinkFor(s.created);
    return (
      <section className="panel">
        <div className="circlecard__head">
          <CircleCrest shortName={s.created.shortName} {...(s.created.crestUrl ? { crestUrl: s.created.crestUrl } : {})} size="lg" />
          <div className="circlecard__id">
            <h2 className="empty__title display">{s.created.name} is open</h2>
            <p className="circlecard__admission">{admissionSentence(s.created.admission)}</p>
          </div>
        </div>
        <p className="panel__note">
          Send this to the people you want in it. They join by opening it, and they still have
          to prove what the circle asks for before they are in.
        </p>
        <div className="invite">
          <code className="invite__link mono">{link}</code>
          <Button
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
        <Button variant="secondary" full onClick={onDone}>
          Done
        </Button>
      </section>
    );
  }

  const pickMark = async (file: File | undefined) => {
    if (!file) return;
    setMarkError(null);
    try {
      s.set('crestUrl', await resizeToDataUrl(file, { size: 128, quality: 0.85 }));
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <section className="signup">
      <Stepper
        index={s.step}
        count={3}
        title={TITLES[s.step]!}
        {...(s.step > 0 ? { onBack: () => s.setStep((s.step - 1) as 0 | 1) } : {})}
      />

      {s.step === 0 && (
        <>
          <div className="photopick">
            <CircleCrest shortName={d.name || 'C'} {...(d.crestUrl ? { crestUrl: d.crestUrl } : {})} size="lg" />
            <div className="photopick__actions">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="visually-hidden"
                aria-label="Upload a mark"
                onChange={(e) => void pickMark(e.target.files?.[0])}
              />
              <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                {d.crestUrl ? 'Change the mark' : 'Upload a mark'}
              </Button>
              {d.crestUrl && (
                <Button variant="quiet" size="sm" onClick={() => s.set('crestUrl', undefined)}>
                  Remove
                </Button>
              )}
              <p className="photopick__note">Square works best. Without one, two letters stand in.</p>
              {markError && (
                <p className="field__error" role="alert">
                  {markError}
                </p>
              )}
            </div>
          </div>

          <Field label="What is it called?">
            <input
              className="field__input"
              value={d.name}
              placeholder="Oslo Business Forum 2026"
              onChange={(e) => s.set('name', e.target.value)}
            />
          </Field>

          <div className="panel__stack">
            <span className="field__label">What kind?</span>
            {KINDS.map((k) => (
              <OptionRow key={k.id} label={k.label} note={k.hint} selected={d.kind === k.id} onClick={() => s.set('kind', k.id)} />
            ))}
          </div>

          {d.kind === 'conference' && (
            <div className="formrow">
              <Field label="From">
                <input className="field__input mono" type="date" value={d.from} onChange={(e) => s.set('from', e.target.value)} />
              </Field>
              <Field label="To">
                <input className="field__input mono" type="date" value={d.to} onChange={(e) => s.set('to', e.target.value)} />
              </Field>
            </div>
          )}

          <div className="signup__actions">
            <Button size="lg" disabled={!s.step1Ok} onClick={() => s.setStep(1)}>
              Next
            </Button>
          </div>
        </>
      )}

      {s.step === 1 && (
        <>
          <div className="panel__stack">
            {MODES.map((m) => (
              <OptionRow key={m.id} label={m.label} note={m.hint} selected={d.mode === m.id} onClick={() => s.set('mode', m.id)} />
            ))}
          </div>

          {d.mode === 'list' && (
            <>
              <Field
                label="Paste the list"
                hint="One per line, or separated by commas. Addresses are hashed on this device and never stored."
              >
                <textarea
                  className="field__input mono"
                  rows={6}
                  placeholder={'anna@example.no\nbjorn@example.no'}
                  value={d.listText}
                  onChange={(e) => s.set('listText', e.target.value)}
                />
              </Field>
              <p className="panel__note" role="status">
                {s.list.emails.length} {s.list.emails.length === 1 ? 'address' : 'addresses'}
                {s.list.duplicates > 0 && `, ${s.list.duplicates} duplicate${s.list.duplicates === 1 ? '' : 's'} removed`}
                {s.list.dropped > 0 && `, ${s.list.dropped} skipped`}
              </p>
              <label className="checkrow">
                <input type="checkbox" checked={d.alsoDomains} onChange={(e) => s.set('alsoDomains', e.target.checked)} />
                <span>Also admit anyone who proves an address at these endings</span>
              </label>
            </>
          )}

          {s.usesDomains && (
            <Field label="Email endings" hint="Press Enter after each one. Like obf.no or alumni.insead.edu.">
              <div className="panel__row">
                {d.domains.map((dom) => (
                  <ToggleChip key={dom} selected onClick={() => s.removeDomain(dom)}>
                    @{dom} ×
                  </ToggleChip>
                ))}
              </div>
              <input
                className="field__input mono"
                value={d.domainInput}
                placeholder="obf.no"
                onChange={(e) => s.set('domainInput', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    s.addDomain();
                  }
                }}
                onBlur={s.addDomain}
              />
            </Field>
          )}

          <div className="signup__actions">
            <Button size="lg" disabled={!s.step2Ok} onClick={() => s.setStep(2)}>
              Next
            </Button>
          </div>
        </>
      )}

      {s.step === 2 && (
        <>
          <p className="signup__lede">
            Roles a member can be found as. Speakers are findable as speakers; the organiser is
            findable as the person to ask. Turn off any you do not need.
          </p>
          <div className="panel__stack">
            {d.badges.map((b, i) => (
              <div className="badgerow" key={b.id}>
                <ToggleChip
                  selected={b.on}
                  onClick={() => s.set('badges', d.badges.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                >
                  <Chip tone={b.tone}>{b.label || b.id}</Chip>
                </ToggleChip>
                <input
                  className="field__input"
                  aria-label={`Label for ${b.id}`}
                  value={b.label}
                  maxLength={20}
                  onChange={(e) => s.set('badges', d.badges.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
              </div>
            ))}
          </div>
          <p className="panel__note">
            You will be its first member and wear Organiser. <Chip tone="neutral">Free while in beta</Chip>
          </p>
          <div className="signup__actions">
            <Button size="lg" loading={s.busy} onClick={() => void s.finish()}>
              Open the circle
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
