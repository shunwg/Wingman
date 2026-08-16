import { makeOAuthProvider } from './oauth';

/**
 * Google.
 *
 * Sign-in only — `openid email profile`, which proves the person controls a
 * Google account and stops there.
 *
 * It is deliberately *not* a route into Gmail. Reading someone's mail to find
 * their flights needs a restricted scope, which means Google's annual
 * third-party security assessment and a five-figure yearly bill, and it means
 * holding a token that can read everything else in the mailbox to extract one
 * booking. Scanning the barcode on a boarding pass gets the same flight, on
 * device, with nothing leaving the phone. Where a Google account is on a work
 * domain, `email_domain` is the stamp that says so.
 */
export const google = makeOAuthProvider({
  id: 'google',
  label: 'Google',
  iconKey: 'google',
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  scopes: ['openid', 'email', 'profile'],
  handleHint: 'address',
  handlePattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  explainer: 'You signed in with Google and it confirmed the address is yours.',
  unlocks: 'Confirms an address you control, without handing over your mailbox.',
  publicLabel: 'Google verified',
});
