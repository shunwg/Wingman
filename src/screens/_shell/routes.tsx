import { useEffect, useState } from 'react';
import { DesignGallery } from '@design/gallery/DesignGallery';
import { AppShell } from './AppShell';
import { BoardScreen } from '@screens/discover/BoardScreen';
import { PersonScreen } from '@screens/person/PersonScreen';
import { RequestsScreen } from '@screens/requests/RequestsScreen';
import { TripsScreen } from '@screens/trips/TripsScreen';
import { NewTripScreen } from '@screens/trips/NewTripScreen';
import { CirclesScreen } from '@screens/circles/CirclesScreen';
import { NewCircleScreen } from '@screens/circles/NewCircleScreen';
import { JoinCircleScreen } from '@screens/circles/JoinCircleScreen';
import { MeetScreen } from '@screens/meet/MeetScreen';
import { VerifyScreen } from '@screens/verify/VerifyScreen';
import { YouScreen } from '@screens/profile/YouScreen';
import { EditProfileScreen } from '@screens/profile/EditProfileScreen';
import { WelcomeScreen } from '@screens/onboarding/WelcomeScreen';
import { SignupScreen } from '@screens/onboarding/SignupScreen';
import { SigninScreen } from '@screens/onboarding/SigninScreen';
import { DemoEntry } from '@screens/onboarding/DemoEntry';
import { isSignupStep, type SignupStep } from '@screens/onboarding/steps';
import { useStore } from '@state/store';

/**
 * The URL → screen table.
 *
 * Hash routing, deliberately: it needs no server rewrite rules, which keeps the
 * build a static bundle anyone can open. The parse is one small function so
 * there is exactly one place that knows what a URL means.
 */

export interface Route {
  name:
    | 'discover'
    | 'person'
    | 'requests'
    | 'meet'
    | 'trip'
    | 'trip.new'
    | 'circles'
    | 'circles.new'
    | 'join'
    | 'you'
    | 'you.edit'
    | 'verify'
    | 'welcome'
    | 'signup'
    | 'signin'
    | 'demo'
    | 'design';
  id?: string;
  /**
   * Which of your trips you opened this person from.
   *
   * Carried in the URL because the same traveller can appear on the board twice
   * under two flight codes, and a profile that did not know which one you
   * tapped would send the meet request against the wrong journey — closing the
   * wrong trip when they say yes.
   */
  tripId?: string;
  /** The signup step, so a refresh mid-signup lands where it left off. */
  step?: SignupStep;
}

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [head, id, tripId] = parts;

  if (head === '_design') return { name: 'design' };
  if (head === 'welcome') return { name: 'welcome' };
  if (head === 'signup') return { name: 'signup', step: isSignupStep(id) ? id : 'about' };
  if (head === 'signin') return { name: 'signin' };
  if (head === 'demo') return { name: 'demo' };
  if (head === 'person' && id) return { name: 'person', id, ...(tripId ? { tripId } : {}) };
  if (head === 'requests') return { name: 'requests' };
  // `trips` and `board` were the names before the tab bar grew to five. Kept as
  // aliases so a bookmark or a screenshot URL from an earlier build still lands
  // somewhere sensible.
  if (head === 'trip' && id === 'new') return { name: 'trip.new' };
  if (head === 'trip' || head === 'trips') return { name: 'trip' };
  if (head === 'circles' && id === 'new') return { name: 'circles.new' };
  if (head === 'circles') return { name: 'circles' };
  // The invite link. Deliberately its own top-level route rather than a query
  // string on Circles, so the whole URL is the thing you paste into a message.
  if (head === 'join' && id) return { name: 'join', id };
  if (head === 'meet' && id) return { name: 'meet', id };
  if (head === 'verify') return { name: 'verify' };
  if (head === 'you' && id === 'edit') return { name: 'you.edit' };
  if (head === 'you') return { name: 'you' };
  return { name: 'discover' };
}

export const navigate = (to: string) => {
  window.location.hash = to;
};

/** The routes a person can reach before they have a profile. */
const DOORS: ReadonlySet<Route['name']> = new Set(['welcome', 'signup', 'signin', 'demo']);

export function Router() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const onboarded = useStore((s) => s.onboarded);
  const setReturnTo = useStore((s) => s.setReturnTo);

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

  const door = DOORS.has(route.name);
  const gallery = route.name === 'design';

  /*
   * The first-run gate.
   *
   * Nobody sees a board before they have a profile — or the demo. An
   * invitation opened on a fresh install is kept as `returnTo`, so the person
   * lands back on it once they are through. The gallery is exempt: it is a
   * design surface, not a screen.
   */
  // Both effects check the live hash before redirecting: a screen that has
  // just navigated (the demo button sending you to an invitation, say) flips
  // `onboarded` before the hashchange lands, and `route` is one step behind.
  useEffect(() => {
    if (onboarded || door || gallery) return;
    if (parseRoute(window.location.hash).name !== route.name) return;
    if (route.name !== 'discover') setReturnTo(window.location.hash);
    navigate('#/welcome');
  }, [onboarded, door, gallery, route.name, setReturnTo]);

  useEffect(() => {
    if (!onboarded || !door || route.name === 'demo') return;
    if (parseRoute(window.location.hash).name !== route.name) return;
    navigate('#/');
  }, [onboarded, door, route.name]);

  if (gallery) return <DesignGallery />;
  if (!onboarded && !door) return null; // one frame before the redirect lands

  if (route.name === 'person' && route.id) {
    return (
      <AppShell route="discover">
        <PersonScreen
          id={route.id}
          {...(route.tripId ? { tripId: route.tripId } : {})}
          onBack={() => navigate('#/')}
        />
      </AppShell>
    );
  }

  switch (route.name) {
    case 'welcome':
      return (
        <AppShell route="welcome" chrome="none">
          <WelcomeScreen />
        </AppShell>
      );
    case 'signup':
      return (
        <AppShell route="signup" chrome="none">
          <SignupScreen step={route.step ?? 'about'} />
        </AppShell>
      );
    case 'signin':
      return (
        <AppShell route="signin" chrome="none">
          <SigninScreen />
        </AppShell>
      );
    case 'demo':
      return (
        <AppShell route="demo" chrome="none">
          <DemoEntry />
        </AppShell>
      );
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
    case 'trip.new':
      return (
        <AppShell route="trip" title="Add a trip">
          <NewTripScreen onDone={() => navigate('#/trip')} />
        </AppShell>
      );
    case 'circles':
      return (
        <AppShell route="circles" title="Circles">
          <CirclesScreen />
        </AppShell>
      );
    case 'circles.new':
      return (
        <AppShell route="circles" title="Open a circle">
          <NewCircleScreen onDone={() => navigate('#/circles')} />
        </AppShell>
      );
    case 'join':
      return (
        <AppShell route="circles" title="Invitation">
          <JoinCircleScreen code={route.id ?? ''} onDone={() => navigate('#/circles')} />
        </AppShell>
      );
    case 'meet':
      return (
        <AppShell route="requests" title="Meeting">
          <MeetScreen requestId={route.id ?? ''} onBack={() => navigate('#/requests')} />
        </AppShell>
      );
    case 'verify':
      return (
        <AppShell route="you" title="Your accounts">
          <VerifyScreen />
        </AppShell>
      );
    case 'you.edit':
      return (
        <AppShell route="you" title="Edit your card">
          <EditProfileScreen onDone={() => navigate('#/you')} />
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
