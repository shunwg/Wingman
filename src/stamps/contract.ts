import type {
  AssuranceLevel,
  ISODateTime,
  PersonId,
  StampDisplay,
  StampKind,
  VerificationRecord,
} from '@domain/index';

/**
 * The provider contract.
 *
 * Adding a way to prove who you are should be one file plus one registry line,
 * with zero screen edits. Two things make that true:
 *
 *  1. **Providers describe, they do not act.** `stamps/` compiles under the
 *     no-DOM tsconfig, so a provider cannot open a window, cannot fetch, and
 *     cannot read a clock. `begin()` returns a *description* of the challenge —
 *     a URL to open, a field to fill, an interval to poll — and the screen
 *     carries it out. `complete()` receives whatever came back and decides
 *     whether it counts. All of it is a pure function, so the whole matrix of
 *     providers × outcomes is testable in plain Node.
 *
 *  2. **There are exactly four challenge shapes**, and screens render shapes
 *     rather than providers. A screen that switched on `providerId` would need
 *     editing for every new provider, so an ESLint rule bans provider-id string
 *     literals under `screens/**`.
 *
 * What a provider must never put in a `VerificationRecord`: a token, a national
 * identity number, a date of birth. The record is proof that something was
 * checked, not a copy of what was checked.
 */

export type ChallengeMode =
  /** Hand off to an OAuth consent page and come back. LinkedIn, Google, Meta. */
  | 'redirect'
  /** Open a native app by URL scheme, then wait. BankID on the same device. */
  | 'deeplink'
  /** Show a reference or QR and wait for it to be confirmed elsewhere. */
  | 'polling'
  /** Ask for something the person can type: an address, a handle, a code. */
  | 'input';

/**
 * What the environment offers.
 *
 * `configured` lists provider ids that have real credentials. It carries ids,
 * never the keys themselves — a secret has no business crossing into an engine,
 * and this way the purity gate keeps it out by construction.
 */
export interface StampEnv {
  configured: readonly string[];
  /** Mock providers stand in wherever a real one is unconfigured. */
  allowMocks: boolean;
  /** A deeplink is only worth offering where an app can answer it. */
  platform: 'mobile' | 'desktop';
}

export interface BeginInput {
  personId: PersonId;
  now: ISODateTime;
  /**
   * Supplied, not generated. Engines may not call `Math.random()`, and an
   * injected id also means a test can assert on an exact challenge.
   */
  sessionId: string;
  /** Where an OAuth provider should send the person back to. */
  returnUrl?: string;
}

/** A field the person fills in, with the rule that validates it. */
export interface InputPrompt {
  label: string;
  placeholder: string;
  hint: string;
  kind: 'handle' | 'email' | 'code';
  /** Lives here so no screen re-implements the rule and drifts from it. */
  validate(value: string): { ok: true } | { ok: false; message: string };
}

export interface StampChallenge {
  mode: ChallengeMode;
  providerId: string;
  sessionId: string;
  expiresAt: ISODateTime;
  /** `redirect` and `deeplink`. */
  url?: string;
  /** `polling` — a human-readable reference to compare against, as BankID does. */
  reference?: string;
  /** `input`. */
  prompt?: InputPrompt;
  /** `deeplink` and `polling`. */
  poll?: { everyMs: number; timeoutMs: number };
  /** What the person is told while this is in flight. */
  waitingCopy: string;
}

export type PollState =
  | { status: 'pending' }
  | { status: 'ready'; evidence?: VerificationRecord['evidence'] }
  | { status: 'expired' }
  | { status: 'failed'; reason: string };

export interface CompleteInput {
  challenge: StampChallenge;
  personId: PersonId;
  now: ISODateTime;
  /** Deterministic id for the record. Injected, for the same reason as sessionId. */
  recordId: string;
  /** `input` — what they typed. `redirect` — the code the provider returned. */
  answer?: string;
  /** `polling` and `deeplink` — the terminal state the screen observed. */
  polled?: PollState;
}

export type StampResult =
  | { ok: true; record: VerificationRecord }
  | { ok: false; error: string };

export interface StampProvider {
  id: string;
  kind: StampKind;
  assurance: AssuranceLevel;
  display: StampDisplay;
  /**
   * What connecting it buys you — a different question from what it proves,
   * and the one people actually decide on.
   *
   * It lives on the provider rather than in the screen so adding a provider
   * stays a zero-screen-edit change, and it is separate from `display` because
   * `display` is what a *viewer* sees on someone else's card. A viewer has no
   * use for the pitch. A verification asked for without a stated reason is the
   * most common place a good product starts feeling extractive, and a required
   * field is what stops that being possible to forget.
   */
  unlocks: string;
  /**
   * Every shape this provider can produce. BankID declares two because it
   * genuinely has two: on a phone it opens the app, on a laptop it shows a
   * reference you confirm on your phone. `begin()` picks per environment.
   */
  modes: readonly ChallengeMode[];
  /** True when this provider can run at all — real credentials, or a mock. */
  isAvailable(env: StampEnv): boolean;
  begin(input: BeginInput, env: StampEnv): StampChallenge;
  /** Present iff `modes` includes a waiting shape. */
  poll?(challenge: StampChallenge, elapsedMs: number): PollState;
  complete(input: CompleteInput): StampResult;
  /** Undefined means the stamp does not lapse. Social accounts are re-checked. */
  lifetimeDays?: number;
}

/** Minutes → an ISO instant, without a clock. */
export function addMinutes(now: ISODateTime, minutes: number): ISODateTime {
  const at = new Date(String(now));
  at.setUTCMinutes(at.getUTCMinutes() + minutes);
  return at.toISOString().replace(/\.\d{3}Z$/, 'Z') as ISODateTime;
}
