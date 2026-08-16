import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { generateAvatar } from '../avatar/generate';
import { Avatar } from './Avatar';

/**
 * Everyone gets a photo — by one route or the other.
 *
 * The failure this guards against is not a crash. It is a person with no
 * uploaded photograph rendering as an empty square, which looks like a broken
 * app rather than a new user, and which no typecheck would ever catch because
 * `photoUrl` is legitimately optional.
 */

describe('Avatar', () => {
  it('renders the photograph when the spec carries one', () => {
    const spec = { ...generateAvatar('priya'), photoUrl: '/assets/priya.jpg' };
    const { container } = render(<Avatar spec={spec} label="Priya" />);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/assets/priya.jpg');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders a generated portrait when there is no photograph', () => {
    const { container } = render(<Avatar spec={generateAvatar('nobody-in-particular')} />);

    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('never renders an empty box, whichever route it took', () => {
    for (const spec of [
      generateAvatar('a'),
      { ...generateAvatar('b'), photoUrl: '/assets/b.jpg' },
    ]) {
      const { container } = render(<Avatar spec={spec} />);
      expect(container.querySelector('img, svg')).not.toBeNull();
    }
  });

  it('does not announce a photo that sits next to the name anyway', () => {
    // Decorative when unlabelled: a screen reader saying "image" beside the
    // text "Priya" is noise, and alt text repeating an adjacent name is worse.
    const spec = { ...generateAvatar('priya'), photoUrl: '/assets/priya.jpg' };
    const { container } = render(<Avatar spec={spec} />);
    expect(container.querySelector('img')!.getAttribute('alt')).toBe('');
  });
});
