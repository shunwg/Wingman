import type {
  CircleMembership,
  Gender,
  IntentProfile,
  MeetKind,
  Person,
  PrivacyPresetId,
  SocialLink,
  StampKind,
  TagId,
  VerificationRecord,
} from '@domain/index';
import { normaliseTag } from '@domain/tags';
import { asCircleId, asPersonId, asVerificationId } from '@domain/ids';
import { asUtc } from '@domain/time';
import { generateAvatar } from '@design/avatar/generate';
import { defaultPolicy } from '@privacy/index';
import { photoFor } from './photos';

/**
 * The seeded population.
 *
 * Written as compact descriptors rather than full objects, so the interesting
 * part — who is open to what, who has proved what, who has locked themselves
 * down — stays readable in one screen. The expansion below is mechanical.
 *
 * These people exist to exercise the engines honestly, so the set deliberately
 * includes the awkward cases: someone women-only, someone ID-verified-only,
 * someone who only wants professional meets, someone with nothing verified at
 * all, and someone in a members-only employer circle. A seed set where
 * everybody matches everybody proves nothing.
 */

type Stamp = 'bankid' | 'linkedin' | 'instagram' | 'facebook' | 'work_email';

interface Seed {
  id: string;
  name: string;
  first: string;
  gender: Gender;
  pronouns?: string;
  headline: string;
  bio: string;
  title: string;
  company: string;
  industry: string;
  workingOn: string;
  lookingFor: string[];
  topics: string[];
  languages: string[];
  /** Hand-written; the characterful half. Interests derive from topics. */
  seeking?: string[];
  offering?: string[];
  social: number;
  professional: number;
  openTo: MeetKind[];
  stamps: Stamp[];
  handles?: Partial<Record<'linkedin' | 'instagram' | 'facebook', string>>;
  circles?: { id: string; display: CircleMembership['display']; badgeIds?: string[] }[];
  presets?: PrivacyPresetId[];
  meets: number;
  reliability: 'reliable' | 'mixed' | 'unproven';
}

const SEEDS: Seed[] = [
  {
    id: 'mira',
    name: 'Mira Lindqvist',
    first: 'Mira',
    gender: 'woman',
    pronouns: 'she/her',
    headline: 'Back from a design sprint. Quiet flight, good coffee after.',
    bio: 'Stockholm-based, in Asia most quarters. I ask too many questions about how things are made.',
    title: 'Principal designer',
    company: 'Fältet Studio',
    industry: 'Product design',
    workingOn: 'Interfaces for grid operators who hate interfaces',
    lookingFor: ['a researcher who has done fieldwork in utilities'],
    topics: ['design', 'energy', 'typography'],
    languages: ['sv', 'en'],
    social: 0.7,
    professional: 0.8,
    openTo: ['gate_coffee', 'meal', 'business_intro', 'lounge'],
    stamps: ['bankid', 'linkedin'],
    handles: { linkedin: 'miralindqvist' },
    circles: [{ id: 'gridweek', display: 'show_badge', badgeIds: ['speaker'] }],
    meets: 14,
    reliability: 'reliable',
  },
  {
    id: 'jonas',
    name: 'Jonas Okeke',
    first: 'Jonas',
    gender: 'man',
    pronouns: 'he/him',
    headline: 'Grid engineer. Will talk about interconnectors for far too long.',
    bio: 'Oslo-based, Singapore most months. Happy to be the person who explains the boring part.',
    title: 'Principal engineer',
    company: 'Northwind Grid',
    industry: 'Energy',
    workingOn: 'Cross-border capacity models',
    lookingFor: ['a plant engineer to hire', 'anyone who has permitted a subsea cable'],
    topics: ['energy', 'cities', 'cycling'],
    languages: ['en', 'no'],
    social: 0.5,
    professional: 0.9,
    openTo: ['gate_coffee', 'business_intro', 'meal', 'coworking'],
    stamps: ['bankid', 'linkedin', 'work_email'],
    handles: { linkedin: 'jonasokeke' },
    circles: [
      { id: 'insead', display: 'show_badge' },
      // Uses the employer circle for matching but keeps it off the card —
      // the opt-in the brief asks for, exercised by default in the seed.
      { id: 'northwind', display: 'match_only' },
    ],
    meets: 31,
    reliability: 'reliable',
  },
  {
    id: 'ayla',
    name: 'Ayla Demir',
    first: 'Ayla',
    gender: 'woman',
    pronouns: 'she/her',
    headline: 'First time through Changi. Open to a coffee before the red-eye.',
    bio: 'Architect, mostly housing. I will photograph your airport ceiling.',
    title: 'Associate',
    company: 'Ola Studio',
    industry: 'Architecture',
    workingOn: 'A social housing scheme in İzmir',
    lookingFor: ['structural engineers who like timber'],
    topics: ['architecture', 'photography', 'cities'],
    languages: ['tr', 'en'],
    social: 0.8,
    professional: 0.5,
    openTo: ['gate_coffee', 'meal', 'drinks', 'terminal_walk'],
    stamps: [],
    meets: 1,
    reliability: 'unproven',
  },
  {
    id: 'nina',
    name: 'Nina Halvorsen',
    first: 'Nina',
    gender: 'woman',
    pronouns: 'she/her',
    headline: 'Travelling alone a lot this year. Women only, and I mean it.',
    bio: 'Epidemiologist. Long flights are my reading time, but I like a proper dinner in a new city.',
    title: 'Senior epidemiologist',
    company: 'Meridian Health',
    industry: 'Public health',
    workingOn: 'Outbreak modelling across South-East Asia',
    lookingFor: ['data people who care about field logistics'],
    topics: ['public health', 'books', 'running'],
    languages: ['no', 'en'],
    social: 0.75,
    professional: 0.6,
    openTo: ['meal', 'drinks', 'gate_coffee'],
    stamps: ['bankid', 'linkedin'],
    handles: { linkedin: 'ninahalvorsen' },
    // Both halves of the rule, atomically — the whole point of a preset.
    presets: ['women_only'],
    meets: 9,
    reliability: 'reliable',
  },
  {
    id: 'tobias',
    name: 'Tobias Reuter',
    first: 'Tobias',
    gender: 'man',
    pronouns: 'he/him',
    headline: 'Here to work, not to socialise. Happy to make an introduction.',
    bio: 'Infrastructure fund. I read term sheets on planes so I do not have to at home.',
    title: 'Investment director',
    company: 'Halden Partners',
    industry: 'Infrastructure finance',
    workingOn: 'A Nordic storage platform',
    lookingFor: ['operators with a live pipeline'],
    topics: ['infrastructure', 'finance'],
    languages: ['de', 'en'],
    social: 0.1,
    professional: 0.95,
    openTo: ['business_intro', 'lounge', 'coworking'],
    stamps: ['bankid', 'linkedin', 'work_email'],
    handles: { linkedin: 'tobiasreuter' },
    circles: [{ id: 'insead', display: 'show_badge' }],
    presets: ['professional_only'],
    meets: 22,
    reliability: 'reliable',
  },
  {
    id: 'priya',
    name: 'Priya Raman',
    first: 'Priya',
    gender: 'woman',
    pronouns: 'she/her',
    headline: 'Long layover, no lounge access, excellent podcast recommendations.',
    bio: 'Climate journalist. I am probably filing something from the gate.',
    title: 'Correspondent',
    company: 'The Meridian',
    industry: 'Journalism',
    workingOn: 'A series on grid queues',
    lookingFor: ['engineers willing to be quoted'],
    topics: ['climate', 'writing', 'energy'],
    languages: ['ta', 'en', 'hi'],
    social: 0.85,
    professional: 0.7,
    openTo: ['gate_coffee', 'terminal_walk', 'meal', 'business_intro'],
    stamps: ['linkedin', 'instagram'],
    handles: { linkedin: 'priyaraman', instagram: 'priya.files' },
    meets: 6,
    reliability: 'mixed',
  },
  {
    id: 'lucas',
    name: 'Lucas Brandt',
    first: 'Lucas',
    gender: 'man',
    pronouns: 'he/him',
    headline: 'Same flight, apparently. I have the aisle and no strong opinions.',
    bio: 'Sound engineer. I will tell you the terminal announcements are too loud.',
    title: 'Live sound engineer',
    company: 'Freelance',
    industry: 'Music',
    workingOn: 'A tour that ends in Jakarta',
    lookingFor: ['a decent record shop in Singapore'],
    topics: ['music', 'audio', 'food'],
    languages: ['de', 'en'],
    social: 0.9,
    professional: 0.3,
    openTo: ['gate_coffee', 'drinks', 'meal', 'ride_share', 'terminal_walk'],
    stamps: ['instagram', 'facebook'],
    handles: { instagram: 'lucas.on.tour', facebook: 'lucasbrandt' },
    meets: 4,
    reliability: 'unproven',
  },
  {
    id: 'theo',
    name: 'Theo Lindholm',
    first: 'Theo',
    gender: 'nonbinary',
    pronouns: 'they/them',
    headline: 'In town for three days. Would rather cowork than sightsee.',
    bio: 'Backend, mostly payments. I find other people’s laptops calming.',
    title: 'Staff engineer',
    company: 'Tessellate',
    industry: 'Software',
    workingOn: 'Settlement infrastructure that nobody notices',
    lookingFor: ['someone who has scaled a ledger'],
    topics: ['software', 'payments', 'coffee'],
    languages: ['sv', 'en'],
    social: 0.4,
    professional: 0.85,
    openTo: ['coworking', 'business_intro', 'meal', 'gate_coffee'],
    stamps: ['linkedin', 'work_email'],
    handles: { linkedin: 'theolindholm' },
    meets: 11,
    reliability: 'reliable',
  },
  {
    id: 'sofia',
    name: 'Sofia Marchetti',
    first: 'Sofia',
    gender: 'woman',
    pronouns: 'she/her',
    headline: 'Only meeting people who have verified who they are. No offence.',
    bio: 'Ex-lawyer, now mediation. I have heard enough stories to be careful.',
    title: 'Mediator',
    company: 'Independent',
    industry: 'Law',
    workingOn: 'Cross-border commercial disputes',
    lookingFor: ['nothing in particular, honestly'],
    topics: ['law', 'opera', 'hiking'],
    languages: ['it', 'en', 'fr'],
    social: 0.6,
    professional: 0.55,
    openTo: ['meal', 'gate_coffee', 'business_intro'],
    stamps: ['bankid', 'linkedin'],
    handles: { linkedin: 'sofiamarchetti' },
    presets: ['id_verified_only'],
    meets: 17,
    reliability: 'reliable',
  },
  {
    id: 'omar',
    name: 'Omar Nasser',
    first: 'Omar',
    gender: 'man',
    pronouns: 'he/him',
    headline: 'Connecting through, two hours, different terminal. Realistic about it.',
    bio: 'Logistics. I know which airports lie about walking times.',
    title: 'Operations lead',
    company: 'Levant Freight',
    industry: 'Logistics',
    workingOn: 'Cold chain into the Gulf',
    lookingFor: ['a customs broker who answers the phone'],
    topics: ['logistics', 'football', 'maps'],
    languages: ['ar', 'en'],
    social: 0.65,
    professional: 0.7,
    openTo: ['gate_coffee', 'business_intro', 'lounge'],
    stamps: ['linkedin'],
    handles: { linkedin: 'omarnasser' },
    meets: 8,
    reliability: 'mixed',
  },
  {
    id: 'ingrid',
    name: 'Ingrid Solberg',
    first: 'Ingrid',
    gender: 'woman',
    pronouns: 'she/her',
    headline: 'Landing late, sharing a cab into town if anyone is going my way.',
    bio: 'Marine biologist. Currently smell faintly of a research vessel.',
    title: 'Research lead',
    company: 'Havforsk',
    industry: 'Marine science',
    workingOn: 'Kelp restoration along the Norwegian coast',
    lookingFor: ['funders who like slow science'],
    topics: ['oceans', 'climate', 'cooking'],
    languages: ['no', 'en'],
    social: 0.7,
    professional: 0.5,
    openTo: ['ride_share', 'meal', 'gate_coffee', 'drinks'],
    stamps: ['bankid', 'facebook'],
    handles: { facebook: 'ingridsolberg' },
    meets: 5,
    reliability: 'reliable',
  },
  {
    id: 'daniel',
    name: 'Daniel Achebe',
    first: 'Daniel',
    gender: 'man',
    pronouns: 'he/him',
    headline: 'Three days, no plans after six. Would like that to change.',
    bio: 'Teacher on sabbatical, spending it badly and happily.',
    title: 'Secondary teacher',
    company: 'Sabbatical',
    industry: 'Education',
    workingOn: 'Learning to cook everything I eat on this trip',
    lookingFor: ['the least touristy hawker centre'],
    topics: ['food', 'history', 'football'],
    languages: ['en'],
    social: 0.95,
    professional: 0.2,
    openTo: ['meal', 'drinks', 'terminal_walk', 'gate_coffee'],
    stamps: ['instagram'],
    handles: { instagram: 'danielcooks' },
    meets: 2,
    reliability: 'unproven',
  },
  {
    id: 'amelie',
    name: 'Amélie Rousseau',
    first: 'Amélie',
    gender: 'woman',
    pronouns: 'she/her',
    headline: 'INSEAD reunion week. I would rather meet one new person than ten old ones.',
    bio: 'Strategy, mostly energy clients. Reliably the last one to leave a dinner.',
    title: 'Partner',
    company: 'Rousseau & Aubert',
    industry: 'Strategy consulting',
    workingOn: 'Grid investment cases for utilities that move slowly',
    lookingFor: ['operators who will tell me what actually went wrong'],
    topics: ['energy', 'strategy', 'wine'],
    languages: ['fr', 'en'],
    social: 0.6,
    professional: 0.9,
    openTo: ['business_intro', 'meal', 'lounge', 'gate_coffee'],
    stamps: ['bankid', 'linkedin', 'work_email'],
    handles: { linkedin: 'amelierousseau' },
    circles: [{ id: 'insead', display: 'show_badge' }],
    meets: 19,
    reliability: 'reliable',
  },
  {
    id: 'elin',
    name: 'Elin Dahl',
    first: 'Elin',
    gender: 'woman',
    pronouns: 'she/her',
    headline: 'At Grid Week and I know nobody. Someone please have a coffee with me.',
    bio: 'Two years into power trading, still the youngest person in every room.',
    title: 'Analyst',
    company: 'Nordkraft',
    industry: 'Energy trading',
    workingOn: 'Intraday strategies nobody will let me deploy yet',
    lookingFor: ['anyone who has been doing this longer than me'],
    topics: ['energy', 'markets', 'climbing'],
    languages: ['no', 'en'],
    social: 0.85,
    professional: 0.8,
    openTo: ['gate_coffee', 'meal', 'business_intro', 'terminal_walk'],
    // Only a social stamp: she is exactly who an assurance floor excludes, and
    // the board should feel that trade-off rather than hide it.
    stamps: ['linkedin'],
    handles: { linkedin: 'elindahl' },
    circles: [{ id: 'gridweek', display: 'show_badge' }],
    meets: 1,
    reliability: 'unproven',
  },
  {
    id: 'hugo',
    name: 'Hugo Ferreira',
    first: 'Hugo',
    gender: 'man',
    pronouns: 'he/him',
    headline: 'Nine hours in transit. I have read everything I brought.',
    bio: 'Photographer. Currently between an assignment and a very long bus ride.',
    title: 'Photographer',
    company: 'Freelance',
    industry: 'Media',
    workingOn: 'A series on night shifts',
    lookingFor: ['someone who works while everyone else sleeps'],
    topics: ['photography', 'music', 'food'],
    languages: ['pt', 'es', 'en'],
    social: 0.9,
    professional: 0.25,
    openTo: ['gate_coffee', 'terminal_walk', 'meal', 'drinks'],
    // Nothing government-issued. Sofia's id_verified_only filter must remove
    // him, and the suppression count must say so without naming him.
    stamps: ['instagram', 'facebook'],
    handles: { instagram: 'hugo.after.dark', facebook: 'hugoferreira' },
    meets: 3,
    reliability: 'mixed',
  },
  {
    id: 'marek',
    name: 'Marek Nowak',
    first: 'Marek',
    gender: 'man',
    pronouns: 'he/him',
    headline: 'Here for a week. Looking for a desk and someone to complain about it with.',
    bio: 'Reliability engineering. I am the reason your dashboard went quiet at 3am.',
    title: 'Staff SRE',
    company: 'Northwind Grid',
    industry: 'Software',
    workingOn: 'Making an alerting system that people do not mute',
    lookingFor: ['anyone who has run an on-call rota that did not burn people out'],
    topics: ['software', 'reliability', 'cycling'],
    languages: ['pl', 'en'],
    social: 0.35,
    professional: 0.8,
    openTo: ['coworking', 'gate_coffee', 'business_intro', 'meal'],
    stamps: ['bankid', 'linkedin', 'work_email'],
    handles: { linkedin: 'mareknowak' },
    // Second person using an employer circle for matching with the badge off,
    // so the match_only path is exercised by more than one row.
    circles: [{ id: 'northwind', display: 'match_only' }],
    meets: 13,
    reliability: 'reliable',
  },
];

/* ── Expansion ───────────────────────────────────────────────────────────── */

const STAMP_SPEC: Record<Stamp, { provider: string; kind: StampKind; assurance: 0 | 1 | 2 | 3 }> = {
  bankid: { provider: 'bankid_no', kind: 'government_eid', assurance: 3 },
  work_email: { provider: 'email_otp', kind: 'email_domain', assurance: 2 },
  linkedin: { provider: 'linkedin', kind: 'social_account', assurance: 1 },
  instagram: { provider: 'instagram', kind: 'social_account', assurance: 1 },
  facebook: { provider: 'facebook', kind: 'social_account', assurance: 1 },
};

function verifications(s: Seed): VerificationRecord[] {
  return s.stamps.map((stamp) => {
    const spec = STAMP_SPEC[stamp];
    const handle =
      stamp === 'linkedin' || stamp === 'instagram' || stamp === 'facebook'
        ? s.handles?.[stamp]
        : undefined;
    return {
      id: asVerificationId(`v_${s.id}_${stamp}`),
      personId: asPersonId(s.id),
      providerId: spec.provider,
      kind: spec.kind,
      assurance: spec.assurance,
      verifiedAt: asUtc('2026-06-01T09:00:00Z'),
      ...(handle || stamp === 'work_email'
        ? {
            evidence: {
              ...(handle ? { handle } : {}),
              ...(stamp === 'work_email' ? { domain: 'northwindgrid.com' } : {}),
            },
          }
        : {}),
    };
  });
}

function links(s: Seed): SocialLink[] {
  const out: SocialLink[] = [];
  const verified = new Set(s.stamps);
  for (const network of ['linkedin', 'instagram', 'facebook'] as const) {
    const handle = s.handles?.[network];
    if (!handle) continue;
    out.push({
      network,
      handle,
      url: `https://${network}.com/${network === 'linkedin' ? 'in/' : ''}${handle}`,
      verified: verified.has(network),
      // LinkedIn is the one people hand over readily; the personal accounts
      // wait until a meet is actually happening. That default matters more
      // than any setting, because most people never change a default.
      visibility: network === 'linkedin' ? 'on_accept' : 'on_meet',
    });
  }
  return out;
}

function memberships(s: Seed): CircleMembership[] {
  return (s.circles ?? []).map((c) => ({
    circleId: asCircleId(c.id),
    personId: asPersonId(s.id),
    display: c.display,
    joinedAt: asUtc('2026-03-01T09:00:00Z'),
    admittedBy: 'email_domain' as const,
    role: 'member' as const,
    ...(c.badgeIds ? { badgeIds: c.badgeIds } : {}),
  }));
}

/** Free text → vocabulary, dropping anything that does not resolve. */
const toTags = (free: readonly string[] = []): TagId[] =>
  free.map(normaliseTag).filter((x): x is TagId => x !== undefined);

function intent(s: Seed): IntentProfile {
  return {
    appetite: { social: s.social, professional: s.professional },
    openTo: s.openTo,
    topics: s.topics,
    languages: s.languages,
    // Interests are the topics, resolved; a topic outside the vocabulary
    // stays in `topics` and still counts as an exact-match bonus.
    interests: toTags(s.topics),
    seeking: toTags(s.seeking),
    offering: toTags(s.offering),
    openToAnyone: false,
  };
}

/**
 * The generated portrait is built for everyone, photograph or not.
 *
 * It costs nothing, it keeps the palette available for the card's background
 * tint, and it is what renders if the image ever fails to load. A photograph
 * is an addition to the spec, never a replacement for it.
 */
function portrait(id: string) {
  const generated = generateAvatar(id);
  const photo = photoFor(id);
  return photo ? { ...generated, photoUrl: photo } : generated;
}

function expand(s: Seed): Person {
  const id = asPersonId(s.id);
  const privacy = defaultPolicy();
  if (s.presets) privacy.presets = s.presets;

  return {
    id,
    displayName: s.name,
    firstName: s.first,
    gender: s.gender,
    ...(s.pronouns ? { pronouns: s.pronouns } : {}),
    headline: s.headline,
    bio: s.bio,
    avatar: portrait(s.id),
    professional: {
      title: s.title,
      company: s.company,
      industry: s.industry,
      workingOn: s.workingOn,
      lookingFor: s.lookingFor,
    },
    intent: intent(s),
    links: links(s),
    verifications: verifications(s),
    memberships: memberships(s),
    privacy,
    reputation: {
      reliability: s.reliability,
      meetsCompleted: s.meets,
      // Below five meets there is not enough signal to say anything, and
      // saying it anyway would brand people for one bad night.
      hasEnoughSignal: s.meets >= 5,
    },
    blocked: [],
    createdAt: asUtc('2026-01-15T09:00:00Z'),
  };
}

export const SEED_PEOPLE: Person[] = SEEDS.map(expand);

export const personById = (id: string): Person | undefined =>
  SEED_PEOPLE.find((p) => p.id === id);

/** Circle ids per person, as the matching engine wants them. */
export const circleIdsFor = (id: string): string[] =>
  personById(id)?.memberships.map((m) => String(m.circleId)) ?? [];

/** Response rates — conduct, and the only historical signal that ranks. */
export const RESPONSE_RATES: Record<string, number> = {
  mira: 0.82,
  jonas: 0.91,
  ayla: 0.5,
  nina: 0.74,
  tobias: 0.88,
  priya: 0.61,
  lucas: 0.45,
  theo: 0.79,
  sofia: 0.86,
  omar: 0.58,
  ingrid: 0.77,
  daniel: 0.4,
  amelie: 0.84,
  // New, and keen. A high rate here is not a reward for being new — it is what
  // "answers her messages" actually looks like, and it is the only conduct
  // signal the ranker is allowed to read.
  elin: 0.93,
  hugo: 0.55,
  marek: 0.8,
};
