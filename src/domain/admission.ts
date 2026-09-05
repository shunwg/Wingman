import type { AdmissionRule } from './circle';

/**
 * Who gets into a circle, decided in one place.
 *
 * A circle is worth exactly as much as its admission rule, so the rule is
 * evaluated here and nowhere else — the join screen, the organiser's screen
 * and the tests all ask the same function. Proof is what the person has
 * already shown: verified domains from their stamps, the salted hash of an
 * address they just proved, whether they arrived holding the link.
 */
export interface AdmissionProof {
  /** Domains from active email-domain stamps, any case. */
  verifiedDomains: string[];
  /** Salted SHA-256 of an address the person just verified, for list circles. */
  emailHash?: string;
  /** They opened the invitation link. */
  hasLink?: boolean;
}

export function admits(rule: AdmissionRule, proof: AdmissionProof): boolean {
  switch (rule.kind) {
    case 'email_domain': {
      const held = new Set(proof.verifiedDomains.map((d) => d.toLowerCase()));
      return rule.domains.some((d) => held.has(d.toLowerCase()));
    }
    case 'invite_list':
      return proof.emailHash !== undefined && rule.emailHashes.includes(proof.emailHash);
    case 'invite_code':
      return proof.hasLink === true;
    case 'any_of':
      return rule.rules.some((r) => admits(r, proof));
    // Someone else decides. Nothing a person holds can self-serve these.
    case 'admin_approval':
    case 'member_vouch':
      return false;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lowercased and trimmed, or null when it is not an address at all. */
export function normaliseEmail(s: string): string | null {
  const v = s.trim().toLowerCase();
  return EMAIL.test(v) ? v : null;
}

/**
 * The product sentence: how everyone in here got in.
 *
 * Written once so the circle's home, the invitation and the badge tooltip
 * cannot drift. `any_of` joins its branches with "or".
 */
export function admissionSentence(rule: AdmissionRule): string {
  return `${clause(rule, true)}.`;
}

function clause(rule: AdmissionRule, first: boolean): string {
  const who = first ? 'Everyone here ' : '';
  switch (rule.kind) {
    case 'email_domain':
      return `${who}proved an ${rule.domains.map((d) => `@${d.toLowerCase()}`).join(' or ')} address`;
    case 'invite_list':
      return `${who}was on the organiser's list`;
    case 'invite_code':
      return first ? 'Anyone holding the link can join' : 'holds the link';
    case 'admin_approval':
      return first ? 'The organiser approves each person' : 'was approved by the organiser';
    case 'member_vouch':
      return first ? 'A member vouched for everyone here' : 'was vouched for by a member';
    case 'any_of': {
      const [head, ...rest] = rule.rules;
      if (!head) return first ? 'Nobody can join yet' : 'cannot join';
      return [clause(head, first), ...rest.map((r) => clause(r, false))].join(', or ');
    }
  }
}
