import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

/**
 * A labelled control.
 *
 * Label above, hint under, error under that — the one layout every form in
 * the app uses, so it lives in one place. The label is associated by id, not
 * by wrapping: a wrapping label would carry the hint and the error in its
 * accessible name, and "Paste the list" would be announced as a paragraph.
 * Pass `htmlFor` when the control already has an id; otherwise a single
 * element child is given one.
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
  const auto = useId();
  const id = htmlFor ?? auto;
  const control =
    !htmlFor && isValidElement(children) && !(children.props as { id?: string }).id
      ? cloneElement(children as ReactElement<{ id?: string }>, { id })
      : children;

  return (
    <div className={`field ${error ? 'is-invalid' : ''} ${className ?? ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {control}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
