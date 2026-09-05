import type { ReactNode } from 'react';

/**
 * A labelled control.
 *
 * Label above, hint under, error under that — the one layout every form in
 * the app uses, so it lives in one place. Pass `htmlFor` when the control has
 * its own id (a combobox, a textarea you need to reach); without it the whole
 * thing is one `<label>`, which associates implicitly and is fine for a plain
 * input.
 *
 * The error is a live region. Colour alone is not a signal.
 */
export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, htmlFor, className, children }: FieldProps) {
  const body = (
    <>
      {htmlFor ? (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="field__label">{label}</span>
      )}
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </>
  );
  const cls = `field ${error ? 'is-invalid' : ''} ${className ?? ''}`;
  return htmlFor ? <div className={cls}>{body}</div> : <label className={cls}>{body}</label>;
}
