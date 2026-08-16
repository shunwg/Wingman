import { makeOAuthProvider } from './oauth';

/**
 * Instagram.
 *
 * The slowest of the four to get approved, and the one whose link stays hidden
 * longest — `on_meet` rather than `on_accept`. Handing a stranger your
 * Instagram is the disclosure people are most right to be nervous about, and
 * the default should match that rather than quietly assume otherwise.
 */
export const instagram = makeOAuthProvider({
  id: 'instagram',
  label: 'Instagram',
  iconKey: 'instagram',
  authorizeUrl: 'https://api.instagram.com/oauth/authorize',
  scopes: ['user_profile'],
  handleHint: 'username',
  // Instagram's own rule: letters, digits, periods, underscores, max 30.
  handlePattern: /^[A-Za-z0-9._]{1,30}$/,
  explainer: 'You signed in to Instagram and it confirmed the account is yours.',
  unlocks: 'Shows on your card once you are actually meeting, never before.',
  publicLabel: 'Instagram verified',
});
