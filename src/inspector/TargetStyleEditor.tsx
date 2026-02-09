import { useState, useCallback } from 'react';
import { StyleRow } from './StyleEditor';
import { SpacingControl } from './style-controls/SpacingControl';
import { ColorPicker } from './style-controls/ColorPicker';
import { AlignmentButtons } from './style-controls/AlignmentButtons';
import type { TargetInfo } from '@milkly/mkly';

interface TargetStyleEditorProps {
  targets: Record<string, TargetInfo>;
  properties: Record<string, string>;
  onPropertyChange: (key: string, value: string) => void;
}

export function TargetStyleEditor({ targets, properties, onPropertyChange }: TargetStyleEditorProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [activeTarget, setActiveTarget] = useState<string | null>(null);

  const targetEntries = Object.entries(targets);
  if (targetEntries.length === 0) return null;

  const getTargetStyles = (target: string): Record<string, string> => {
    const styles: Record<string, string> = {};
    const prefix = `@${target}/`;
    for (const [key, value] of Object.entries(properties)) {
      if (key.startsWith(prefix)) {
        styles[key.slice(prefix.length)] = value;
      }
    }
    return styles;
  };

  const setTargetStyle = (target: string, prop: string, value: string) => {
    onPropertyChange(`@${target}/${prop}`, value);
  };

  const hasAnyTargetStyles = targetEntries.some(([name]) => {
    const prefix = `@${name}/`;
    return Object.keys(properties).some(k => k.startsWith(prefix));
  });

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
        Sub-Elements
        {hasAnyTargetStyles && (
          <span style={{ fontSize: 9, background: 'var(--ed-accent)', color: '#fff', borderRadius: 3, padding: '1px 4px', marginLeft: 'auto' }}>
            active
          </span>
        )}
      </button>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {targetEntries.map(([name, info]) => {
              const isActive = activeTarget === name;
              const hasStyles = Object.keys(properties).some(k => k.startsWith(`@${name}/`));
              return (
                <button
                  key={name}
                  onClick={() => setActiveTarget(isActive ? null : name)}
                  title={info.description}
                  style={{
                    padding: '3px 8px', border: '1px solid var(--ed-border)',
                    borderRadius: 4, fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    background: isActive ? 'var(--ed-accent)' : 'var(--ed-glass-bg)',
                    color: isActive ? '#fff' : 'var(--ed-text)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {info.label}
                  {hasStyles && !isActive && (
                    <span style={{
                      position: 'absolute', top: -2, right: -2,
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--ed-accent)',
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {activeTarget && (
            <TargetPanel
              name={activeTarget}
              info={targets[activeTarget]}
              styles={getTargetStyles(activeTarget)}
              onStyleChange={(prop, value) => setTargetStyle(activeTarget, prop, value)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TargetPanel({ name, info, styles, onStyleChange }: {
  name: string;
  info: TargetInfo;
  styles: Record<string, string>;
  onStyleChange: (prop: string, value: string) => void;
}) {
  return (
    <div style={{
      border: '1px solid var(--ed-border)',
      borderRadius: 6,
      padding: '8px 10px',
      background: 'var(--ed-glass-bg)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--ed-text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        {info.label} <span style={{ opacity: 0.5, fontWeight: 400 }}>@{name}/</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SpacingControl label="Margin" value={styles['margin'] ?? ''} onChange={(v) => onStyleChange('margin', v)} />
        <SpacingControl label="Padding" value={styles['padding'] ?? ''} onChange={(v) => onStyleChange('padding', v)} />
        <AlignmentButtons value={styles['textAlign'] ?? ''} onChange={(v) => onStyleChange('textAlign', v)} />
        <StyleRow label="Color">
          <ColorPicker value={styles['color'] ?? ''} onChange={(v) => onStyleChange('color', v)} />
        </StyleRow>
        <StyleRow label="Radius">
          <input
            type="text"
            value={styles['borderRadius'] ?? ''}
            onChange={(e) => onStyleChange('borderRadius', e.target.value)}
            placeholder="e.g. 8px"
            style={{
              flex: 1, padding: '3px 6px', border: '1px solid var(--ed-border)',
              borderRadius: 4, background: 'var(--ed-glass-bg)', color: 'var(--ed-text)',
              fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
            }}
          />
        </StyleRow>
        <StyleRow label="Opacity">
          <input
            type="range" min="0" max="100"
            value={Math.round(parseFloat(styles['opacity'] ?? '1') * 100)}
            onChange={(e) => onStyleChange('opacity', (parseInt(e.target.value) / 100).toString())}
            style={{ width: '100%' }}
          />
        </StyleRow>
      </div>
    </div>
  );
}
