import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Chip, ToggleChip } from '@design/primitives/Chip';
import { Field } from '@design/primitives/Field';
import { OptionRow } from '@design/primitives/OptionRow';
import type { Circle } from '@domain/index';
import { asCircleId } from '@domain/ids';
import { asISODate, asUtc } from '@domain/time';
import { inviteLinkFor } from '@data/seed/circles';
import { useStore } from '@state/store';

/**
 * Opening a circle.
 *
 * The commercial motion in one screen: a school or a conference organiser
 * creates the loop, gets a link, and sends it to their people. Everything that
 * makes a circle worth belonging to is decided here.
 *
 * The important field is admission, and it is a real choice rather than a
 * setting. A domain circle admits anyone who can *prove* an address at that
 * domain — which is why an INSEAD circle actually contains INSEAD people, and
 * why nobody can type their way in. An invite-code circle is for bodies whose
 * members work everywhere, and it is weaker on purpose: a code can be
 * forwarded, so the screen says so rather than letting an organiser discover it
 * later.
 */

const KINDS: { id: Circle['kind']; label: string; hint: string }[] = [
  { id: 'school', label: 'School', hint: 'Alumni and students, by email domain.' },
  { id: 'employer', label: 'Employer', hint: 'Colleagues only. Never discoverable outside.' },
  { id: 'conference', label: 'Conference', hint: 'Runs for a few days, then stops matching.' },
  { id: 'community', label: 'Community', hint: 'Anything else — a club, a cohort, a crew.' },
];

export function NewCircleScreen({ onDone }: { onDone: () => void }) {
  const createCircle = useStore((s) => s.createCircle);
  const now = useStore((s) => s.now);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<Circle['kind']>('conference');
  const [byDomain, setByDomain] = useState(false);
  const [domain, setDomain] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [created, setCreated] = useState<Circle | null>(null);
  const [copied, setCopied] = useState(false);

  const timeBoxed = kind === 'conference';
  const domainOk = /^[^\s@]+\.[^\s@]{2,}$/.test(domain.trim());
  const valid = name.trim().length >= 2 && (!byDomain || domainOk);

  if (created) {
    const link = inviteLinkFor(created);
    return (
      <section className="panel">
        <h2 className="empty__title display">{created.name} is open</h2>
        <p className="panel__note">
          Send this to the people you want in it. They join by opening it — and if the circle
          admits by domain, they still have to prove an address before they are in.
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

        <p className="panel__note">
          Anyone with the link can ask to join, so treat it like a door key rather than a
          password — send it to a list, not to a public channel.
        </p>

        <Button variant="secondary" full onClick={onDone}>
          Done
        </Button>
      </section>
    );
  }

  return (
    <section className="panel">
      <Field label="What is it called?">
        <input
          className="field__input"
          value={name}
          placeholder="Grid Week Oslo 2026"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <div className="panel__stack">
        <span className="field__label">What kind?</span>
        {KINDS.map((k) => (
          <OptionRow
            key={k.id}
            label={k.label}
            note={k.hint}
            selected={kind === k.id}
            onClick={() => setKind(k.id)}
          />
        ))}
      </div>

      {timeBoxed && (
        <div className="panel__row">
          <Field label="From">
            <input
              className="field__input mono"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To">
            <input
              className="field__input mono"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="panel__stack">
        <span className="field__label">How do people get in?</span>
        <ToggleChip selected={!byDomain} onClick={() => setByDomain(false)}>
          Invite link
        </ToggleChip>
        <ToggleChip selected={byDomain} onClick={() => setByDomain(true)}>
          Verified email domain
        </ToggleChip>
        <p className="panel__note">
          {byDomain
            ? 'Strongest option: members prove an address at your domain, so nobody can claim their way in.'
            : 'A code can be forwarded. Fine for an event, weak for anything that should stay closed.'}
        </p>
      </div>

      {byDomain && (
        <Field
          label="Domain"
          {...(domain.length > 0 && !domainOk
            ? { error: 'That does not look like a domain — try insead.edu, without the @.' }
            : {})}
        >
          <input
            className="field__input mono"
            value={domain}
            placeholder="insead.edu"
            onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
          />
        </Field>
      )}

      <Button
        full
        disabled={!valid}
        onClick={() => {
          const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
          const circle: Circle = {
            id: asCircleId(id),
            name: name.trim(),
            shortName: name.trim().split(/\s+/).slice(0, 2).join(' '),
            kind,
            admission: byDomain
              ? { kind: 'email_domain', domains: [domain.trim()] }
              : { kind: 'invite_code' },
            crestSeed: `${id}-crest`,
            membersOnly: kind === 'employer',
            memberCount: 1,
            ...(timeBoxed && from && to
              ? { runs: { from: asISODate(from), to: asISODate(to) } }
              : {}),
            createdAt: asUtc(String(now)),
          };
          createCircle(circle);
          setCreated(circle);
        }}
      >
        Open the circle
      </Button>

      <p className="panel__note">
        You will be its first member and its admin. <Chip tone="neutral">Free while in beta</Chip>
      </p>
    </section>
  );
}
