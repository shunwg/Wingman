import type { SuppressionSummary } from '@matching/index';
import { bucketLabel } from '@lib/bucket';

/**
 * Honest about what is not being shown.
 *
 * Two constraints shape this. It has to be truthful — silently hiding people
 * and pretending the board is complete is how a product teaches users its
 * numbers cannot be trusted. And it can never approach an identity: every count
 * arrives already bucketed, so a small number is "a few" rather than a figure
 * that, next to "on your flight", would name someone.
 *
 * Privacy suppression is stated without inviting anyone to work around it.
 * There is deliberately no "see who" affordance, because there is no version of
 * that which respects the choice being described.
 */
export function SuppressionNote({ suppressed }: { suppressed: SuppressionSummary }) {
  const lines: string[] = [];

  if (suppressed.byPrivacy.kind !== 'none') {
    lines.push(`${cap(bucketLabel(suppressed.byPrivacy))} chose to limit who can see them.`);
  }
  if (suppressed.byAssurance.kind !== 'none') {
    lines.push(
      `${cap(bucketLabel(suppressed.byAssurance))} only appear to people who have verified their identity.`,
    );
  }
  if (suppressed.byFeasibility.kind !== 'none') {
    lines.push(
      `${cap(bucketLabel(suppressed.byFeasibility))} overlap with you, but not for long enough to meet.`,
    );
  }
  if (suppressed.byCircle.kind !== 'none') {
    lines.push(`${cap(bucketLabel(suppressed.byCircle))} are only visible inside their circles.`);
  }

  if (lines.length === 0) return null;

  return (
    <aside className="supnote">
      <h2 className="supnote__title">Not shown</h2>
      <ul className="supnote__list">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </aside>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
