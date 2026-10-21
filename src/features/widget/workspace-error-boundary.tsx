import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keep a render failure visible without logging note text, mail, or credentials. */
export class WorkspaceErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Deliberately omit user content and raw native errors from production logs.
  }
  render() {
    if (this.state.failed)
      return (
        <main className="widget-shell grid place-items-center p-6 text-center">
          <div role="alert">
            <h1>Unable to display this workspace</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Your saved notes have not been deleted. Reload to try again.
            </p>
            <button className="soft-button mt-4" onClick={() => window.location.reload()}>
              Reload workspace
            </button>
          </div>
        </main>
      );
    return this.props.children;
  }
}
