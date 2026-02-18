import { useMemo } from 'react';
import { useEditorStore } from '../store/editor-store';

export function StatusBar() {
  const source = useEditorStore((s) => s.source);
  const html = useEditorStore((s) => s.html);
  const errors = useEditorStore((s) => s.errors);
  const cursorLine = useEditorStore((s) => s.cursorLine);
  const outputMode = useEditorStore((s) => s.outputMode);

  const blockCount = (source.match(/^--- \w/gm) ?? []).length;
  const htmlSize = useMemo(() => html ? new Blob([html]).size : 0, [html]);
  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warnCount = errors.filter((e) => e.severity === 'warning').length;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '4px 14px',
      background: 'var(--ed-surface)',
      borderTop: '1px solid var(--ed-border)',
      fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace",
      color: 'var(--ed-text-muted)',
      flexShrink: 0,
      height: 28,
    }}>
      <span>{blockCount} blocks</span>
      <span>{formatSize(htmlSize)}</span>
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>{outputMode}</span>

      {errorCount > 0 && (
        <span
          style={{ color: 'var(--ed-error-text)', cursor: 'pointer' }}
          onClick={() => document.querySelector('[data-error-panel]')?.scrollIntoView({ behavior: 'smooth' })}
          title="Jump to errors"
        >
          {errorCount} {errorCount === 1 ? 'error' : 'errors'}
        </span>
      )}
      {warnCount > 0 && (
        <span
          style={{ color: 'var(--ed-warning-text)', cursor: 'pointer' }}
          onClick={() => document.querySelector('[data-error-panel]')?.scrollIntoView({ behavior: 'smooth' })}
          title="Jump to warnings"
        >
          {warnCount} {warnCount === 1 ? 'warning' : 'warnings'}
        </span>
      )}

      <div style={{ flex: 1 }} />
      <span>Ln {cursorLine}</span>
    </div>
  );
}
