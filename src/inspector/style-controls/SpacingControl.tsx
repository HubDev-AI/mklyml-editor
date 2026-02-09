import type { CSSProperties } from 'react';

interface SpacingControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function SpacingControl({ label, value, onChange }: SpacingControlProps) {
  const parts = (value || '0').split(/\s+/);
  const top = parts[0] ?? '0';
  const right = parts[1] ?? top;
  const bottom = parts[2] ?? top;
  const left = parts[3] ?? right;

  const update = (side: number, v: string) => {
    const vals = [top, right, bottom, left];
    vals[side] = v || '0';
    if (vals.every(x => x === vals[0])) {
      onChange(vals[0]);
    } else if (vals[0] === vals[2] && vals[1] === vals[3]) {
      onChange(`${vals[0]} ${vals[1]}`);
    } else {
      onChange(vals.join(' '));
    }
  };

  const inputStyle: CSSProperties = {
    width: 36, textAlign: 'center', padding: '2px 2px',
    border: '1px solid var(--ed-border)', borderRadius: 3,
    background: 'var(--ed-glass-bg)', color: 'var(--ed-text)',
    fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
  };

  return (
    <div>
      <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 4, padding: 4, border: '1px dashed var(--ed-border)', borderRadius: 4 }}>
        <input style={inputStyle} value={top} onChange={(e) => update(0, e.target.value)} placeholder="0" />
        <div style={{ display: 'flex', gap: 16 }}>
          <input style={inputStyle} value={left} onChange={(e) => update(3, e.target.value)} placeholder="0" />
          <input style={inputStyle} value={right} onChange={(e) => update(1, e.target.value)} placeholder="0" />
        </div>
        <input style={inputStyle} value={bottom} onChange={(e) => update(2, e.target.value)} placeholder="0" />
      </div>
    </div>
  );
}
