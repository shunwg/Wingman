import { useEffect, useState } from 'react';
import { DesignGallery } from '@design/gallery/DesignGallery';
import { AppShell } from './AppShell';
import { BoardScreen } from '@screens/discover/BoardScreen';
import { PersonScreen } from '@screens/person/PersonScreen';
import { RequestsScreen } from '@screens/requests/RequestsScreen';
import { TripsScreen } from '@screens/trips/TripsScreen';
import { YouScreen } from '@screens/profile/YouScreen';

/**
 * The URL → screen table.
 *
 * Hash routing, deliberately: it needs no server rewrite rules, which keeps the
 * build a static bundle anyone can open. The parse is one small function so
 * there is exactly one place that knows what a URL means.
 */

export interface Route {
  name: 'board' | 'person' | 'requests' | 'trips' | 'you' | 'design';
  id?: string;
}

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [head, id] = parts;

  if (head === '_design') return { name: 'design' };
  if (head === 'person' && id) return { name: 'person', id };
  if (head === 'requests') return { name: 'requests' };
  if (head === 'trips') return { name: 'trips' };
  if (head === 'you') return { name: 'you' };
  return { name: 'board' };
}

export const navigate = (to: string) => {
  window.location.hash = to;
};

export function Router() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      // A new screen starts at the top. Without this, opening a person from
      // halfway down the board lands you halfway down their profile.
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  if (route.name === 'design') return <DesignGallery />;

  if (route.name === 'person' && route.id) {
    return (
      <AppShell route="board">
        <PersonScreen id={route.id} onBack={() => navigate('#/board')} />
      </AppShell>
    );
  }

  switch (route.name) {
    case 'requests':
      return (
        <AppShell route="requests" title="Requests">
          <RequestsScreen />
        </AppShell>
      );
    case 'trips':
      return (
        <AppShell route="trips" title="Trips">
          <TripsScreen />
        </AppShell>
      );
    case 'you':
      return (
        <AppShell route="you" title="You">
          <YouScreen />
        </AppShell>
      );
    default:
      return (
        <AppShell route="board" title="Around you">
          <BoardScreen onOpen={(id) => navigate(`#/person/${id}`)} />
        </AppShell>
      );
  }
}
