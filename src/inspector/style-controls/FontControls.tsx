import { ColorPicker } from './ColorPicker';

const FONT_FAMILIES = [
  { label: 'System', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: "'JetBrains Mono', 'Fira Code', monospace" },
  { label: 'Sans', value: "'Inter', 'Helvetica Neue', sans-serif" },
];

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '40', '48'];

const FONT_WEIGHTS = [
  { label: 'Normal', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: '700' },
];

interface FontControlsProps {
  styles: Record<string, string>;
  computedStyles?: Record<string, string>;
  onStyleChange: (prop: string, value: string) => void;
}

function computedFontLabel(computed: string | undefined): string {
  if (!computed) return '';
  // Shorten long font stacks to first family name
  const first = computed.split(',')[0]?.trim().replace(/^["']|["']$/g, '') ?? '';
  return first;
}

export function FontControls({ styles, computedStyles = {}, onStyleChange }: FontControlsProps) {
  const cFont = computedFontLabel(computedStyles['fontFamily']);
  const cSize = computedStyles['fontSize'] ?? '';
  const cWeight = computedStyles['fontWeight'] ?? '';
  const cHeight = computedStyles['lineHeight'] ?? '';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Font</span>
        <select
          value={styles['fontFamily'] ?? ''}
          onChange={(e) => onStyleChange('fontFamily', e.target.value)}
          style={{ flex: 1, padding: '3px 4px', border: '1px solid var(--ed-border)', borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)', fontSize: 11 }}
        >
          <option value="">{cFont ? `Inherited (${cFont})` : 'Default'}</option>
          {FONT_FAMILIES.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Size</span>
        <select
          value={styles['fontSize']?.replace('px', '') ?? ''}
          onChange={(e) => onStyleChange('fontSize', `${e.target.value}px`)}
          style={{ flex: 1, padding: '3px 4px', border: '1px solid var(--ed-border)', borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)', fontSize: 11 }}
        >
          <option value="">{cSize ? `Inherited (${cSize})` : 'Default'}</option>
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Weight</span>
        <select
          value={styles['fontWeight'] ?? ''}
          onChange={(e) => onStyleChange('fontWeight', e.target.value)}
          style={{ flex: 1, padding: '3px 4px', border: '1px solid var(--ed-border)', borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)', fontSize: 11 }}
        >
          <option value="">{cWeight ? `Inherited (${cWeight})` : 'Default'}</option>
          {FONT_WEIGHTS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Color</span>
        <ColorPicker value={styles['color'] ?? ''} computed={computedStyles['color']} onChange={(v) => onStyleChange('color', v)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Height</span>
        <input
          type="text"
          value={styles['lineHeight'] ?? ''}
          onChange={(e) => onStyleChange('lineHeight', e.target.value)}
          placeholder={cHeight || '1.6'}
          style={{ flex: 1, padding: '3px 6px', border: '1px solid var(--ed-border)', borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
        />
      </div>
    </>
  );
}
