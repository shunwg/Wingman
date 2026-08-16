import { makeOAuthProvider } from './oauth';

/**
 * Facebook.
 *
 * Meta requires app review before this works for anyone outside the developer
 * account, so the mock is what runs until that clears.
 */
export const facebook = makeOAuthProvider({
  id: 'facebook',
  label: 'Facebook',
  iconKey: 'facebook',
  authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
  scopes: ['public_profile'],
  handleHint: 'username',
  handlePattern: /^[A-Za-z0-9.]{5,50}$/,
  explainer: 'You signed in to Facebook and it confirmed the account is yours.',
  unlocks: 'Shows on your card once you are actually meeting.',
  publicLabel: 'Facebook verified',
});
