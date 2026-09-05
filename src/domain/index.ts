/**
 * The domain contract — the only import path for types.
 *
 * Everything downstream depends on this barrel and nothing here depends on
 * anything else in the app. If a change ripples outward from this file, that is
 * the design working: these are the shapes the whole product agrees on.
 */

export * from './ids';
export * from './time';
export * from './airport';
export * from './flight';
export * from './trip';
export * from './tripEntry';
export * from './intent';
export * from './avatar';
export * from './verification';
export * from './circle';
export * from './admission';
export * from './person';
export * from './privacy';
export * from './meet';
export * from './rating';
export * from './guardian';
export * from './guards';
