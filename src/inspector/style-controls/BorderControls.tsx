import { ColorPicker } from './ColorPicker';

const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted', 'double'];

interface BorderControlsProps {
  styles: Record<string, string>;
  onStyleChange: (prop: string, value: string) => void;
}

export function BorderControls({ styles, onStyleChange }: BorderControlsProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Width</span>
        <input
          type="text"
          value={styles['borderWidth'] ?? ''}
          onChange={(e) => onStyleChange('borderWidth', e.target.value)}
          placeholder="1px"
          style={{ flex: 1, padding: '3px 6px', border: '1px solid var(--ed-border)', borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Style</span>
        <select
          value={styles['borderStyle'] ?? ''}
          onChange={(e) => onStyleChange('borderStyle', e.target.value)}
          style={{ flex: 1, padding: '3px 4px', border: '1px solid var(--ed-border)', borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)', fontSize: 11 }}
        >
          <option value="">Default</option>
          {BORDER_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Color</span>
        <ColorPicker value={styles['borderColor'] ?? ''} onChange={(v) => onStyleChange('borderColor', v)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Radius</span>
        <input
          type="text"
          value={styles['borderRadius'] ?? ''}
          onChange={(e) => onStyleChange('borderRadius', e.target.value)}
          placeholder="4px"
          style={{ flex: 1, padding: '3px 6px', border: '1px solid var(--ed-border)', borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
        />
      </div>
    </>
  );
}
