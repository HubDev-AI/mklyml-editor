import type { CSSProperties } from 'react';

interface SpacingControlProps {
  label: string;
  value: string;
  computed?: string;
  onChange: (value: string) => void;
}

export function SpacingControl({ label, value, computed, onChange }: SpacingControlProps) {
  const hasValue = value !== '';

  const parts = hasValue ? (value || '0').split(/\s+/) : [];
  const top = hasValue ? (parts[0] ?? '0') : '';
  const right = hasValue ? (parts[1] ?? top) : '';
  const bottom = hasValue ? (parts[2] ?? top) : '';
  const left = hasValue ? (parts[3] ?? right) : '';

  // Parse computed values for placeholders
  const cParts = (computed || '0px').split(/\s+/);
  const cTop = cParts[0] ?? '0px';
  const cRight = cParts[1] ?? cTop;
  const cBottom = cParts[2] ?? cTop;
  const cLeft = cParts[3] ?? cRight;

  const update = (side: number, v: string) => {
    const vals = [top || '0', right || '0', bottom || '0', left || '0'];
    vals[side] = v || '0';
    if (vals.every(x => x === '0')) {
      onChange('');
      return;
    }
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
        <input style={inputStyle} value={top} onChange={(e) => update(0, e.target.value)} placeholder={cTop} />
        <div style={{ display: 'flex', gap: 16 }}>
          <input style={inputStyle} value={left} onChange={(e) => update(3, e.target.value)} placeholder={cLeft} />
          <input style={inputStyle} value={right} onChange={(e) => update(1, e.target.value)} placeholder={cRight} />
        </div>
        <input style={inputStyle} value={bottom} onChange={(e) => update(2, e.target.value)} placeholder={cBottom} />
      </div>
    </div>
  );
}
