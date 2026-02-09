interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 24, height: 24, padding: 0, border: '1px solid var(--ed-border)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        style={{ flex: 1, padding: '3px 6px', border: '1px solid var(--ed-border)', borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
      />
    </div>
  );
}
