/**
 * Where you are in a short sequence.
 *
 * Dots, not "Step 3 of 5" in words — the count is in the accessible label,
 * and the dots say the same thing at a glance. Back is a real 44px target,
 * because the one thing a multi-step form must never do is trap someone.
 */
export interface StepperProps {
  /** Zero-based. */
  index: number;
  count: number;
  title: string;
  onBack?: () => void;
}

export function Stepper({ index, count, title, onBack }: StepperProps) {
  return (
    <header className="stepper">
      <div className="stepper__row">
        {onBack ? (
          <button type="button" className="stepper__back" onClick={onBack}>
            <span aria-hidden="true">←</span>
            <span className="visually-hidden">Back</span>
          </button>
        ) : (
          <span className="stepper__back stepper__back--blank" aria-hidden="true" />
        )}
        <ol className="stepper__dots" aria-label={`Step ${index + 1} of ${count}`}>
          {Array.from({ length: count }, (_, i) => (
            <li
              key={i}
              className={`stepper__dot ${i === index ? 'is-on' : ''} ${i < index ? 'is-done' : ''}`}
              aria-current={i === index ? 'step' : undefined}
            />
          ))}
        </ol>
      </div>
      <h2 className="stepper__title display">{title}</h2>
    </header>
  );
}
