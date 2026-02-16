import { useEditorStore } from '../store/editor-store';

export function StylePickToggle() {
  const stylePickMode = useEditorStore((s) => s.stylePickMode);
  const setStylePickMode = useEditorStore((s) => s.setStylePickMode);

  return (
    <button
      onClick={() => setStylePickMode(!stylePickMode)}
      title={stylePickMode ? 'Exit style picker (click elements to style)' : 'Pick element to style'}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        border: stylePickMode ? '1px solid var(--ed-accent)' : '1px solid var(--ed-border)',
        borderRadius: 8,
        background: stylePickMode
          ? 'var(--ed-accent)'
          : 'var(--ed-surface-alt, rgba(255,255,255,0.08))',
        color: stylePickMode ? '#fff' : 'var(--ed-text-muted)',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.15s ease',
        boxShadow: stylePickMode
          ? '0 0 0 2px rgba(226,114,91,0.3)'
          : '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    </button>
  );
}
