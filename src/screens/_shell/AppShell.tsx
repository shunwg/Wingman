import type { ReactNode } from 'react';
import { TabBar } from './TabBar';

/**
 * The frame.
 *
 * A phone-width column, centred, with the tab bar pinned to the bottom.
 * `100dvh` rather than `100vh` because on mobile Safari the latter is a lie
 * whenever the URL bar is visible, and the difference is exactly the height of
 * the primary action.
 *
 * `chrome="none"` is for the doors — welcome, signup, sign-in — where a tab
 * bar would offer five places to go before there is anyone to go there as.
 */
export function AppShell({
  children,
  route,
  title,
  action,
  chrome = 'tabs',
}: {
  children: ReactNode;
  route: string;
  title?: string;
  action?: ReactNode;
  chrome?: 'tabs' | 'none';
}) {
  return (
    <div className="shell">
      <div className={`shell__frame ${chrome === 'none' ? 'shell__frame--door' : ''}`}>
        {title && (
          <header className="shell__header">
            <h1 className="shell__title display">{title}</h1>
            {action}
          </header>
        )}
        <main className="shell__main" id="main">
          {children}
        </main>
        {chrome === 'tabs' && <TabBar route={route} />}
      </div>
    </div>
  );
}
