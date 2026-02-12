import { Component, type ReactNode } from 'react';

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            background: 'var(--ed-bg)',
            color: 'var(--ed-text-muted)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 13,
            textAlign: 'center',
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.6 }}>
            {this.props.name} crashed
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ed-error-text, #ef4444)', maxWidth: 300, wordBreak: 'break-word' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={this.handleReset}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: '1px solid var(--ed-border)',
              background: 'var(--ed-surface)',
              color: 'var(--ed-text)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Recover
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
