import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { ColorPicker } from './style-controls/ColorPicker';
import { SpacingControl } from './style-controls/SpacingControl';
import { AlignmentButtons } from './style-controls/AlignmentButtons';
import {
  getStyleValue,
  DEFAULT_SELF_SECTORS,
  HOVER_SECTOR,
  TARGET_SECTORS,
} from '@mklyml/core';
import type { StyleGraph, StyleSector, StylePropertyDef, TargetInfo } from '@mklyml/core';

interface StyleEditorProps {
  blockType: string;
  label?: string;
  styleGraph: StyleGraph | null;
  computedStyles: Record<string, string>;
  targets?: Record<string, TargetInfo>;
  styleHints?: Record<string, string[]>;
  onStyleChange: (blockType: string, target: string, prop: string, value: string, label?: string) => void;
  initialTab?: string;
  defaultExpanded?: boolean;
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

export function StyleEditor({ blockType, label, styleGraph, computedStyles, targets, styleHints, onStyleChange, initialTab, defaultExpanded }: StyleEditorProps) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? 'self');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const setStyle = useCallback((prop: string, value: string) => {
    onStyleChange(blockType, activeTab, prop, value, label);
  }, [onStyleChange, blockType, activeTab, label]);

  const g = styleGraph;
  const bt = blockType;

  const targetEntries = targets ? Object.entries(targets) : [];

  // Determine which sectors to show based on the active tab
  const isHover = activeTab === 'self:hover';
  const isSelf = activeTab === 'self';
  const isTarget = !isSelf && !isHover;

  const rawSectors: StyleSector[] = isHover
    ? [HOVER_SECTOR]
    : isTarget
      ? TARGET_SECTORS
      : DEFAULT_SELF_SECTORS;

  // Filter sectors by styleHints (if provided).
  // Tag targets (">p", ">h1") skip filtering — they're ad-hoc and need all properties.
  const isTagTarget = activeTab.startsWith('>');
  const allowedProps = isTagTarget
    ? (styleHints?.['>'] ?? undefined)
    : (styleHints?.[activeTab] ?? styleHints?.['self']);
  const sectors = allowedProps
    ? filterSectors(rawSectors, allowedProps)
    : rawSectors;

  // Check if any target has active styles
  const hasAnyTargetStyles = g ? targetEntries.some(([name]) =>
    g.rules.some(r => r.blockType === bt && r.target === name && (r.label ?? undefined) === label),
  ) : false;

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
          {/* Target tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <TabButton label="Self" value="self" active={activeTab} onClick={setActiveTab} />
            <TabButton label="Hover" value="self:hover" active={activeTab} onClick={setActiveTab} />
            {targetEntries.map(([name, info]) => {
              const hasStyles = g?.rules.some(r => r.blockType === bt && r.target === name && (r.label ?? undefined) === label) ?? false;
              return (
                <TabButton
                  key={name}
                  label={info.label}
                  value={name}
                  active={activeTab}
                  onClick={setActiveTab}
                  dot={hasStyles}
                  title={info.description}
                />
              );
            })}
            {/* Dynamic tab for tag descendant targets (">p", ">p:nth-of-type(2)", etc.) */}
            {initialTab?.startsWith('>') && (
              <TabButton
                label={formatTagTab(initialTab)}
                value={initialTab}
                active={activeTab}
                onClick={setActiveTab}
                title="Style this element"
              />
            )}
            {hasAnyTargetStyles && activeTab === 'self' && (
              <span style={{ fontSize: 9, background: 'var(--ed-accent)', color: '#fff', borderRadius: 3, padding: '1px 4px', marginLeft: 'auto', alignSelf: 'center' }}>
                sub-elements active
              </span>
            )}
          </div>

          {/* Sectors */}
          {sectors.map(sector => (
            <SectorPanel key={sector.id} sector={sector}>
              {sector.properties.map(prop => (
                <PropertyControl
                  key={prop.name}
                  def={prop}
                  value={getVal(g, bt, activeTab, prop.name, label)}
                  computed={isSelf ? computedStyles[kebabToCamel(prop.name)] : undefined}
                  onChange={(v) => setStyle(prop.name, v)}
                />
              ))}
            </SectorPanel>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({ label, value, active, onClick, dot, title }: {
  label: string;
  value: string;
  active: string;
  onClick: (v: string) => void;
  dot?: boolean;
  title?: string;
}) {
  const isActive = active === value;
  return (
    <button
      onClick={() => onClick(value)}
      title={title}
      style={{
        padding: '3px 8px', border: '1px solid var(--ed-border)',
        borderRadius: 4, fontSize: 11,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: isActive ? 'var(--ed-accent)' : 'var(--ed-glass-bg)',
        color: isActive ? '#fff' : 'var(--ed-text)',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {label}
      {dot && !isActive && (
        <span style={{
          position: 'absolute', top: -2, right: -2,
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--ed-accent)',
        }} />
      )}
    </button>
  );
}

const EXPANDED_BY_DEFAULT = new Set(['Typography', 'Background']);

function SectorPanel({ sector, children }: { sector: StyleSector; children: ReactNode }) {
  const [expanded, setExpanded] = useState(EXPANDED_BY_DEFAULT.has(sector.label));

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          width: '100%', padding: 0, border: 'none',
          background: 'transparent', cursor: 'pointer',
          fontSize: 10, fontWeight: 600, color: 'var(--ed-text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
          marginBottom: expanded ? 6 : 0,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <span style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', fontSize: 8 }}>&#9660;</span>
        {sector.label}
      </button>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function PropertyControl({ def, value, computed, onChange }: {
  def: StylePropertyDef;
  value: string;
  computed?: string;
  onChange: (v: string) => void;
}) {
  switch (def.type) {
    case 'color':
      return (
        <StyleRow label={def.label}>
          <ColorPicker value={value} computed={computed} onChange={onChange} />
        </StyleRow>
      );

    case 'spacing':
      return (
        <SpacingControl label={def.label} value={value} computed={computed} onChange={onChange} />
      );

    case 'alignment':
      return (
        <AlignmentButtons value={value} onChange={onChange} />
      );

    case 'select':
      return (
        <StyleRow label={def.label}>
          <PresetSelect
            value={value}
            presets={def.options ?? []}
            onChange={onChange}
          />
        </StyleRow>
      );

    case 'slider': {
      const scale = def.scale ?? 1;
      const defaultVal = scale === 100 ? '1' : '0';
      const sliderVal = Math.round(parseFloat(value || defaultVal) * scale);
      return (
        <StyleRow label={def.label}>
          <input
            type="range"
            min={def.min ?? 0}
            max={def.max ?? 100}
            value={sliderVal}
            onChange={(e) => onChange((parseInt(e.target.value) / scale).toString())}
            style={{ width: '100%' }}
          />
        </StyleRow>
      );
    }

    case 'text':
      return (
        <StyleRow label={def.label}>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={computed || def.placeholder || ''}
            style={inputStyle}
          />
        </StyleRow>
      );

    default:
      return null;
  }
}

function StyleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 60, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
      {children}
    </div>
  );
}

function PresetSelect({ value, presets, onChange }: { value: string; presets: Array<{ label: string; value: string; group?: string }>; onChange: (v: string) => void }) {
  const isCustom = value !== '' && !presets.some(p => p.value === value);
  const hasGroups = presets.some(p => p.group);

  if (!hasGroups) {
    return (
      <select
        value={isCustom ? '__custom__' : value}
        onChange={(e) => onChange(e.target.value === '__custom__' ? value : e.target.value)}
        style={selectStyle}
      >
        {presets.map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
        {isCustom && <option value="__custom__">Custom: {value}</option>}
      </select>
    );
  }

  // Group presets by category for <optgroup> rendering
  const grouped: { group: string; items: typeof presets }[] = [];
  const ungrouped: typeof presets = [];
  const groupMap = new Map<string, typeof presets>();
  for (const p of presets) {
    if (p.group) {
      let arr = groupMap.get(p.group);
      if (!arr) { arr = []; groupMap.set(p.group, arr); grouped.push({ group: p.group, items: arr }); }
      arr.push(p);
    } else {
      ungrouped.push(p);
    }
  }

  return (
    <select
      value={isCustom ? '__custom__' : value}
      onChange={(e) => onChange(e.target.value === '__custom__' ? value : e.target.value)}
      style={selectStyle}
    >
      {ungrouped.map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
      {grouped.map(g => (
        <optgroup key={g.group} label={g.group}>
          {g.items.map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
        </optgroup>
      ))}
      {isCustom && <option value="__custom__">Custom: {value}</option>}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVal(graph: StyleGraph | null, blockType: string, target: string, prop: string, label?: string): string {
  if (!graph) return '';
  return getStyleValue(graph, blockType, target, prop, label) ?? '';
}

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Filter sectors to only include properties in the allowed list. Drops empty sectors. */
function filterSectors(sectors: StyleSector[], allowed: string[]): StyleSector[] {
  const set = new Set(allowed);
  const result: StyleSector[] = [];
  for (const sector of sectors) {
    const filtered = sector.properties.filter(p => set.has(p.name));
    if (filtered.length > 0) {
      result.push(filtered.length === sector.properties.length
        ? sector
        : { ...sector, properties: filtered });
    }
  }
  return result;
}

/** Format a descendant target for tab display: ">p" → "<p>", ">.s1" → ".s1", ">p:nth-of-type(2)" → "<p>#2" */
function formatTagTab(target: string): string {
  const raw = target.slice(1);
  // Class target: ".s1" → ".s1"
  if (raw.startsWith('.')) return raw;
  const nthMatch = raw.match(/^(\w+):nth-of-type\((\d+)\)$/);
  if (nthMatch) return `<${nthMatch[1]}>#${nthMatch[2]}`;
  return `<${raw}>`;
}

export { StyleRow };
