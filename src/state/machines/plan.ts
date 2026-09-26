import type { Message, PersonId } from '@domain/index';
import { canAgree, canCallOff, type AgreeRefusal } from '@domain/index';
import type { ISODateTime } from '@domain/time';

/**
 * The write half of an agreed plan.
 *
 * There is no status column to transition: the plan is derived from the room's
 * log (`domain/plan.ts`). What goes through here is the *write* — the `agreed`
 * or `plan_off` message — and it throws on anything the read side would
 * ignore. Same rules, same function, so the two cannot drift: a yes this
 * refuses is a yes the log would never have counted.
 */

export type PlanRefusal = AgreeRefusal | 'no_plan' | 'not_a_meet';

export class PlanRefusedError extends Error {
  constructor(readonly reason: PlanRefusal) {
    super(`Plan refused: ${reason}`);
    this.name = 'PlanRefusedError';
  }
}

export function assertCanAgree(log: readonly Message[], proposalId: string, by: PersonId, at: ISODateTime): void {
  const r = canAgree(log, proposalId, by, at);
  if (r) throw new PlanRefusedError(r);
}

export function assertCanCallOff(log: readonly Message[], proposalId: string): void {
  const r = canCallOff(log, proposalId);
  if (r) throw new PlanRefusedError(r);
}
