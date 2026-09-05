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

  it('can be skipped, and Next waits for a stamp', () => {
    const onSkip = vi.fn();
    render(<VerifyStep onNext={() => {}} onSkip={onSkip} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
