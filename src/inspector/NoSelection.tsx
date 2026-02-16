export function NoSelection() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: 24,
      textAlign: 'center',
      gap: 8,
    }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="var(--ed-text-muted)" strokeWidth="1.5" strokeLinecap="round" opacity={0.4}>
        <rect x="4" y="6" width="24" height="20" rx="3" />
        <line x1="10" y1="12" x2="22" y2="12" />
        <line x1="10" y1="16" x2="18" y2="16" />
        <line x1="10" y1="20" x2="20" y2="20" />
      </svg>
      <span style={{
        fontSize: 12,
        color: 'var(--ed-text-muted)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        Place cursor in a block to inspect properties
      </span>
    </div>
  );
}
