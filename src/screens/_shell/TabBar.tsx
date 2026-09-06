import type { ComponentType } from 'react';
import { Home } from '@design/icons/Home';
import { Route } from '@design/icons/Route';
import { Ticket } from '@design/icons/Ticket';
import { ShieldCheck } from '@design/icons/ShieldCheck';
import { PersonMark } from '@design/icons/PersonMark';
import { useInboxBadge } from '@state/selectors/inbox';

/**
 * The tab bar.
 *
 * Five destinations. Circles earns one because a closed loop is the thing being
 * sold — a school or a conference buys the circle, and burying it two levels
 * down inside a settings screen would make the product's commercial centre the
 * hardest thing in it to find.
 *
 * "Trip", singular. You have one trip at a time; the plural promised a list
 * that does not exist and never will.
 *
 * Real anchors rather than buttons, so middle-click, long-press and "open in
 * new tab" all behave — a nav built from divs quietly removes affordances
 * people rely on without ever looking broken.
 */

const TABS: {
  route: string;
  href: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
}[] = [
  { route: 'home', href: '#/', label: 'Home', icon: Home },
  { route: 'trip', href: '#/trip', label: 'Trips', icon: Route },
  { route: 'inbox', href: '#/inbox', label: 'Inbox', icon: Ticket },
  { route: 'circles', href: '#/circles', label: 'Circles', icon: ShieldCheck },
  { route: 'you', href: '#/you', label: 'You', icon: PersonMark },
];

export function TabBar({ route }: { route: string }) {
  // Requests waiting for an answer plus channels with something unread.
  const pending = useInboxBadge();

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
              <t.icon />
              {t.route === 'inbox' && pending > 0 && (
                <span className="tab__dot" aria-hidden="true" />
              )}
            </span>
            <span className="tab__label">{t.label}</span>
            {t.route === 'inbox' && pending > 0 && (
              <span className="visually-hidden">{pending} need you</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
