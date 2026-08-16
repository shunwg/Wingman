import { makeOAuthProvider } from './oauth';

/**
 * LinkedIn.
 *
 * The one people hand over readily, and the one that carries the most weight in
 * a professional context — which is why `SocialLink.visibility` defaults it to
 * `on_accept` while Instagram and Facebook wait for `on_meet`.
 *
 * Scope note for whoever wires this up for real: "Sign In with LinkedIn using
 * OpenID Connect" gives name and email and nothing else. Company and job title
 * need the deeper Marketing/Profile products and a partnership application, so
 * the professional card stays self-declared for now — the stamp proves the
 * account, not the employer. The employer claim is what `email_domain` is for.
 */
export const linkedin = makeOAuthProvider({
  id: 'linkedin',
  label: 'LinkedIn',
  iconKey: 'linkedin',
  authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  scopes: ['openid', 'profile', 'email'],
  handleHint: 'profile name',
  handlePattern: /^[A-Za-z0-9-]{3,100}$/,
  explainer: 'You signed in to LinkedIn and it confirmed the account is yours.',
  unlocks: 'Shows on your card, and becomes visible once a meet is accepted.',
  publicLabel: 'LinkedIn verified',
});
