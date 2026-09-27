import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { TabBar } from './TabBar';
import { ScreenBoundary } from './ScreenBoundary';

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
  title?: ReactNode;
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
        <main className="shell__main" id="main" key={route}>
          {/* The screen suspends here, not at the root: while a screen's chunk
              loads, the header and the tab bar stay put. With the only
              boundary at the root, every first visit to a screen blanked the
              whole app — tab bar included — for as long as the chunk took. */}
          {/* Keyed on the address, so one broken room does not keep the whole
              Inbox tab on the error after you leave it. */}
          <ScreenBoundary key={typeof window === 'undefined' ? route : window.location.hash}>
            <Suspense fallback={null}>{children}</Suspense>
          </ScreenBoundary>
        </main>
        {chrome === 'tabs' && <TabBar route={route} />}
      </div>
    </div>
  );
}
