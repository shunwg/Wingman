import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * The overflow menu.
 *
 * A 44px "⋯" and a short list under it. It exists for the actions that must
 * be on every surface that shows a person — hide, report, mute — without
 * making any of them the loudest thing on the screen. Escape and an outside
 * tap close it; focus goes to the first item when it opens.
 */
export interface MenuItem {
  label: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
}

export function Menu({ label = 'More', items }: { label?: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  return (
    <div className="menu" ref={wrap}>
      <button
        type="button"
        className="menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <ul className="menu__list" role="menu" id={id}>
          {items.map((item, i) => (
            <li key={i} role="none">
              <button
                type="button"
                role="menuitem"
                ref={i === 0 ? first : undefined}
                className={`menu__item ${item.tone === 'danger' ? 'menu__item--danger' : ''}`}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
