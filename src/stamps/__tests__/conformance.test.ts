import { describe, expect, it } from 'vitest';
import { asPersonId } from '@domain/ids';
import { asUtc } from '@domain/time';
import { PROVIDERS, providerById } from '../registry';
import { assuranceOf, isActive, lapsed, revoke } from '../assurance';
import { addMinutes, type StampEnv, type StampProvider } from '../contract';
import { domainOf, mockCodeFor } from '../providers/email-domain';

/**
 * The conformance suite.
 *
 * Every registered provider goes through the same assertions, so a new one
 * cannot ship with a subtly different idea of what expiry means or what belongs
 * in a record. This is the test that makes "adding a provider is one file plus
 * one registry line" true rather than aspirational — the cost of a new provider
 * is bounded because this file already says what it must do.
 */

const NOW = asUtc('2026-09-02T16:30:00Z');
const ME = asPersonId('you');

const env = (over: Partial<StampEnv> = {}): StampEnv => ({
  configured: [],
  allowMocks: true,
  platform: 'mobile',
  ...over,
});

/** Drive a provider to a successful record, whatever shape it uses. */
function succeed(p: StampProvider, e: StampEnv = env()) {
  const challenge = p.begin({ personId: ME, now: NOW, sessionId: 's1' }, e);
  const answer =
    p.id === 'email_otp'
      ? `alex@insead.edu|${mockCodeFor('s1')}`
      : p.id === 'google'
        ? 'alex@tidecapital.no'
        : 'alexferrand';
  const polled = p.poll ? p.poll(challenge, 5000) : undefined;
  return p.complete({
    challenge,
    personId: ME,
    now: NOW,
    recordId: `v_${p.id}`,
    answer,
    ...(polled ? { polled } : {}),
  });
}

describe('every registered provider', () => {
  it.each(PROVIDERS.map((p) => [p.id, p] as const))('%s — declares a coherent identity', (_id, p) => {
    expect(p.id).toMatch(/^[a-z0-9_]+$/);
    expect(p.modes.length).toBeGreaterThan(0);
    expect(p.display.label.length).toBeGreaterThan(0);
    expect(p.display.explainer.length).toBeGreaterThan(0);
    // What it proves and what it buys you are different questions, and the
    // second is the one people decide on. A provider that ships without it
    // would render a blank reason next to a Connect button.
    expect(p.unlocks.length).toBeGreaterThan(0);
    // Colour is never the only indicator, so every stamp carries an icon key
    // and a label as well as a tone.
    expect(p.display.iconKey.length).toBeGreaterThan(0);
    expect(p.assurance).toBeGreaterThanOrEqual(0);
    expect(p.assurance).toBeLessThanOrEqual(3);
  });

  it.each(PROVIDERS.map((p) => [p.id, p] as const))('%s — begins a usable challenge', (_id, p) => {
    const c = p.begin({ personId: ME, now: NOW, sessionId: 's1' }, env());

    expect(p.modes).toContain(c.mode);
    expect(c.providerId).toBe(p.id);
    expect(c.sessionId).toBe('s1');
    expect(String(c.expiresAt) > String(NOW)).toBe(true);
    expect(c.waitingCopy.length).toBeGreaterThan(0);

    // The shape has to carry what its renderer needs, or the screen renders an
    // empty state and nobody finds out until someone tries to verify.
    if (c.mode === 'redirect' || c.mode === 'deeplink') expect(c.url).toBeTruthy();
    if (c.mode === 'input') expect(c.prompt).toBeTruthy();
    if (c.mode === 'polling') expect(c.poll).toBeTruthy();
    if (c.poll) expect(p.poll).toBeTypeOf('function');
  });

  it.each(PROVIDERS.map((p) => [p.id, p] as const))('%s — is deterministic', (_id, p) => {
    const a = p.begin({ personId: ME, now: NOW, sessionId: 's1' }, env());
    const b = p.begin({ personId: ME, now: NOW, sessionId: 's1' }, env());
    // Same inputs, same challenge. A provider reaching for a clock or a random
    // source would fail here, which is the point.
    expect(JSON.stringify({ ...a, prompt: undefined })).toBe(
      JSON.stringify({ ...b, prompt: undefined }),
    );
  });

  it.each(PROVIDERS.map((p) => [p.id, p] as const))('%s — completes into a valid record', (_id, p) => {
    const res = succeed(p);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(String(res.record.personId)).toBe('you');
    expect(res.record.providerId).toBe(p.id);
    expect(res.record.assurance).toBe(p.assurance);
    expect(res.record.kind).toBe(p.kind);
    expect(res.record.revokedAt).toBeUndefined();
  });

  it.each(PROVIDERS.map((p) => [p.id, p] as const))('%s — stores no secrets', (_id, p) => {
    const res = succeed(p);
    if (!res.ok) throw new Error('expected success');

    // The record is proof that something was checked, not a copy of it. A
    // token, a national identity number or a date of birth appearing here is
    // the difference between a breach and a catastrophe.
    const keys = Object.keys(res.record.evidence ?? {});
    expect(keys.every((k) => ['handle', 'domain', 'url'].includes(k))).toBe(true);
    const blob = JSON.stringify(res.record).toLowerCase();
    for (const forbidden of ['token', 'secret', 'password', 'fodselsnummer', 'ssn', 'birth']) {
      expect(blob).not.toContain(forbidden);
    }
  });

  it.each(PROVIDERS.map((p) => [p.id, p] as const))('%s — refuses an expired challenge', (_id, p) => {
    const c = p.begin({ personId: ME, now: NOW, sessionId: 's1' }, env());
    const late = addMinutes(c.expiresAt, 1);
    const res = p.complete({
      challenge: c,
      personId: ME,
      now: late,
      recordId: 'v_late',
      answer: 'alexferrand',
      ...(p.poll ? { polled: p.poll(c, 5000) } : {}),
    });
    expect(res.ok).toBe(false);
  });

  it.each(PROVIDERS.map((p) => [p.id, p] as const))("%s — refuses another provider's challenge", (_id, p) => {
    const other = PROVIDERS.find((q) => q.id !== p.id)!;
    const c = other.begin({ personId: ME, now: NOW, sessionId: 's1' }, env());
    const res = p.complete({ challenge: c, personId: ME, now: NOW, recordId: 'x', answer: 'a' });
    expect(res.ok).toBe(false);
  });
});

describe('challenge modes', () => {
  it('covers all four shapes across the registry', () => {
    const modes = new Set(PROVIDERS.flatMap((p) => [...p.modes]));
    // Four renderers exist in screens/verify/. If a provider ever introduces a
    // fifth shape, this fails rather than the screen silently rendering nothing.
    expect([...modes].sort()).toEqual(['deeplink', 'input', 'polling', 'redirect']);
  });

  it('gives BankID a deeplink on a phone and a reference on a laptop', () => {
    const p = providerById('bankid_no')!;

    const phone = p.begin({ personId: ME, now: NOW, sessionId: 's1' }, env({ platform: 'mobile' }));
    expect(phone.mode).toBe('deeplink');
    expect(phone.url).toContain('bankid:///');

    const laptop = p.begin({ personId: ME, now: NOW, sessionId: 's1' }, env({ platform: 'desktop' }));
    expect(laptop.mode).toBe('polling');
    // The anti-phishing step: a reference you compare, never one you type.
    expect(laptop.reference).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(laptop.waitingCopy).toContain(laptop.reference!);
  });

  it('does not resolve BankID instantly, because the real one does not either', () => {
    const p = providerById('bankid_no')!;
    const c = p.begin({ personId: ME, now: NOW, sessionId: 's1' }, env());
    expect(p.poll!(c, 500)).toEqual({ status: 'pending' });
    expect(p.poll!(c, 5000)).toEqual({ status: 'ready' });
    expect(p.poll!(c, 10 * 60 * 1000)).toEqual({ status: 'expired' });
  });
});

describe('email domain', () => {
  const p = providerById('email_otp')!;
  const prompt = p.begin({ personId: ME, now: NOW, sessionId: 's1' }, env()).prompt!;

  it('takes an institutional address', () => {
    expect(prompt.validate('alex@insead.edu')).toEqual({ ok: true });
    expect(domainOf('Alex@INSEAD.edu')).toBe('insead.edu');
  });

  it('rejects a personal one, with the reason', () => {
    const r = prompt.validate('alex@gmail.com');
    expect(r.ok).toBe(false);
    // A free provider proves nothing about affiliation, and saying so is more
    // useful than "invalid email".
    if (!r.ok) expect(r.message).toContain('personal');
  });

  it('keeps the domain and never the local part', () => {
    const res = succeed(p);
    if (!res.ok) throw new Error('expected success');
    expect(res.record.evidence?.domain).toBe('insead.edu');
    expect(JSON.stringify(res.record)).not.toContain('alex');
  });

  it('rejects a wrong code', () => {
    const c = p.begin({ personId: ME, now: NOW, sessionId: 's1' }, env());
    const res = p.complete({
      challenge: c,
      personId: ME,
      now: NOW,
      recordId: 'v',
      answer: 'alex@insead.edu|000000',
    });
    expect(res.ok).toBe(false);
  });
});

describe('assurance', () => {
  const rec = (assurance: 0 | 1 | 2 | 3, over = {}) => ({
    id: `v${assurance}` as never,
    personId: ME,
    providerId: 'x',
    kind: 'social_account' as const,
    assurance,
    verifiedAt: NOW,
    ...over,
  });

  it('takes the maximum, never the sum', () => {
    // Three social accounts do not add up to a government eID. Anyone can hold
    // three social accounts — that is the point of them.
    expect(assuranceOf([rec(1), rec(1), rec(1)], NOW)).toBe(1);
    expect(assuranceOf([rec(1), rec(3)], NOW)).toBe(3);
  });

  it('ignores revoked and lapsed records', () => {
    expect(assuranceOf([rec(3, { revokedAt: NOW })], NOW)).toBe(0);
    expect(assuranceOf([rec(3, { expiresAt: asUtc('2026-01-01T00:00:00Z') })], NOW)).toBe(0);
    expect(isActive(rec(3, { revokedAt: NOW }), NOW)).toBe(false);
  });

  it('reports what needs re-checking without counting revoked ones', () => {
    const stale = rec(1, { expiresAt: asUtc('2026-01-01T00:00:00Z') });
    const gone = rec(1, { expiresAt: asUtc('2026-01-01T00:00:00Z'), revokedAt: NOW });
    expect(lapsed([stale, gone, rec(3)], NOW)).toEqual([stale]);
  });

  it('drops assurance the moment a stamp is revoked', () => {
    const live = rec(3);
    expect(assuranceOf([live], NOW)).toBe(3);
    expect(assuranceOf([revoke(live, NOW)], NOW)).toBe(0);
  });
});
