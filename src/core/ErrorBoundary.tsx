import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[var(--tf-bg)] p-8">
          <div className="max-w-md text-center">
            <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-3">Etwas ist schiefgelaufen</h1>
            <p className="text-[13px] text-[var(--tf-text-secondary)] mb-6">
              Ein unerwarteter Fehler ist aufgetreten. Bitte laden Sie die Seite neu.
            </p>
            <details className="text-left mb-6">
              <summary className="text-[12px] text-[var(--tf-text-tertiary)] cursor-pointer">Fehlerdetails</summary>
              <pre className="mt-2 p-3 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] text-[11px] text-[var(--tf-text-secondary)] overflow-auto max-h-40">
                {this.state.error?.message}
                {'\n'}
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-[13px] bg-[var(--tf-text)] text-[var(--tf-bg)] rounded-[var(--tf-radius)] cursor-pointer"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
