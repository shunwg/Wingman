import { Suspense, lazy, useEffect, useState } from 'react';
import { AppShell } from './AppShell';
import { HomeScreen } from '@screens/home/HomeScreen';
const BoardScreen = lazy(() => import('@screens/discover/BoardScreen').then((m) => ({ default: m.BoardScreen })));
import { isSignupStep, type SignupStep } from '@screens/onboarding/steps';
import { useStore } from '@state/store';
import { Avatar } from '@design/primitives/Avatar';

const DesignGallery = lazy(() => import('@design/gallery/DesignGallery').then((m) => ({ default: m.DesignGallery })));
const PersonScreen = lazy(() => import('@screens/person/PersonScreen').then((m) => ({ default: m.PersonScreen })));
const InboxScreen = lazy(() => import('@screens/inbox/InboxScreen').then((m) => ({ default: m.InboxScreen })));
const ChannelScreen = lazy(() => import('@screens/inbox/ChannelScreen').then((m) => ({ default: m.ChannelScreen })));
const TripsScreen = lazy(() => import('@screens/trips/TripsScreen').then((m) => ({ default: m.TripsScreen })));
const NewTripScreen = lazy(() => import('@screens/trips/NewTripScreen').then((m) => ({ default: m.NewTripScreen })));
const CirclesScreen = lazy(() => import('@screens/circles/CirclesScreen').then((m) => ({ default: m.CirclesScreen })));
const SetupScreen = lazy(() => import('@screens/circles/SetupScreen').then((m) => ({ default: m.SetupScreen })));
const CircleScreen = lazy(() => import('@screens/circles/CircleScreen').then((m) => ({ default: m.CircleScreen })));
const InviteScreen = lazy(() => import('@screens/circles/InviteScreen').then((m) => ({ default: m.InviteScreen })));
const AdminScreen = lazy(() => import('@screens/circles/AdminScreen').then((m) => ({ default: m.AdminScreen })));
const JoinCircleScreen = lazy(() => import('@screens/circles/JoinCircleScreen').then((m) => ({ default: m.JoinCircleScreen })));
const VerifyScreen = lazy(() => import('@screens/verify/VerifyScreen').then((m) => ({ default: m.VerifyScreen })));
const YouScreen = lazy(() => import('@screens/profile/YouScreen').then((m) => ({ default: m.YouScreen })));
const EditProfileScreen = lazy(() => import('@screens/profile/EditProfileScreen').then((m) => ({ default: m.EditProfileScreen })));
import { WelcomeScreen } from '@screens/onboarding/WelcomeScreen';
const SignupScreen = lazy(() => import('@screens/onboarding/SignupScreen').then((m) => ({ default: m.SignupScreen })));
const SigninScreen = lazy(() => import('@screens/onboarding/SigninScreen').then((m) => ({ default: m.SigninScreen })));
const DemoEntry = lazy(() => import('@screens/onboarding/DemoEntry').then((m) => ({ default: m.DemoEntry })));

/**
 * The URL → screen table.
 *
 * Hash routing, deliberately: it needs no server rewrite rules, which keeps the
 * build a static bundle anyone can open. The parse is one small function so
 * there is exactly one place that knows what a URL means.
 */

export interface Route {
  name:
    | 'home'
    | 'discover'
    | 'person'
    | 'inbox'
    | 'channel'
    | 'trip'
    | 'trip.new'
    | 'trip.edit'
    | 'circles'
    | 'circles.new'
    | 'circle'
    | 'circle.invite'
    | 'circle.admin'
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
  if (head === 'discover') return { name: 'discover' };
  if (head === 'person' && id) return { name: 'person', id, ...(tripId ? { tripId } : {}) };
  if (head === 'inbox' && id) return { name: 'channel', id: parts.slice(1).join('/') };
  if (head === 'inbox') return { name: 'inbox' };
  // Earlier names, kept as aliases so old links and screenshots still land.
  if (head === 'requests') return { name: 'inbox' };
  // `trips` and `board` were the names before the tab bar grew to five. Kept as
  // aliases so a bookmark or a screenshot URL from an earlier build still lands
  // somewhere sensible.
  if (head === 'trip' && id === 'new') return { name: 'trip.new' };
  if (head === 'trip' && id && tripId === 'edit') return { name: 'trip.edit', id };
  if (head === 'trip' || head === 'trips') return { name: 'trip' };
  if (head === 'circles' && id === 'new') return { name: 'circles.new' };
  if (head === 'circles' && id && tripId === 'invite') return { name: 'circle.invite', id };
  if (head === 'circles' && id && tripId === 'admin') return { name: 'circle.admin', id };
  if (head === 'circles' && id) return { name: 'circle', id };
  if (head === 'circles') return { name: 'circles' };
  // The invite link. Deliberately its own top-level route rather than a query
  // string on Circles, so the whole URL is the thing you paste into a message.
  if (head === 'join' && id) return { name: 'join', id };
  if (head === 'meet' && id) return { name: 'channel', id: `meet:${id}` };
  if (head === 'verify') return { name: 'verify' };
  if (head === 'you' && id === 'edit') return { name: 'you.edit' };
  if (head === 'you') return { name: 'you' };
  return { name: 'home' };
}

/** Time of day, in the person's own clock — the one place the screen reads it. */
function greeting(): string {
  const h = new Date().getHours();
  const part = h < 5 ? 'evening' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return `Good ${part}`;
}

/** "Good evening, Alex." The name is the whole point of a greeting. */
function Greeting() {
  const first = useStore((s) => s.me.firstName || s.me.displayName.split(' ')[0] || '');
  return (
    <>
      {greeting()},
      <br />
      {first ? `${first}.` : ''}
    </>
  );
}

/** The avatar is the door to You. Profile is reached, never navigated to. */
function HomeAvatar() {
  const me = useStore((s) => s.me);
  return (
    <a href="#/you" className="shell__avatar" aria-label="You">
      <Avatar spec={me.avatar} size="sm" />
    </a>
  );
}

export const navigate = (to: string) => {
  window.location.hash = to;
};

/** The routes a person can reach before they have a profile. */
const DOORS: ReadonlySet<Route['name']> = new Set(['welcome', 'signup', 'signin', 'demo']);

/**
 * Route-level code splitting.
 *
 * The board is the first paint and stays in the entry chunk; every other
 * screen arrives when it is first opened. The fallback is nothing at all: a
 * spinner for a 30 ms chunk load is worse than a blank frame.
 */
export function Router() {
  return (
    <Suspense fallback={null}>
      <Routes />
    </Suspense>
  );
}

function Routes() {
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
    if (route.name !== 'home') setReturnTo(window.location.hash);
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
      <AppShell route="home">
        <PersonScreen
          id={route.id}
          {...(route.tripId ? { tripId: route.tripId } : {})}
          onBack={() => (window.history.length > 1 ? window.history.back() : navigate('#/'))}
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
    case 'inbox':
      return (
        <AppShell route="inbox" title="Inbox">
          <InboxScreen onOpen={(to) => navigate(to)} />
        </AppShell>
      );
    case 'channel':
      return (
        <AppShell route="inbox">
          <ChannelScreen channelId={route.id ?? ''} onBack={() => navigate('#/inbox')} />
        </AppShell>
      );
    case 'trip':
      return (
        <AppShell route="trip" title="Trips">
          <TripsScreen onOpen={(to) => navigate(to)} />
        </AppShell>
      );
    case 'trip.new':
      return (
        <AppShell route="trip" title="Add a trip">
          <NewTripScreen onDone={() => navigate('#/trip')} />
        </AppShell>
      );
    case 'trip.edit':
      return (
        <AppShell route="trip" title="Edit this trip">
          <NewTripScreen tripId={route.id ?? ''} onDone={() => navigate('#/trip')} />
        </AppShell>
      );
    case 'circles':
      return (
        <AppShell route="circles" title="Circles">
          <CirclesScreen onOpen={(id) => navigate(`#/circles/${id}`)} />
        </AppShell>
      );
    case 'circles.new':
      return (
        <AppShell route="circles">
          <SetupScreen onDone={() => navigate('#/circles')} />
        </AppShell>
      );
    case 'circle':
      return (
        <AppShell route="circles">
          <CircleScreen id={route.id ?? ''} onBack={() => navigate('#/circles')} />
        </AppShell>
      );
    case 'circle.invite':
      return (
        <AppShell route="circles" title="Invite people">
          <InviteScreen id={route.id ?? ''} onBack={() => navigate('#/circles/' + (route.id ?? ''))} />
        </AppShell>
      );
    case 'circle.admin':
      return (
        <AppShell route="circles" title="Manage">
          <AdminScreen id={route.id ?? ''} onBack={() => navigate('#/circles/' + (route.id ?? ''))} />
        </AppShell>
      );
    case 'join':
      return (
        <AppShell route="circles" title="Invitation">
          <JoinCircleScreen code={route.id ?? ''} onDone={() => navigate('#/circles')} />
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
    case 'discover':
      return (
        <AppShell route="home" title="Around you">
          <BoardScreen onOpen={(id) => navigate(`#/person/${id}`)} />
        </AppShell>
      );
    default:
      return (
        <AppShell route="home" title={<Greeting />} action={<HomeAvatar />}>
          <HomeScreen onOpen={(to) => navigate(to)} />
        </AppShell>
      );
  }
}
