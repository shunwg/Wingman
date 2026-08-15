import type {
  AssuranceLevel,
  AudienceRule,
  CircleId,
  DisclosureLevel,
  Gender,
  IntentAxis,
  ISODateTime,
  PersonId,
  PolicyReason,
  PolicyRuleId,
  PrivacyPolicy,
  ProximityClass,
  RedactedPerson,
  StampKind,
} from '@domain/index';

/**
 * The facts a rule is allowed to see about a person.
 *
 * Deliberately narrow. A rule gets facets, never a `Person`, which means no
 * privacy rule can be written in terms of someone's name, photo, bio or
 * reputation even by accident — and it makes the audience report possible,
 * because a *synthetic* facet tuple is indistinguishable from a real person's
 * as far as the rules are concerned.
 */
export interface PersonFacets {
  id: PersonId;
  gender: Gender;
  /** Highest assurance across verified, unexpired stamps. */
  assurance: AssuranceLevel;
  stampKinds: StampKind[];
  circleIds: CircleId[];
  /** Which axes this person has any appetite for. */
  intents: IntentAxis[];
  /** Who this person has blocked. */
  blocked: PersonId[];
  /**
   * How close the two people currently are, in travel terms.
   *
   * This describes the **pair**, not the person, so both sides of a visibility
   * question carry the same value. The surface rule reads it from the *viewer*
   * — "how close is this person to me" — which is also what makes an audience
   * segment like "women on your flight" expressible.
   */
  proximity: ProximityClass;
  /** How this viewer is reaching the subject at all. */
  channel: ViewerChannel;
  /** False when the person has no listed trip covering `now`. */
  onTrip: boolean;
}

/**
 * Not every viewer is another user.
 *
 * A guardian holding a live share token can see things, and so can a circle
 * admin. An audience report that counts only app users is a lie, so these are
 * modelled as first-class channels rather than exceptions.
 */
export type ViewerChannel = 'app' | 'guardian_link' | 'circle_admin';

/** A person plus their compiled policy — one side of a visibility question. */
export interface PolicySubject {
  facets: PersonFacets;
  policy: CompiledPolicy;
}

export interface VisibilityContext {
  now: ISODateTime;
  /** Existing relationship, which sets how far up the ladder they can get. */
  relationship?: Relationship;
}

export type Relationship =
  | 'stranger'
  | 'requested'   // a request exists in either direction
  | 'accepted'    // a request was accepted
  | 'meeting';    // a meet is scheduled or live

export type RuleOutcome = 'allow' | 'deny' | 'abstain';

/**
 * A rule.
 *
 * Rules are data, held in an ordered registry, each carrying the id and copy
 * key needed to explain itself. That is what lets the audience screen name a
 * reason for every blocked segment without a single hand-written conditional
 * in the UI, and what makes the empty state able to say *why* honestly.
 */
export interface PolicyRule {
  id: PolicyRuleId;
  /** `audience` governs who may see me; `seeking` governs who I want to see. */
  side: 'audience' | 'seeking';
  evaluate(viewer: PersonFacets, subject: PersonFacets, ctx: RuleContext): RuleOutcome;
  /** Key into data/copy/privacy.ts. */
  copyKey: string;
  /** Some rules cap how far up the ladder a viewer may climb rather than deny. */
  levelCap?: DisclosureLevel;
}

/** What a rule is given alongside the two facet sets. */
export interface RuleContext {
  /** The rule set belonging to whoever's policy is being applied. */
  rule: AudienceRule;
  policy: CompiledPolicy;
  now: ISODateTime;
}

export interface CompiledPolicy {
  source: PrivacyPolicy;
  audience: AudienceRule;
  seeking: AudienceRule;
  /** Which facets any active rule reads, either side. */
  referencedFacets: ReferencedFacet[];
  /**
   * Facets read by the **audience** side alone.
   *
   * The audience report asks "who can see me", which is purely an audience-rule
   * question — my own `seeking` rule filters my feed, not their view of me.
   * Partitioning on seeking-only facets would split rows that are provably
   * identical and show the user distinctions that do not exist.
   */
  audienceFacets: ReferencedFacet[];
  /** Preset ids that produced this, for explaining the policy back to its owner. */
  presets: PrivacyPolicy['presets'];
}

export type ReferencedFacet =
  | 'gender'
  | 'assurance'
  | 'stampKinds'
  | 'circleIds'
  | 'intents'
  | 'proximity'
  | 'channel';

export interface VisibilityVerdict {
  visible: boolean;
  level: DisclosureLevel;
  deniedBy: PolicyRuleId[];
  reasons: PolicyReason[];
}

export interface MutualVerdict {
  aSeesB: VisibilityVerdict;
  bSeesA: VisibilityVerdict;
  /** INVARIANT: mutual === aSeesB.visible && bSeesA.visible */
  mutual: boolean;
  /** INVARIANT: level === min(aSeesB.level, bSeesA.level) */
  level: DisclosureLevel;
}

/* ── Audience report ─────────────────────────────────────────────────────── */

/**
 * A facet tuple standing in for a slice of the potential-viewer population.
 * `'*'` means "the policy does not read this facet", which is what collapses an
 * unbounded population into a few dozen rows.
 */
export interface SegmentFacets {
  gender: Gender | '*';
  assurance: AssuranceLevel | '*';
  stampKinds: StampKind[] | '*';
  circleIds: CircleId[] | '*';
  intents: IntentAxis[] | '*';
  proximity: ProximityClass;
  channel: ViewerChannel;
}

export interface ViewerSegment {
  /** Stable hash of the facet tuple. */
  id: string;
  /** e.g. "Women · ID-verified · on your OSL–SIN flight" */
  label: string;
  facets: SegmentFacets;
  estimatedSize: number;
}

export interface AudienceSegmentVerdict {
  segment: ViewerSegment;
  visible: boolean;
  level: DisclosureLevel;
  visibleFields: (keyof RedactedPerson)[];
  deniedBy: PolicyRuleId[];
  reasons: PolicyReason[];
  estimatedSize: number;
}

/** Per-field exposure — which segments see this field, and at what rung. */
export interface FieldExposure {
  field: keyof RedactedPerson;
  label: string;
  /** Segments that can see it, by id. */
  seenBy: string[];
  /** Total estimated people who can see it. Bucket before rendering. */
  estimatedReach: number;
}

/**
 * A live exposure the user has right now, phrased concretely.
 * "You are visible in Changi Terminal 3 until 14:20."
 */
export interface LiveContext {
  kind: 'flight' | 'terminal' | 'city' | 'guardian';
  label: string;
  until?: ISODateTime;
}

export interface AudienceReport {
  generatedAt: ISODateTime;
  /** Estimated people who can see you at all. Bucket before rendering. */
  visibleTotal: number;
  populationTotal: number;
  segments: AudienceSegmentVerdict[];
  fields: FieldExposure[];
  liveContexts: LiveContext[];
  /** True when the lattice had to be coarsened to stay under the cap. */
  coarsened: boolean;
}
