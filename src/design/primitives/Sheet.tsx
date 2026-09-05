import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A bottom sheet.
 *
 * One question, one decision, then it goes away. Escape closes it, the scrim
 * closes it, and focus lands on the panel when it opens so a keyboard or a
 * screen reader is inside the dialog rather than behind it.
 */
export interface SheetProps {
  open: boolean;
  title: string;
  /** Accessible name when the title alone would be ambiguous. */
  label?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

export function Sheet({ open, title, label, onClose, children, actions }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={label ?? title}>
      <div className="sheet__scrim" onClick={onClose} />
      <div className="sheet__panel" ref={panel} tabIndex={-1}>
        <h2 className="sheet__title display">{title}</h2>
        {children}
        {actions && <div className="sheet__actions">{actions}</div>}
      </div>
    </div>
  );
}
