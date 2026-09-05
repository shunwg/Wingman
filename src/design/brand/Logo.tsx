import type { CSSProperties } from 'react';

export type LogoTone = 'ink' | 'accent' | 'mono';

export interface LogoProps {
  /** Rendered size in px. The stroke scales with it, unlike the nav icons. */
  size?: number;
  tone?: LogoTone;
  className?: string;
  style?: CSSProperties;
}

/**
 * Two routes converging.
 *
 * Two thin arcs come in from the left — one climbing from below, one dipping
 * from above — and meet at a single point on the right. Two journeys, one
 * moment; and the shape they make is a wing. They arrive at visibly different
 * angles on purpose: two arcs that join tangentially read as one line with a
 * bead on it. The dot is ember on ink by default; `mono` fills it with the
 * stroke colour for favicons and single-colour print.
 *
 * No airplane, by design: the brief bans the motif, and every travel app already
 * has one.
 */
export function Logo({ size = 24, tone = 'ink', className, style }: LogoProps) {
  const stroke = tone === 'accent' ? 'var(--accent)' : 'currentColor';
  const dot = tone === 'mono' ? 'currentColor' : 'var(--accent)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      <path
        d="M3 19 C 8 19, 13 15, 17 9"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M4 5 C 9 5, 13 6, 17 9"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.1" fill={dot} />
    </svg>
  );
}
