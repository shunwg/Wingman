import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { OptionRow } from './OptionRow';
import { Sheet } from './Sheet';
import { Stepper } from './Stepper';

describe('Field', () => {
  it('associates the label with the control by id when asked', () => {
    render(
      <Field label="Flight number" htmlFor="fno" hint="Like SK1465">
        <input id="fno" />
      </Field>,
    );
    expect(screen.getByLabelText('Flight number')).toHaveAttribute('id', 'fno');
    expect(screen.getByText('Like SK1465')).toBeInTheDocument();
  });

  it('wraps a plain input in one label otherwise', () => {
    render(
      <Field label="Headline">
        <input />
      </Field>,
    );
    expect(screen.getByLabelText('Headline').tagName).toBe('INPUT');
  });

  it('announces an error and hides the hint while it shows', () => {
    render(
      <Field label="Date" hint="Local to the airport" error="That is before today.">
        <input />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('That is before today.');
    expect(screen.queryByText('Local to the airport')).not.toBeInTheDocument();
  });
});

describe('OptionRow', () => {
  it('is a pressed button when selected', () => {
    render(<OptionRow label="Women only" note="Both directions." selected onClick={() => {}} />);
    expect(screen.getByRole('button', { pressed: true })).toHaveTextContent('Women only');
  });
});

describe('Stepper', () => {
  it('names the step for assistive tech and marks the current dot', () => {
    render(<Stepper index={1} count={5} title="About you" onBack={() => {}} />);
    expect(screen.getByLabelText('Step 2 of 5')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});

describe('Sheet', () => {
  it('renders nothing when closed and a dialog when open', () => {
    const { rerender } = render(
      <Sheet open={false} title="Not this time" onClose={() => {}}>
        body
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(
      <Sheet open title="Not this time" onClose={() => {}}>
        body
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Not this time' })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Remove this trip" onClose={onClose}>
        body
      </Sheet>,
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
