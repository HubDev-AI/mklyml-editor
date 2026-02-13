interface ColorPickerProps {
  value: string;
  computed?: string;
  onChange: (value: string) => void;
}

/** Convert rgb(r, g, b) or rgba(r, g, b, a) to #rrggbb hex */
function rgbToHex(rgb: string): string | undefined {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return undefined;
  const [, r, g, b] = m;
  return '#' + [r, g, b].map(c => parseInt(c!, 10).toString(16).padStart(2, '0')).join('');
}

function isTransparent(color: string): boolean {
  if (!color) return true;
  const c = color.trim().toLowerCase();
  return c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'rgba(0,0,0,0)';
}

const CHECKER = 'repeating-conic-gradient(#ddd 0% 25%, transparent 0% 50%) 50% / 8px 8px';

export function ColorPicker({ value, computed, onChange }: ColorPickerProps) {
  const hasValue = value !== '' && value !== undefined;
  const computedHex = computed ? rgbToHex(computed) : undefined;
  const computedIsTransparent = computed ? isTransparent(computed) : true;

  // For the native color input: use explicit value, or computed fallback, or transparent
  const swatchColor = hasValue ? value : (computedHex ?? '');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: 24, height: 24, flexShrink: 0 }}>
        {/* Checkerboard background for when color is transparent/empty */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 4,
          background: (!hasValue && computedIsTransparent) ? CHECKER : 'none',
          border: '1px solid var(--ed-border)',
        }} />
        <input
          type="color"
          value={swatchColor || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer',
            background: 'transparent',
            opacity: (hasValue || !computedIsTransparent) ? 1 : 0,
          }}
        />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={computedHex ?? ''}
        style={{
          flex: 1, padding: '3px 6px', border: '1px solid var(--ed-border)',
          borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)',
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
        }}
      />
    </div>
  );
}
