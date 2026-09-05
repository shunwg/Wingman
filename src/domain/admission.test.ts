import { describe, expect, it } from 'vitest';
import { admissionSentence, admits, normaliseEmail, type AdmissionProof } from './admission';
import type { AdmissionRule } from './circle';

const none: AdmissionProof = { verifiedDomains: [] };
const insead: AdmissionProof = { verifiedDomains: ['insead.edu'] };
const listed: AdmissionProof = { verifiedDomains: [], emailHash: 'h1' };
const holder: AdmissionProof = { verifiedDomains: [], hasLink: true };

const domain: AdmissionRule = { kind: 'email_domain', domains: ['INSEAD.edu', 'alumni.insead.edu'] };
const list: AdmissionRule = { kind: 'invite_list', emailHashes: ['h1', 'h2'], salt: 's' };
const link: AdmissionRule = { kind: 'invite_code' };

describe('admits', () => {
  it('a domain rule needs a verified address on one of its endings, any case', () => {
    expect(admits(domain, insead)).toBe(true);
    expect(admits(domain, { verifiedDomains: ['ALUMNI.INSEAD.EDU'] })).toBe(true);
    expect(admits(domain, { verifiedDomains: ['gmail.com'] })).toBe(false);
    expect(admits(domain, none)).toBe(false);
  });

  it('a list rule needs the hash, and a hashed list never contains an address', () => {
    expect(admits(list, listed)).toBe(true);
    expect(admits(list, { verifiedDomains: [], emailHash: 'h9' })).toBe(false);
    expect(admits(list, insead)).toBe(false);
    for (const h of list.kind === 'invite_list' ? list.emailHashes : []) expect(h).not.toContain('@');
  });

  it('a link rule needs the link', () => {
    expect(admits(link, holder)).toBe(true);
    expect(admits(link, none)).toBe(false);
  });

  it('any_of admits on any branch', () => {
    const either: AdmissionRule = { kind: 'any_of', rules: [list, domain] };
    expect(admits(either, listed)).toBe(true);
    expect(admits(either, insead)).toBe(true);
    expect(admits(either, holder)).toBe(false);
  });

  it('admin approval and vouching are never self-served', () => {
    expect(admits({ kind: 'admin_approval' }, { ...insead, hasLink: true, emailHash: 'h1' })).toBe(false);
    expect(admits({ kind: 'member_vouch', vouchesRequired: 1 }, holder)).toBe(false);
  });
});

describe('normaliseEmail', () => {
  it('lowercases and trims, and refuses non-addresses', () => {
    expect(normaliseEmail('  Shun@Example.COM ')).toBe('shun@example.com');
    expect(normaliseEmail('nope')).toBeNull();
  });
});

describe('admissionSentence', () => {
  it('says how everyone got in', () => {
    expect(admissionSentence(domain)).toBe('Everyone here proved an @insead.edu or @alumni.insead.edu address.');
    expect(admissionSentence(list)).toBe("Everyone here was on the organiser's list.");
    expect(admissionSentence(link)).toBe('Anyone holding the link can join.');
    expect(admissionSentence({ kind: 'any_of', rules: [list, domain] })).toBe(
      "Everyone here was on the organiser's list, or proved an @insead.edu or @alumni.insead.edu address.",
    );
  });
});
