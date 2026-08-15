import type { PublicStamp, RedactedPerson } from '@domain/index';
import { asPersonId } from '@domain/ids';
import { generateAvatar } from '../avatar/generate';

/**
 * Frozen props for the gallery.
 *
 * Fixed rather than generated at render time, so a visual-regression screenshot
 * changes only when the design changes. A gallery that reshuffles on every run
 * produces diffs nobody can review, and reviewers stop looking.
 */

const stamp = (
  kind: PublicStamp['kind'],
  label: string,
  tone: 'trust' | 'social',
  handle?: string,
): PublicStamp => ({
  kind,
  display: {
    label,
    iconKey: kind,
    tone,
    explainer:
      kind === 'government_eid'
        ? 'Their legal identity has been checked with BankID.'
        : 'They proved they control this account.',
    publicLabel: label,
  },
  ...(handle ? { handle } : {}),
});

const person = (
  seed: string,
  fields: Partial<RedactedPerson> & { _level: RedactedPerson['_level'] },
): RedactedPerson => ({
  id: asPersonId(seed),
  avatar: generateAvatar(seed),
  displayName: { __redacted: true, reason: 'not_yet_accepted' },
  headline: { __redacted: true, reason: 'not_yet_accepted' },
  bio: { __redacted: true, reason: 'not_yet_accepted' },
  links: [],
  stamps: [],
  circles: [],
  reputation: { __redacted: true, reason: 'subject_choice' },
  professional: { __redacted: true, reason: 'not_yet_accepted' },
  _appliedRules: [],
  ...fields,
});

/** Rung 0 — what a stranger browsing the board actually sees. */
export const strangerCard = person('maya-lindqvist', {
  _level: 0,
  headline: 'Back from a design sprint. Quiet flight, good coffee after.',
  professional: { industry: 'Product design' },
  stamps: [stamp('government_eid', 'ID verified', 'trust'), stamp('social_account', 'LinkedIn', 'social')],
  reputation: { reliability: 'reliable', activityLabel: 'meets regularly' },
});

/** Rung 2 — after both sides have agreed to meet. */
export const acceptedCard = person('jonas-okeke', {
  _level: 2,
  displayName: 'Jonas Okeke',
  headline: 'Grid engineer. Will talk about interconnectors for far too long.',
  bio: 'Oslo-based, in Singapore most months.',
  professional: {
    title: 'Principal engineer',
    company: 'Northwind Grid',
    industry: 'Energy',
    workingOn: 'Cross-border capacity models',
    lookingFor: ['a plant engineer to hire'],
  },
  stamps: [
    stamp('government_eid', 'ID verified', 'trust'),
    stamp('social_account', 'LinkedIn', 'social', '@jonasokeke'),
    stamp('email_domain', 'Work email', 'social'),
  ],
  circles: [
    { circleId: 'insead' as never, shortName: 'INSEAD', crestSeed: 'insead', kind: 'school' },
  ],
  reputation: { reliability: 'reliable', activityLabel: 'meets often' },
});

/** Someone new, with nothing proved yet — the honest low-signal state. */
export const unprovenCard = person('amara-sesay', {
  _level: 0,
  headline: 'First time through Changi. Open to a coffee before the red-eye.',
  professional: { industry: 'Architecture' },
});

export const galleryPeople = [strangerCard, acceptedCard, unprovenCard];

/** Seeds for the portrait wall — fixed so the screenshot is stable. */
export const faceSeeds = Array.from({ length: 24 }, (_, i) => `gallery-face-${i}`);

export const TOKEN_SWATCHES = [
  { name: '--canvas', role: 'Page ground' },
  { name: '--surface', role: 'Cards' },
  { name: '--surface-sunk', role: 'Wells, chips' },
  { name: '--hairline', role: 'Borders' },
  { name: '--ink', role: 'Primary text' },
  { name: '--muted', role: 'Secondary text' },
  { name: '--accent', role: 'Ember — the one warm signal' },
  { name: '--trust', role: 'Verification only' },
  { name: '--guard', role: 'Guardian and safety only' },
  { name: '--warn', role: 'Caution' },
];
