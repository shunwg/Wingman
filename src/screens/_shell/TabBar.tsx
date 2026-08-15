import { useStore } from '@state/store';

/**
 * The tab bar.
 *
 * Four destinations, which is the most a bottom bar can carry before the labels
 * start lying. Real anchors rather than buttons, so middle-click, long-press
 * and "open in new tab" all behave — a nav built from divs quietly removes
 * affordances people rely on without ever looking broken.
 */

const TABS = [
  { route: 'board', href: '#/board', label: 'Board', icon: 'M3 6h18M3 12h18M3 18h10' },
  { route: 'trips', href: '#/trips', label: 'Trips', icon: 'M2 12h20M12 2v20' },
  { route: 'requests', href: '#/requests', label: 'Requests', icon: 'M4 5h16v11H8l-4 4V5Z' },
  { route: 'you', href: '#/you', label: 'You', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' },
];

export function TabBar({ route }: { route: string }) {
  const pending = useStore((s) =>
    s.requests.filter((r) => r.toPersonId === s.me.id && ['sent', 'viewed'].includes(r.status))
      .length,
  );

  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const active = route === t.route;
        return (
          <a
            key={t.route}
            href={t.href}
            className={`tab ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="tab__icon">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  d={t.icon}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t.route === 'requests' && pending > 0 && (
                <span className="tab__dot" aria-hidden="true" />
              )}
            </span>
            <span className="tab__label">{t.label}</span>
            {t.route === 'requests' && pending > 0 && (
              <span className="visually-hidden">{pending} waiting for an answer</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
