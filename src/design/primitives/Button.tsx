import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Buttons.
 *
 * Every pressable thing scales to 0.97 on :active. It costs nothing and it is
 * the difference between an interface that feels like it heard you and one that
 * feels like it is thinking about it. The transition is on `transform` alone —
 * never `all`, which animates properties you did not intend and cannot name.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fills its container — the standard shape for a primary action on mobile. */
  full?: boolean;
  /** Disables and shows a spinner. The label stays, so the width does not jump. */
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  full,
  loading,
  iconLeft,
  iconRight,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={[
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        full ? 'btn--full' : '',
        loading ? 'is-loading' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      // A button mid-request must not be pressable again, but it should still
      // announce why it is unavailable rather than going silently inert.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : iconLeft}
      <span className="btn__label">{children}</span>
      {!loading && iconRight}
    </button>
  );
}
