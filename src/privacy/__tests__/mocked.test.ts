import { describe, expect, it } from 'vitest';
import type { VerificationRecord } from '@domain/index';
import { asVerificationId, asUtc } from '@domain/index';
import { SEED_PEOPLE } from '@data/seed/people';
import { redact } from '../redact';

/**
 * A stamp earned against a stand-in provider proved nothing. The owner sees
 * it labelled on their own screen; a viewer must never see it as a stamp.
 */
describe('mocked stamps', () => {
  const base = SEED_PEOPLE[0]!;
  const real: VerificationRecord = {
    id: asVerificationId('v1'),
    personId: base.id,
    providerId: 'x',
    kind: 'social_account',
    assurance: 1,
    verifiedAt: asUtc('2026-09-01T00:00:00Z'),
  };
  const mocked: VerificationRecord = { ...real, id: asVerificationId('v2'), providerId: 'y', mocked: true };

  it('are omitted from what a viewer sees, at every rung', () => {
    const p = { ...base, verifications: [real, mocked] };
    for (const level of [0, 1, 2, 3] as const) {
      const stamps = redact(p, level).stamps;
      expect(stamps).toHaveLength(1);
      expect(stamps[0]!.display.label).toBe('x');
    }
  });
});
