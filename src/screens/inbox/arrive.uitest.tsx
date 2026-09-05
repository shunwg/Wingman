import { beforeEach, describe, expect, it } from 'vitest';
import { markArriving, resetArriving, takeArriving } from './arrive';

describe('the signature moment plays once', () => {
  beforeEach(resetArriving);

  it('is taken exactly once after being marked', () => {
    markArriving('meet:r1');
    expect(takeArriving('meet:r1')).toBe(true);
    expect(takeArriving('meet:r1')).toBe(false);
  });

  it('never replays for a channel that has already played, even if marked again', () => {
    markArriving('meet:r1');
    takeArriving('meet:r1');
    markArriving('meet:r1');
    expect(takeArriving('meet:r1')).toBe(false);
  });

  it('does not fire for a room that was never marked', () => {
    expect(takeArriving('circle:insead')).toBe(false);
  });
});
