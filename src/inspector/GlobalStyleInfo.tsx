import { useCallback, useEffect, useMemo, useState } from 'react';
import { GOOGLE_FONTS } from '@mklyml/core';
import { ColorPicker } from './style-controls/ColorPicker';
import { stepNumericValue } from './style-controls/numeric-step';
import { PresetSelect, StyleRow, inputStyle } from './StyleEditor';
import { useEditorStore } from '../store/editor-store';
import { adjustLineForStylePatch, applyStyleVariableChange, getStyleVariableValue } from '../store/block-properties';
import { resolveBlockLine } from '../store/selection-orchestrator';

interface TokenField {
  key: string;
  label: string;
  placeholder?: string;
}

const COLOR_FIELDS: TokenField[] = [
  { key: 'text', label: 'Text' },
  { key: 'muted', label: 'Muted' },
  { key: 'bg', label: 'Bg' },
  { key: 'bgSubtle', label: 'Bg Subtle' },
  { key: 'border', label: 'Border' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentHover', label: 'Acc Hover' },
];

const LENGTH_FIELDS: TokenField[] = [
  { key: 'fontSize', label: 'Font Size', placeholder: 'e.g. 1rem' },
  { key: 'lineHeight', label: 'Line Height', placeholder: 'e.g. 1.6' },
  { key: 'radius', label: 'Radius', placeholder: 'e.g. 0.625rem' },
  { key: 'spacing', label: 'Spacing', placeholder: 'e.g. 1.25rem' },
];

const FONT_FIELDS: TokenField[] = [
  { key: 'fontBody', label: 'Body Font' },
  { key: 'fontHeading', label: 'Head Font' },
  { key: 'fontMono', label: 'Mono Font' },
];

const TEXT_ALIGN_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
  { label: 'Justify', value: 'justify' },
];

const GLOBAL_LABEL_WIDTH = 72;

function DraftInput({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onCommit(draft);
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const next = stepNumericValue(draft, e.key === 'ArrowUp' ? 1 : -1, {
            shiftKey: e.shiftKey,
            altKey: e.altKey,
          });
          if (!next) return;
          e.preventDefault();
          setDraft(next);
          onCommit(next);
        }
      }}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

export function GlobalStyleInfo() {
  const source = useEditorStore((s) => s.source);
  const styleGraph = useEditorStore((s) => s.styleGraph);

  const fontOptions = useMemo(() => [
    { label: 'Default', value: '' },
    { label: 'System UI', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", group: 'System' },
    { label: 'System Serif', value: "Georgia, 'Times New Roman', serif", group: 'System' },
    { label: 'System Mono', value: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace", group: 'System' },
    ...Object.entries(GOOGLE_FONTS).map(([name, def]) => ({
      label: name,
      value: `'${name}', ${def.fallback}`,
      group: def.category,
    })),
  ], []);

  const commitVariable = useCallback((name: string, value: string) => {
    const state = useEditorStore.getState();
    const currentValue = getStyleVariableValue(state.styleGraph, name) ?? '';
    if (currentValue === value.trim()) return;

    const { newSource, newGraph, lineDelta, lineShiftFrom } = applyStyleVariableChange(
      state.source,
      state.styleGraph,
      name,
      value,
    );
    const adjustedCursor = adjustLineForStylePatch(state.cursorLine, lineDelta, lineShiftFrom);

    useEditorStore.setState((prev) => {
      const { blockLine, blockType } = resolveBlockLine(adjustedCursor, newSource);
      return {
        source: newSource,
        styleGraph: newGraph,
        cursorLine: adjustedCursor,
        activeBlockLine: blockLine,
        selection: {
          blockLine,
          blockType,
          propertyKey: prev.selection.propertyKey,
          contentRange: null,
        },
        focusOrigin: 'inspector',
        focusVersion: prev.focusVersion + 1,
        focusIntent: 'edit-property' as const,
      };
    });
  }, []);

  const getValue = useCallback((key: string): string => {
    return getStyleVariableValue(styleGraph, key) ?? '';
  }, [styleGraph]);

  return (
    <div style={{
      borderTop: '1px solid var(--ed-border)',
      padding: '0 12px 12px',
      fontSize: 12,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        marginBottom: 8,
        padding: '8px 0 0',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--ed-text-muted)',
      }}>
        Global
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {COLOR_FIELDS.map((field) => (
          <StyleRow key={field.key} label={field.label} labelWidth={GLOBAL_LABEL_WIDTH}>
            <ColorPicker
              value={getValue(field.key)}
              onChange={(next) => commitVariable(field.key, next)}
            />
          </StyleRow>
        ))}

        {FONT_FIELDS.map((field) => {
          const value = getValue(field.key);
          return (
            <StyleRow key={field.key} label={field.label} labelWidth={GLOBAL_LABEL_WIDTH}>
              <PresetSelect
                value={value}
                presets={fontOptions}
                onChange={(next) => commitVariable(field.key, next)}
              />
            </StyleRow>
          );
        })}

        <StyleRow label="Align" labelWidth={GLOBAL_LABEL_WIDTH}>
          <PresetSelect
            value={getValue('textAlign')}
            presets={TEXT_ALIGN_OPTIONS}
            onChange={(next) => commitVariable('textAlign', next)}
          />
        </StyleRow>

        {LENGTH_FIELDS.map((field) => (
          <StyleRow key={field.key} label={field.label} labelWidth={GLOBAL_LABEL_WIDTH}>
            <DraftInput
              value={getValue(field.key)}
              placeholder={field.placeholder}
              onCommit={(next) => commitVariable(field.key, next)}
            />
          </StyleRow>
        ))}
      </div>

      {source.trim() === '' ? null : (
        <div style={{
          marginTop: 8,
          fontSize: 10,
          color: 'var(--ed-text-muted)',
          lineHeight: 1.5,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          Global tokens are stored in <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>--- style</code> and applied across kits.
          <br />
          Theme/preset rules that are fully hardcoded may need explicit block/target styling instead of token overrides.
        </div>
      )}
    </div>
  );
}
