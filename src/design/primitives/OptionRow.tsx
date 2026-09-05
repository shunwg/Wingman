import type { ReactNode } from 'react';

/**
 * One choice in a short list: a label, an optional line under it, and a
 * selected state. A real button with `aria-pressed`, 44px tall, because it is
 * tapped one-handed and read by screen readers as a toggle.
 */
export interface OptionRowProps {
  label: ReactNode;
  note?: ReactNode;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function OptionRow({ label, note, selected, onClick, disabled }: OptionRowProps) {
  return (
    <button
      type="button"
      className={`optrow ${selected ? 'is-selected' : ''}`}
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="optrow__label">{label}</span>
      {note && <span className="optrow__note">{note}</span>}
    </button>
  );
}
