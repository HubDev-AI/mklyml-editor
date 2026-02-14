import { useCallback, useMemo, useState } from 'react';
import type { CompletionData } from '@milkly/mkly';
import { useEditorStore } from '../store/editor-store';

/** Parse the gapScale value from a `--- style` block in mkly source. */
function parseGapScale(source: string): number {
  const lines = source.split('\n');
  let inStyleBlock = false;
  for (const line of lines) {
    if (/^---\s+style\b/.test(line)) {
      inStyleBlock = true;
      continue;
    }
    if (inStyleBlock) {
      // Style block ends at next `---` directive or blank line
      if (/^---\s/.test(line) || line.trim() === '') {
        inStyleBlock = false;
        continue;
      }
      // Match gapScale property (indented or not, skip comments)
      const m = line.match(/^\s*gapScale:\s*(.+)$/);
      if (m) {
        const val = parseFloat(m[1].trim());
        if (!isNaN(val)) return val;
      }
    }
  }
  return 1;
}

/** Update or insert gapScale in the source's `--- style` block. */
function writeGapScale(source: string, value: number): string {
  const lines = source.split('\n');
  const isDefault = Math.abs(value - 1) < 0.001;

  // Find the style block
  let styleBlockStart = -1;
  let styleBlockEnd = -1; // index of last property line in the block
  let gapScaleLine = -1;
  let blockIndent = '    '; // default to 4-space indent for new properties

  for (let i = 0; i < lines.length; i++) {
    if (/^---\s+style\b/.test(lines[i])) {
      styleBlockStart = i;
      // Scan properties
      for (let j = i + 1; j < lines.length; j++) {
        const ln = lines[j];
        if (/^---\s/.test(ln) || ln.trim() === '') {
          break;
        }
        styleBlockEnd = j;
        // Detect indentation of existing properties
        const indentMatch = ln.match(/^(\s*)\S/);
        if (indentMatch) {
          blockIndent = indentMatch[1];
        }
        if (/^\s*gapScale:/.test(ln)) {
          gapScaleLine = j;
        }
      }
      break;
    }
  }

  // Case 1: gapScale line exists
  if (gapScaleLine !== -1) {
    if (isDefault) {
      // Remove the line
      lines.splice(gapScaleLine, 1);
    } else {
      lines[gapScaleLine] = `${blockIndent}gapScale: ${value}`;
    }
    return lines.join('\n');
  }

  // Case 2: style block exists but no gapScale (and not default)
  if (styleBlockStart !== -1 && !isDefault) {
    const insertAt = styleBlockEnd !== -1 ? styleBlockEnd + 1 : styleBlockStart + 1;
    lines.splice(insertAt, 0, `${blockIndent}gapScale: ${value}`);
    return lines.join('\n');
  }

  // Case 3: no style block (and not default) — create one
  if (styleBlockStart === -1 && !isDefault) {
    // Insert after last preset/theme/use directive
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^---\s+(preset|theme|use):\s/.test(lines[i])) {
        insertIdx = i + 1;
      }
    }
    lines.splice(insertIdx, 0, `--- style`, `    gapScale: ${value}`, '');
    return lines.join('\n');
  }

  // Default value and no existing line — nothing to do
  return source;
}

interface PresetInfoProps {
  activePresets: string[];
  completionData: CompletionData;
}

export function PresetInfo({ activePresets, completionData }: PresetInfoProps) {
  const source = useEditorStore((s) => s.source);
  const setSource = useEditorStore((s) => s.setSource);
  const availablePresets = completionData.presets;
  const [showGapHelp, setShowGapHelp] = useState(false);

  const implicitPresets = useMemo(() => {
    if (activePresets.length > 0) return [];
    const defaults: string[] = [];
    for (const line of source.split('\n')) {
      const match = line.match(/^---\s+use:\s*(.+)$/);
      if (match) {
        const kitName = match[1].trim();
        const info = completionData.kitInfo.get(kitName);
        if (info?.defaultPreset) {
          defaults.push(info.defaultPreset);
        }
      }
    }
    return defaults;
  }, [activePresets, source, completionData.kitInfo]);

  const gapScale = useMemo(() => parseGapScale(source), [source]);

  const hasActivePreset = activePresets.length > 0 || implicitPresets.length > 0;

  const handleGapScaleChange = useCallback((value: number) => {
    const src = useEditorStore.getState().source;
    setSource(writeGapScale(src, value));
  }, [setSource]);

  const handleGapScaleReset = useCallback(() => {
    const src = useEditorStore.getState().source;
    setSource(writeGapScale(src, 1));
  }, [setSource]);

  const updatePresets = useCallback((newPresets: string[]) => {
    const src = useEditorStore.getState().source;
    const lines = src.split('\n');

    const filtered = lines.filter((l) => !l.match(/^---\s+preset:\s/));

    let insertIdx = 0;
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i].match(/^---\s+theme:\s/) || filtered[i].match(/^---\s+use:\s/)) {
        insertIdx = i + 1;
      }
    }

    const presetLines = newPresets.map((p) => `--- preset: ${p}`);
    filtered.splice(insertIdx, 0, ...presetLines);

    setSource(filtered.join('\n'));
  }, [setSource]);

  const handleAdd = useCallback(() => {
    const next = availablePresets.find((p) => !activePresets.includes(p.label));
    if (next) {
      updatePresets([...activePresets, next.label]);
    }
  }, [activePresets, availablePresets, updatePresets]);

  const handleRemove = useCallback((name: string) => {
    updatePresets(activePresets.filter((p) => p !== name));
  }, [activePresets, updatePresets]);

  const handleChange = useCallback((oldName: string, newName: string) => {
    updatePresets(activePresets.map((p) => (p === oldName ? newName : p)));
  }, [activePresets, updatePresets]);

  const handleMakeExplicit = useCallback((presetName: string) => {
    updatePresets([presetName]);
  }, [updatePresets]);

  if (availablePresets.length === 0) return null;

  return (
    <div style={{
      borderTop: '1px solid var(--ed-border)',
      padding: '12px 14px',
      fontSize: 12,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--ed-text-muted)',
        }}>
          Document Presets
        </span>
        <button
          onClick={handleAdd}
          title="Add preset"
          style={{
            background: 'none',
            border: '1px solid var(--ed-border)',
            borderRadius: 4,
            color: 'var(--ed-text-muted)',
            cursor: 'pointer',
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
          }}
        >
          +
        </button>
      </div>

      {activePresets.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activePresets.map((name) => (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <select
                value={name}
                onChange={(e) => handleChange(name, e.target.value)}
                title={availablePresets.find((p) => p.label === name)?.description}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'var(--ed-surface)',
                  color: 'var(--ed-text)',
                  border: '1px solid var(--ed-border)',
                  borderRadius: 4,
                  padding: '3px 6px',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                }}
              >
                {availablePresets.map((p) => (
                  <option key={p.label} value={p.label} title={p.label}>
                    {p.description}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleRemove(name)}
                title="Remove preset"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ed-text-muted)',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: '0 2px',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : implicitPresets.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {implicitPresets.map((name) => {
            const item = availablePresets.find((p) => p.label === name);
            return (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 6px',
                background: 'var(--ed-surface)',
                border: '1px dashed var(--ed-border)',
                borderRadius: 4,
                fontSize: 11,
                color: 'var(--ed-text-muted)',
                cursor: 'pointer',
              }}
              onClick={() => handleMakeExplicit(name)}
              title={`${name} — click to make explicit`}
            >
              <span style={{ flex: 1 }}>{item?.description ?? name}</span>
              <span style={{
                fontSize: 9,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                opacity: 0.7,
                fontStyle: 'italic',
              }}>
                auto
              </span>
            </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: 'var(--ed-text-muted)', fontStyle: 'italic', fontSize: 11 }}>
          No preset — unstyled
        </div>
      )}

      {hasActivePreset && (
        <div style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid var(--ed-border)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--ed-text-muted)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>
                Block Spacing
              </span>
              <button
                onClick={() => setShowGapHelp((v) => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '1px solid var(--ed-border)',
                  background: showGapHelp ? 'var(--ed-accent)' : 'none',
                  fontSize: 9,
                  fontWeight: 700,
                  color: showGapHelp ? '#fff' : 'var(--ed-text-muted)',
                  cursor: 'pointer',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                ?
              </button>
            </div>
          {showGapHelp && (
            <div style={{
              fontSize: 10,
              lineHeight: 1.5,
              color: 'var(--ed-text-muted)',
              background: 'var(--ed-surface)',
              border: '1px solid var(--ed-border)',
              borderRadius: 6,
              padding: '8px 10px',
              marginBottom: 6,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              Controls the vertical space between content blocks.
              <strong style={{ color: 'var(--ed-text)' }}> 1.0x</strong> is the preset default.
              Set to <strong style={{ color: 'var(--ed-text)' }}>0</strong> for no gaps,
              increase for more breathing room.
            </div>
          )}
            {Math.abs(gapScale - 1) >= 0.001 && (
              <button
                onClick={handleGapScaleReset}
                title="Reset to default (1.0x)"
                style={{
                  background: 'none',
                  border: '1px solid var(--ed-border)',
                  borderRadius: 4,
                  color: 'var(--ed-text-muted)',
                  cursor: 'pointer',
                  fontSize: 9,
                  lineHeight: 1,
                  padding: '2px 6px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  flexShrink: 0,
                }}
              >
                Reset
              </button>
            )}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--ed-surface)',
            borderRadius: 6,
            padding: '6px 10px',
            border: '1px solid var(--ed-border)',
          }}>
            <span style={{
              fontSize: 9,
              color: 'var(--ed-text-muted)',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              flexShrink: 0,
            }}>
              {gapScale < 0.1 ? 'None' : gapScale < 0.5 ? 'Tight' : gapScale < 0.9 ? 'Compact' : gapScale < 1.1 ? 'Default' : gapScale < 1.5 ? 'Relaxed' : 'Wide'}
            </span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={gapScale}
              onChange={(e) => handleGapScaleChange(parseFloat(e.target.value))}
              style={{ flex: 1, minWidth: 0 }}
            />
            <span style={{
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--ed-text)',
              fontWeight: 600,
              flexShrink: 0,
              minWidth: 28,
              textAlign: 'right',
            }}>
              {gapScale.toFixed(1)}x
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
