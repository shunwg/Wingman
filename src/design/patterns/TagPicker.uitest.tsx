import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TagPicker } from './TagPicker';

const groups = [
  { id: 'a', label: 'Activities', tags: [{ id: 'cycling', label: 'Cycling' }, { id: 'running', label: 'Running' }] },
  { id: 'c', label: 'Culture', tags: [{ id: 'opera', label: 'Opera' }] },
];

describe('TagPicker', () => {
  it('opens a sheet, searches, and toggles with aria-pressed', () => {
    const onChange = vi.fn();
    render(<TagPicker label="Into" groups={groups} value={[]} onChange={onChange} max={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ope' } });
    expect(screen.queryByRole('button', { name: 'Cycling' })).not.toBeInTheDocument();
    const opera = screen.getByRole('button', { name: 'Opera' });
    expect(opera).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(opera);
    expect(onChange).toHaveBeenCalledWith(['opera']);
  });

  it('announces the cap and disables what cannot be added', () => {
    render(<TagPicker label="Into" groups={groups} value={['cycling', 'running']} onChange={() => {}} max={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByRole('status')).toHaveTextContent('2 of 2');
    expect(screen.getByRole('button', { name: 'Opera' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cycling' })).not.toBeDisabled();
  });

  it('refuses to remove the last one when told never to be empty', () => {
    const onChange = vi.fn();
    render(<TagPicker label="Into" groups={groups} value={['opera']} onChange={onChange} max={3} neverEmpty />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Opera' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
