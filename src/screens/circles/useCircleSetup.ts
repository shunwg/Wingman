import { useState } from 'react';
import type { AdmissionRule, Circle, CircleBadge } from '@domain/index';
import { asCircleId, asISODate, asUtc, normaliseEmail } from '@domain/index';
import { useStore } from '@state/store';
import { hashEmail, newSalt } from './hash';

/**
 * Opening a circle, in three decisions.
 *
 *  1. What it is: a name, a kind, dates if it is an event, a mark.
 *  2. Who gets in — the decision the whole circle is worth. Email endings, a
 *     pasted list, a link, or a list *and* endings. A pasted list becomes
 *     salted hashes before it reaches the store; the addresses are dropped.
 *  3. Badges: the roles a member can be found as.
 */

export type SetupStep = 0 | 1 | 2;
export type AdmissionMode = 'domain' | 'list' | 'link';

export interface SetupDraft {
  name: string;
  kind: Circle['kind'];
  from: string;
  to: string;
  crestUrl?: string;
  mode: AdmissionMode;
  domains: string[];
  domainInput: string;
  listText: string;
  alsoDomains: boolean;
  badges: (CircleBadge & { on: boolean })[];
}

export const DEFAULT_BADGES: CircleBadge[] = [
  { id: 'organiser', label: 'Organiser', tone: 'guard' },
  { id: 'speaker', label: 'Speaker', tone: 'accent' },
  { id: 'sponsor', label: 'Sponsor', tone: 'neutral' },
];

const DOMAIN = /^[^\s@]+\.[^\s@]{2,}$/;

/** The pasted list, parsed: unique valid addresses, and how many were dropped. */
export function parseList(text: string): { emails: string[]; dropped: number; duplicates: number } {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const seen = new Set<string>();
  let dropped = 0;
  let duplicates = 0;
  for (const t of tokens) {
    const e = normaliseEmail(t);
    if (!e) {
      dropped++;
      continue;
    }
    if (seen.has(e)) {
      duplicates++;
      continue;
    }
    seen.add(e);
  }
  return { emails: [...seen], dropped, duplicates };
}

export function slugFor(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
}

export function useCircleSetup() {
  const createCircle = useStore((s) => s.createCircle);
  const now = useStore((s) => s.now);
  const myCircles = useStore((s) => s.myCircles);

  const [step, setStep] = useState<SetupStep>(0);
  const [draft, setDraft] = useState<SetupDraft>({
    name: '',
    kind: 'conference',
    from: '',
    to: '',
    mode: 'list',
    domains: [],
    domainInput: '',
    listText: '',
    alsoDomains: false,
    badges: DEFAULT_BADGES.map((b) => ({ ...b, on: true })),
  });
  const [created, setCreated] = useState<Circle | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof SetupDraft>(k: K, v: SetupDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const addDomain = () => {
    const d = draft.domainInput.trim().toLowerCase().replace(/^@/, '');
    if (!DOMAIN.test(d) || draft.domains.includes(d)) return;
    setDraft((x) => ({ ...x, domains: [...x.domains, d], domainInput: '' }));
  };
  const removeDomain = (d: string) =>
    setDraft((x) => ({ ...x, domains: x.domains.filter((y) => y !== d) }));

  const list = parseList(draft.listText);
  const usesDomains = draft.mode === 'domain' || (draft.mode === 'list' && draft.alsoDomains);
  const usesList = draft.mode === 'list';

  const step1Ok = draft.name.trim().length >= 2;
  const step2Ok =
    (draft.mode === 'link') ||
    (draft.mode === 'domain' && draft.domains.length > 0) ||
    (draft.mode === 'list' && list.emails.length > 0 && (!draft.alsoDomains || draft.domains.length > 0));

  const finish = async (): Promise<Circle> => {
    setBusy(true);
    try {
      const salt = newSalt();
      const parts: AdmissionRule[] = [];
      if (usesList) {
        const emailHashes = await Promise.all(list.emails.map((e) => hashEmail(e, salt)));
        parts.push({ kind: 'invite_list', emailHashes, salt });
      }
      if (usesDomains) parts.push({ kind: 'email_domain', domains: draft.domains });
      if (draft.mode === 'link') parts.push({ kind: 'invite_code' });
      const admission: AdmissionRule = parts.length === 1 ? parts[0]! : { kind: 'any_of', rules: parts };

      const base = slugFor(draft.name) || 'circle';
      const taken = new Set(myCircles.map((c) => String(c.id)));
      let id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

      const timeBoxed = draft.kind === 'conference' && draft.from && draft.to;
      const badges = draft.badges.filter((b) => b.on).map(({ on: _on, ...b }) => b);
      const circle: Circle = {
        id: asCircleId(id),
        name: draft.name.trim(),
        shortName: draft.name.trim().split(/\s+/).slice(0, 2).join(' '),
        kind: draft.kind,
        admission,
        crestSeed: `${id}-crest`,
        ...(draft.crestUrl ? { crestUrl: draft.crestUrl } : {}),
        ...(badges.length > 0 ? { badges } : {}),
        membersOnly: draft.kind === 'employer',
        memberCount: 1,
        ...(timeBoxed ? { runs: { from: asISODate(draft.from), to: asISODate(draft.to) } } : {}),
        createdAt: asUtc(String(now)),
      };
      createCircle(circle);
      setCreated(circle);
      return circle;
    } finally {
      setBusy(false);
    }
  };

  return {
    step,
    setStep,
    draft,
    set,
    addDomain,
    removeDomain,
    list,
    usesDomains,
    step1Ok,
    step2Ok,
    finish,
    created,
    busy,
  };
}
