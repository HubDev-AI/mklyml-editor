interface EmptyStateProps {
  onInsertBlock: (blockType: string) => void;
}

const STARTER_BLOCKS = [
  { type: 'core/heading', label: 'Heading' },
  { type: 'core/text', label: 'Text' },
  { type: 'core/image', label: 'Image' },
  { type: 'core/button', label: 'Button' },
  { type: 'core/divider', label: 'Divider' },
  { type: 'core/spacer', label: 'Spacer' },
];

export function EmptyState({ onInsertBlock }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      padding: 32,
      gap: 16,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--ed-text)',
      }}>
        Start building your document
      </div>
      <div style={{
        fontSize: 13,
        color: 'var(--ed-text-muted)',
        textAlign: 'center',
        maxWidth: 300,
      }}>
        Pick a block to begin, or type in the editor
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
        marginTop: 8,
      }}>
        {STARTER_BLOCKS.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => onInsertBlock(type)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--ed-border)',
              background: 'var(--ed-glass-bg)',
              color: 'var(--ed-text)',
              fontSize: 12,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--ed-accent)';
              e.currentTarget.style.background = 'var(--ed-accent-bg, rgba(234,114,91,0.1))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--ed-border)';
              e.currentTarget.style.background = 'var(--ed-glass-bg)';
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
