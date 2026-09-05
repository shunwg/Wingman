import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';
import { Wordmark } from './Wordmark';

describe('Logo', () => {
  it('renders an aria-hidden svg with two paths and one dot', () => {
    const { container } = render(<Logo size={48} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('path')).toHaveLength(2);
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
    expect(svg.getAttribute('width')).toBe('48');
  });

  it('mono tone fills the dot with the stroke colour', () => {
    const { container } = render(<Logo tone="mono" />);
    expect(container.querySelector('circle')!.getAttribute('fill')).toBe('currentColor');
  });

  it('the wordmark says the name once, in the display face', () => {
    const { container } = render(<Wordmark />);
    expect(container.textContent).toBe('Wingman');
    expect(container.querySelector('.wordmark__name')!.classList.contains('display')).toBe(true);
  });
});
