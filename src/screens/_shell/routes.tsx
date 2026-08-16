import { useEffect, useState } from 'react';
import { DesignGallery } from '@design/gallery/DesignGallery';
import { AppShell } from './AppShell';
import { BoardScreen } from '@screens/discover/BoardScreen';
import { PersonScreen } from '@screens/person/PersonScreen';
import { RequestsScreen } from '@screens/requests/RequestsScreen';
import { TripsScreen } from '@screens/trips/TripsScreen';
import { CirclesScreen } from '@screens/circles/CirclesScreen';
import { YouScreen } from '@screens/profile/YouScreen';

/**
 * The URL → screen table.
 *
 * Hash routing, deliberately: it needs no server rewrite rules, which keeps the
 * build a static bundle anyone can open. The parse is one small function so
 * there is exactly one place that knows what a URL means.
 */

export interface Route {
  name: 'discover' | 'person' | 'requests' | 'trip' | 'circles' | 'you' | 'design';
  id?: string;
}

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [head, id] = parts;

  if (head === '_design') return { name: 'design' };
  if (head === 'person' && id) return { name: 'person', id };
  if (head === 'requests') return { name: 'requests' };
  // `trips` and `board` were the names before the tab bar grew to five. Kept as
  // aliases so a bookmark or a screenshot URL from an earlier build still lands
  // somewhere sensible.
  if (head === 'trip' || head === 'trips') return { name: 'trip' };
  if (head === 'circles') return { name: 'circles' };
  if (head === 'you') return { name: 'you' };
  return { name: 'discover' };
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
      <AppShell route="discover">
        <PersonScreen id={route.id} onBack={() => navigate('#/')} />
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
    case 'trip':
      return (
        <AppShell route="trip" title="Your trip">
          <TripsScreen />
        </AppShell>
      );
    case 'circles':
      return (
        <AppShell route="circles" title="Circles">
          <CirclesScreen />
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
        <AppShell route="discover" title="Around you">
          <BoardScreen onOpen={(id) => navigate(`#/person/${id}`)} />
        </AppShell>
      );
  }
}
