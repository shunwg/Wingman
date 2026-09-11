import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore } from '@state/store';
import { VerifyStep } from './VerifyStep';

describe('VerifyStep', () => {
  beforeEach(() => {
    resetStore();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    });
  });

  it('recommends the government eID first, chosen by kind', () => {
    render(<VerifyStep onNext={() => {}} onSkip={() => {}} />);
    const reco = document.querySelector('.verifystep__reco')!;
    expect(reco).not.toBeNull();
    // The public label a viewer sees for a government eID, not a provider name.
    expect(reco.textContent).toMatch(/ID-verified-only/);
    expect(screen.getByText('Other ways to be trusted')).toBeInTheDocument();
  });

  it('can be skipped, and Next never waits for a stamp — verification is recommended, not required', () => {
    const onSkip = vi.fn();
    const onNext = vi.fn();
    render(<VerifyStep onNext={onNext} onSkip={onSkip} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
