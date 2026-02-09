interface AlignmentButtonsProps {
  value: string;
  onChange: (value: string) => void;
}

const alignments = [
  { value: 'left', label: 'left' },
  { value: 'center', label: 'center' },
  { value: 'right', label: 'right' },
  { value: 'justify', label: 'justify' },
];

export function AlignmentButtons({ value, onChange }: AlignmentButtonsProps) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {alignments.map((a) => (
        <button
          key={a.value}
          title={a.value}
          onClick={() => onChange(a.value)}
          style={{
            flex: 1, padding: '4px 0', border: '1px solid var(--ed-border)',
            borderRadius: 4, background: value === a.value ? 'var(--ed-accent)' : 'var(--ed-glass-bg)',
            color: value === a.value ? 'white' : 'var(--ed-text)', cursor: 'pointer',
            fontSize: 9, fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
