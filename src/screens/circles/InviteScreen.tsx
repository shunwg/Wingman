import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { Field } from '@design/primitives/Field';
import { QrCode } from '@design/patterns/QrCode';
import { admissionSentence } from '@domain/index';
import { hashEmail } from './hash';
import { parseList } from './useCircleSetup';
import { useCircleAdmin } from './useCircleAdmin';

/**
 * Getting people in.
 *
 * Three ways to hand out the same door key: the link for a message, the six
 * characters for a slide, the QR for a lanyard. A badge link is the same key
 * with a role attached. For a list circle, more addresses can be added here;
 * they are hashed before they are stored, like the first batch.
 */
export function InviteScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const a = useCircleAdmin(id);
  const [copied, setCopied] = useState<string | null>(null);
  const [more, setMore] = useState('');
  const [added, setAdded] = useState<number | null>(null);

  if (!a.isOrganiser) {
    return (
      <div className="empty">
        <h2 className="empty__title display">Organisers only</h2>
        <p className="empty__body">Only the person who opened this circle can invite to it.</p>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  const copy = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
  };
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: a.circle.name, text: `Join ${a.circle.name} on Wingman`, url: a.link });
      } catch {
        /* dismissed */
      }
    } else {
      copy(a.link, 'link');
    }
  };

  const listRule =
    a.circle.admission.kind === 'invite_list'
      ? a.circle.admission
      : a.circle.admission.kind === 'any_of'
        ? a.circle.admission.rules.find((r) => r.kind === 'invite_list')
        : undefined;

  const addMore = async () => {
    if (!listRule || listRule.kind !== 'invite_list') return;
    const { emails } = parseList(more);
    const hashes = await Promise.all(emails.map((e) => hashEmail(e, listRule.salt)));
    const merged = [...new Set([...listRule.emailHashes, ...hashes])];
    const rule = { ...listRule, emailHashes: merged };
    const admission =
      a.circle.admission.kind === 'any_of'
        ? { ...a.circle.admission, rules: a.circle.admission.rules.map((r) => (r.kind === 'invite_list' ? rule : r)) }
        : rule;
    a.update({ ...a.circle, admission });
    setAdded(merged.length - listRule.emailHashes.length);
    setMore('');
  };

  return (
    <>
      <button className="person__back" onClick={onBack} type="button">
        ← {a.circle.shortName}
      </button>
      <p className="screennote">{admissionSentence(a.circle.admission)}</p>

      <section className="panel">
        <h3 className="panel__title">On a slide</h3>
        <p className="invitecode mono">{a.code}</p>
        <p className="panel__note">People type it at wingman → Circles → Join, or open the link below.</p>
      </section>

      <section className="panel">
        <h3 className="panel__title">On a lanyard</h3>
        <div className="qrwrap">
          <QrCode text={a.link} size={220} label={`Invitation to ${a.circle.name}`} />
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__title">In a message</h3>
        <div className="invite">
          <code className="invite__link mono">{a.link}</code>
          <Button size="sm" onClick={() => copy(a.link, 'link')}>
            {copied === 'link' ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <Button variant="secondary" full onClick={() => void share()}>
          Share
        </Button>
      </section>

      {a.badgeLinks.length > 0 && (
        <section className="panel">
          <h3 className="panel__title">Badge links</h3>
          <p className="panel__note">
            The same door key with a role attached. Send the speaker link to speakers and they are
            findable as speakers.
          </p>
          <div className="badgelinks">
            {a.badgeLinks.map((b) => (
              <div className="badgelink" key={b.badge.id}>
                <Chip tone={b.badge.tone}>{b.badge.label}</Chip>
                <span className="badgelink__code mono">{b.code}</span>
                <Button size="sm" variant="secondary" onClick={() => copy(b.link, b.badge.id)}>
                  {copied === b.badge.id ? 'Copied' : 'Copy'}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {listRule && (
        <section className="panel">
          <h3 className="panel__title">Add more people</h3>
          <Field label="Paste addresses" hint="Hashed on this device, never stored as addresses.">
            <textarea className="field__input mono" rows={3} value={more} onChange={(e) => setMore(e.target.value)} />
          </Field>
          <Button size="sm" disabled={parseList(more).emails.length === 0} onClick={() => void addMore()}>
            Add {parseList(more).emails.length || ''}
          </Button>
          {added !== null && (
            <p className="panel__note" role="status">
              {added} added.
            </p>
          )}
        </section>
      )}

      <p className="panel__note">
        <Chip tone="neutral">Free while in beta</Chip> Per-event pricing for organisers comes with the
        server. Travellers never pay.
      </p>
    </>
  );
}
