import { useEditorStore } from '../store/editor-store';

/**
 * Style pick mode toggle — prominent button with icon + label.
 * Designed to sit in the GlassToolbar between the left and right groups.
 */
export function StylePickToggle() {
  const stylePickMode = useEditorStore((s) => s.stylePickMode);
  const setStylePickMode = useEditorStore((s) => s.setStylePickMode);

  return (
    <button
      onClick={() => setStylePickMode(!stylePickMode)}
      title={stylePickMode ? 'Exit style picker' : 'Click any element to style it'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 14px 5px 10px',
        border: 'none',
        borderRadius: 9999,
        background: stylePickMode
          ? 'var(--ed-accent)'
          : 'linear-gradient(135deg, rgba(226,114,91,0.12), rgba(226,114,91,0.04))',
        color: stylePickMode ? '#fff' : 'var(--ed-accent)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: '-0.01em',
        lineHeight: '18px',
        transition: 'all 0.2s ease',
        boxShadow: stylePickMode
          ? '0 0 0 2px rgba(226,114,91,0.3), 0 2px 8px rgba(226,114,91,0.25)'
          : '0 0 0 1px rgba(226,114,91,0.2)',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Wand / magic icon */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4V2" />
        <path d="M15 16v-2" />
        <path d="M8 9h2" />
        <path d="M20 9h2" />
        <path d="M17.8 11.8 19 13" />
        <path d="M15 9h.01" />
        <path d="M17.8 6.2 19 5" />
        <path d="m3 21 9-9" />
        <path d="M12.2 6.2 11 5" />
      </svg>
      {stylePickMode ? 'Styling...' : 'Style'}
    </button>
  );
}
