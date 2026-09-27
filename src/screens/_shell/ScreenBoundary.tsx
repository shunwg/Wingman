import { Component, type ReactNode } from 'react';

/**
 * One screen failing does not take the app with it.
 *
 * A stored value the code no longer accepts — an address-shaped label saved
 * before the check existed, a place kind from a later version — used to throw
 * inside a render with nothing above it, and the whole shell went blank, tab
 * bar included. This keeps the shell and says so plainly.
 */
export class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="empty" role="alert">
        <h2 className="empty__title display">This screen could not be shown</h2>
        <p className="empty__body">
          Something saved on this device is in a shape this version does not read. Nothing has been
          deleted. The other tabs still work.
        </p>
        <a className="btn btn--secondary" href="#/">
          Go to Home
        </a>
      </div>
    );
  }
}
