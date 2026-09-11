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
  const hintId = `${auto}-hint`;
  const errorId = `${auto}-error`;
  // Only the error is announced by the browser's error-locating behaviour,
  // but a screen-reader user tabbing back into the field with no
  // `aria-describedby` at all hears nothing distinguishing it from any other
  // control — `aria-invalid` and `aria-describedby` are what actually connect
  // the alert to the input it belongs to.
  const describedBy = error ? errorId : hint ? hintId : undefined;
  // `id` is only injected when the caller has not already fixed one via
  // `htmlFor` — a hand-set id must not be overwritten. `aria-invalid` and
  // `aria-describedby` are a separate decision and apply whenever there is a
  // single element to clone onto, `htmlFor` or not: the majority of this
  // component's callers pass `htmlFor` precisely so the id is stable and
  // predictable, and those controls need the error wired up exactly as much
  // as the ones that let this component generate an id.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        ...(!htmlFor && !(children.props as { id?: string }).id ? { id } : {}),
        'aria-invalid': error ? true : undefined,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })
    : children;

  return (
    <div className={`field ${error ? 'is-invalid' : ''} ${className ?? ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {control}
      {hint && !error && (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
