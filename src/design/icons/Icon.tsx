import type { ReactNode } from 'react';

/**
 * The shared geometry every icon is drawn on.
 *
 * One viewBox, one stroke weight, one set of joins — which is the only reason a
 * hand-drawn set looks like a set rather than five glyphs that happen to sit
 * next to each other. Icons are outlines at 1.7, because the tab bar renders
 * them at 22px over a translucent surface and a hairline disappears there.
 *
 * Deliberately not an icon library. Five nav glyphs do not justify a dependency
 * whose whole value is the other thousand.
 */

export interface IconProps {
  /** Rendered size in px. The stroke does not scale with it, by design. */
  size?: number;
  className?: string;
}

export function Icon({ children, size = 22, className }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}
