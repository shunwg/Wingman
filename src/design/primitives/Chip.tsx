import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Chips — meet kinds, topics, filters, circle badges.
 *
 * Two shapes: a static tag, and a selectable toggle. The toggle is a real
 * button with `aria-pressed`, not a styled div, because a filter you cannot
 * reach by keyboard is a filter half the people cannot use.
 */

export type ChipTone = 'neutral' | 'accent' | 'trust' | 'guard' | 'warn';

export interface ChipProps {
  tone?: ChipTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Mono for codes, times and money — the things that are facts. */
  mono?: boolean;
}

export function Chip({ tone = 'neutral', icon, children, className, mono }: ChipProps) {
  return (
    <span
      className={['chip', `chip--${tone}`, mono ? 'mono' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      {icon}
      {children}
    </span>
  );
}

export interface ToggleChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function ToggleChip({ selected, icon, children, className, ...rest }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={['chip', 'chip--toggle', selected ? 'is-selected' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
