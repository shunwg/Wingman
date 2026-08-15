import type { ReactNode } from 'react';
import { TabBar } from './TabBar';

/**
 * The frame.
 *
 * A phone-width column, centred, with the tab bar pinned to the bottom.
 * `100dvh` rather than `100vh` because on mobile Safari the latter is a lie
 * whenever the URL bar is visible, and the difference is exactly the height of
 * the primary action.
 */
export function AppShell({
  children,
  route,
  title,
  action,
}: {
  children: ReactNode;
  route: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="shell">
      <div className="shell__frame">
        {title && (
          <header className="shell__header">
            <h1 className="shell__title display">{title}</h1>
            {action}
          </header>
        )}
        <main className="shell__main" id="main">
          {children}
        </main>
        <TabBar route={route} />
      </div>
    </div>
  );
}
