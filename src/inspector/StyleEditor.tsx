import { useState, useCallback } from 'react';
import { ColorPicker } from './style-controls/ColorPicker';
import { SpacingControl } from './style-controls/SpacingControl';
import { AlignmentButtons } from './style-controls/AlignmentButtons';
import { FontControls } from './style-controls/FontControls';
import { BorderControls } from './style-controls/BorderControls';

interface StyleEditorProps {
  properties: Record<string, string>;
  onPropertyChange: (key: string, value: string) => void;
}

const DISPLAY_OPTIONS = ['block', 'inline', 'inline-block', 'flex', 'grid', 'none'];

const ANIMATION_PRESETS = [
  { label: 'None', value: '' },
  { label: 'Fade In', value: 'fadeIn 0.5s ease' },
  { label: 'Slide Up', value: 'slideUp 0.5s ease' },
  { label: 'Slide Down', value: 'slideDown 0.5s ease' },
  { label: 'Scale In', value: 'scaleIn 0.3s ease' },
  { label: 'Bounce', value: 'bounce 0.6s ease' },
  { label: 'Pulse', value: 'pulse 2s infinite' },
  { label: 'Shake', value: 'shake 0.5s ease' },
];

const TRANSITION_PRESETS = [
  { label: 'None', value: '' },
  { label: 'All 0.2s', value: 'all 0.2s ease' },
  { label: 'All 0.3s', value: 'all 0.3s ease' },
  { label: 'All 0.5s', value: 'all 0.5s ease' },
  { label: 'Transform 0.2s', value: 'transform 0.2s ease' },
  { label: 'Opacity 0.3s', value: 'opacity 0.3s ease' },
  { label: 'Colors 0.2s', value: 'color 0.2s, background-color 0.2s' },
];

const HOVER_SCALE_OPTIONS = [
  { label: 'None', value: '' },
  { label: 'Grow', value: 'scale(1.05)' },
  { label: 'Shrink', value: 'scale(0.95)' },
  { label: 'Lift', value: 'translateY(-2px)' },
  { label: 'Push', value: 'translateY(1px)' },
];

const CURSOR_OPTIONS = ['default', 'pointer', 'grab', 'text', 'not-allowed', 'crosshair'];

export function StyleEditor({ properties, onPropertyChange }: StyleEditorProps) {
  const [collapsed, setCollapsed] = useState(false);

  const styles: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (key.startsWith('@')) {
      styles[key.slice(1)] = value;
    }
  }

  const setStyle = useCallback((prop: string, value: string) => {
    onPropertyChange(`@${prop}`, value);
  }, [onPropertyChange]);

  return (
    <div style={{ borderTop: '1px solid var(--ed-border)', padding: '0 12px' }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '8px 0', border: 'none',
          background: 'transparent', color: 'var(--ed-text)',
          cursor: 'pointer', fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.05em',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <span style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', fontSize: 10 }}>&#9660;</span>
        Styles
      </button>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}>
          <StyleGroup label="Layout">
            <StyleRow label="Display">
              <select
                value={styles['display'] ?? ''}
                onChange={(e) => setStyle('display', e.target.value)}
                style={selectStyle}
              >
                <option value="">Default</option>
                {DISPLAY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </StyleRow>
            <AlignmentButtons value={styles['textAlign'] ?? ''} onChange={(v) => setStyle('textAlign', v)} />
            <StyleRow label="Cursor">
              <select
                value={styles['cursor'] ?? ''}
                onChange={(e) => setStyle('cursor', e.target.value)}
                style={selectStyle}
              >
                <option value="">Default</option>
                {CURSOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </StyleRow>
            <StyleRow label="Overflow">
              <select
                value={styles['overflow'] ?? ''}
                onChange={(e) => setStyle('overflow', e.target.value)}
                style={selectStyle}
              >
                <option value="">Default</option>
                <option value="hidden">hidden</option>
                <option value="auto">auto</option>
                <option value="scroll">scroll</option>
                <option value="visible">visible</option>
              </select>
            </StyleRow>
          </StyleGroup>

          <StyleGroup label="Spacing">
            <SpacingControl label="Padding" value={styles['padding'] ?? ''} onChange={(v) => setStyle('padding', v)} />
            <SpacingControl label="Margin" value={styles['margin'] ?? ''} onChange={(v) => setStyle('margin', v)} />
          </StyleGroup>

          <StyleGroup label="Typography">
            <FontControls styles={styles} onStyleChange={setStyle} />
          </StyleGroup>

          <StyleGroup label="Background">
            <StyleRow label="Color">
              <ColorPicker value={styles['bg'] ?? styles['backgroundColor'] ?? ''} onChange={(v) => setStyle('bg', v)} />
            </StyleRow>
          </StyleGroup>

          <StyleGroup label="Border">
            <BorderControls styles={styles} onStyleChange={setStyle} />
          </StyleGroup>

          <StyleGroup label="Effects">
            <StyleRow label="Opacity">
              <input
                type="range" min="0" max="100"
                value={Math.round(parseFloat(styles['opacity'] ?? '1') * 100)}
                onChange={(e) => setStyle('opacity', (parseInt(e.target.value) / 100).toString())}
                style={{ width: '100%' }}
              />
            </StyleRow>
            <StyleRow label="Shadow">
              <select
                value={styles['boxShadow'] ?? ''}
                onChange={(e) => setStyle('boxShadow', e.target.value)}
                style={selectStyle}
              >
                <option value="">None</option>
                <option value="0 1px 3px rgba(0,0,0,0.12)">Subtle</option>
                <option value="0 2px 8px rgba(0,0,0,0.15)">Small</option>
                <option value="0 4px 16px rgba(0,0,0,0.12)">Medium</option>
                <option value="0 8px 32px rgba(0,0,0,0.15)">Large</option>
                <option value="0 16px 48px rgba(0,0,0,0.2)">XL</option>
              </select>
            </StyleRow>
            <StyleRow label="Transform">
              <input
                type="text"
                value={styles['transform'] ?? ''}
                onChange={(e) => setStyle('transform', e.target.value)}
                placeholder="e.g. rotate(5deg)"
                style={inputStyle}
              />
            </StyleRow>
          </StyleGroup>

          <StyleGroup label="Animation">
            <StyleRow label="Animate">
              <select
                value={styles['animation'] ?? ''}
                onChange={(e) => setStyle('animation', e.target.value)}
                style={selectStyle}
              >
                {ANIMATION_PRESETS.map(a => <option key={a.label} value={a.value}>{a.label}</option>)}
              </select>
            </StyleRow>
            <StyleRow label="Transition">
              <select
                value={styles['transition'] ?? ''}
                onChange={(e) => setStyle('transition', e.target.value)}
                style={selectStyle}
              >
                {TRANSITION_PRESETS.map(t => <option key={t.label} value={t.value}>{t.label}</option>)}
              </select>
            </StyleRow>
          </StyleGroup>

          <StyleGroup label="Hover">
            <StyleRow label="Scale">
              <select
                value={styles['.self:hover/transform'] ?? ''}
                onChange={(e) => setStyle('.self:hover/transform', e.target.value)}
                style={selectStyle}
              >
                {HOVER_SCALE_OPTIONS.map(h => <option key={h.label} value={h.value}>{h.label}</option>)}
              </select>
            </StyleRow>
            <StyleRow label="Opacity">
              <select
                value={styles['.self:hover/opacity'] ?? ''}
                onChange={(e) => setStyle('.self:hover/opacity', e.target.value)}
                style={selectStyle}
              >
                <option value="">Default</option>
                <option value="0.8">80%</option>
                <option value="0.6">60%</option>
                <option value="0.4">40%</option>
              </select>
            </StyleRow>
            <StyleRow label="Bg">
              <ColorPicker
                value={styles['.self:hover/backgroundColor'] ?? ''}
                onChange={(v) => setStyle('.self:hover/backgroundColor', v)}
              />
            </StyleRow>
            <StyleRow label="Shadow">
              <select
                value={styles['.self:hover/boxShadow'] ?? ''}
                onChange={(e) => setStyle('.self:hover/boxShadow', e.target.value)}
                style={selectStyle}
              >
                <option value="">None</option>
                <option value="0 4px 16px rgba(0,0,0,0.15)">Medium</option>
                <option value="0 8px 32px rgba(0,0,0,0.2)">Large</option>
                <option value="0 16px 48px rgba(0,0,0,0.25)">XL</option>
              </select>
            </StyleRow>
          </StyleGroup>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  flex: 1, padding: '3px 4px', border: '1px solid var(--ed-border)',
  borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)',
  fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '3px 6px', border: '1px solid var(--ed-border)',
  borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)',
  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
};

function StyleGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ed-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function StyleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
      {children}
    </div>
  );
}

export { StyleRow };
