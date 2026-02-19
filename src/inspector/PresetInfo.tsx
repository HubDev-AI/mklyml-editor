import { useCallback, useMemo, useState } from 'react';
import type { CompletionData } from '@mklyml/core';
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
      // Style block ends at next `---` directive (blank lines are valid inside style blocks)
      if (/^---\s/.test(line)) {
        inStyleBlock = false;
        continue;
      }
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
  const normalizeStyleSpacing = (rawLines: string[]): string[] => {
    const lines = [...rawLines];
    let styleStart = -1;

    for (let i = 0; i < lines.length; i++) {
      if (/^---\s+style\b/.test(lines[i])) {
        styleStart = i;
        break;
      }
    }
    if (styleStart === -1) return lines;

    // Ensure exactly one blank line before --- style (unless it's at top of file).
    while (styleStart > 0 && lines[styleStart - 1].trim() === '') {
      lines.splice(styleStart - 1, 1);
      styleStart--;
    }
    if (styleStart > 0 && lines[styleStart - 1].trim() !== '') {
      lines.splice(styleStart, 0, '');
      styleStart++;
    }

    // Ensure exactly one blank line between style block and the next directive.
    let nextDirective = lines.length;
    for (let i = styleStart + 1; i < lines.length; i++) {
      if (/^---\s/.test(lines[i])) {
        nextDirective = i;
        break;
      }
    }

    while (nextDirective > styleStart + 1 && lines[nextDirective - 1].trim() === '') {
      lines.splice(nextDirective - 1, 1);
      nextDirective--;
    }
    if (nextDirective < lines.length && lines[nextDirective - 1].trim() !== '') {
      lines.splice(nextDirective, 0, '');
    }

    return lines;
  };

  const lines = source.split('\n');
  const isDefault = Math.abs(value - 1) < 0.001;

  // Find the style block
  let styleBlockStart = -1;
  let styleBlockEnd = -1; // index of last non-blank line in the block
  let gapScaleLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/^---\s+style\b/.test(lines[i])) {
      styleBlockStart = i;
      // Scan until next --- directive (blank lines are valid inside style blocks)
      for (let j = i + 1; j < lines.length; j++) {
        if (/^---\s/.test(lines[j])) break;
        if (lines[j].trim() !== '') styleBlockEnd = j;
        if (/^\s*gapScale:/.test(lines[j])) {
          gapScaleLine = j;
        }
      }
      break;
    }
  }

  // Case 1: gapScale line exists — update or remove it
  if (gapScaleLine !== -1) {
    if (isDefault) {
      lines.splice(gapScaleLine, 1);
    } else {
      // Preserve existing indentation
      const existingIndent = lines[gapScaleLine].match(/^(\s*)/)?.[1] ?? '';
      lines[gapScaleLine] = `${existingIndent}gapScale: ${value}`;
    }
    return normalizeStyleSpacing(lines).join('\n');
  }

  // Case 2: style block exists but no gapScale — insert right after `--- style`
  if (styleBlockStart !== -1 && !isDefault) {
    lines.splice(styleBlockStart + 1, 0, `gapScale: ${value}`);
    return normalizeStyleSpacing(lines).join('\n');
  }

  // Case 3: no style block — create one (after meta in canonical order)
  if (styleBlockStart === -1 && !isDefault) {
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^---\s+(preset|theme|use|define-theme|define-preset)[\s:]/.test(lines[i])) {
        insertIdx = i + 1;
      } else if (/^---\s+meta\b/.test(lines[i])) {
        insertIdx = i + 1;
        // Skip past meta block properties
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === '' || /^---\s/.test(lines[j])) break;
          insertIdx = j + 1;
        }
      }
    }
    lines.splice(insertIdx, 0, `--- style`, `gapScale: ${value}`, '');
    return normalizeStyleSpacing(lines).join('\n');
  }

  // Default value and no existing line — nothing to do
  return source;
}

/** Parse the lineHeightScale value from a `--- style` block in mkly source. */
function parseLineHeightScale(source: string): number {
  const lines = source.split('\n');
  let inStyleBlock = false;
  for (const line of lines) {
    if (/^---\s+style\b/.test(line)) {
      inStyleBlock = true;
      continue;
    }
    if (inStyleBlock) {
      if (/^---\s/.test(line)) {
        inStyleBlock = false;
        continue;
      }
      const m = line.match(/^\s*lineHeightScale:\s*(.+)$/);
      if (m) {
        const val = parseFloat(m[1].trim());
        if (!isNaN(val)) return val;
      }
    }
  }
  return 1;
}

/** Update or insert lineHeightScale in the source's `--- style` block. */
function writeLineHeightScale(source: string, value: number): string {
  const normalizeStyleSpacing = (rawLines: string[]): string[] => {
    const lines = [...rawLines];
    let styleStart = -1;

    for (let i = 0; i < lines.length; i++) {
      if (/^---\s+style\b/.test(lines[i])) {
        styleStart = i;
        break;
      }
    }
    if (styleStart === -1) return lines;

    while (styleStart > 0 && lines[styleStart - 1].trim() === '') {
      lines.splice(styleStart - 1, 1);
      styleStart--;
    }
    if (styleStart > 0 && lines[styleStart - 1].trim() !== '') {
      lines.splice(styleStart, 0, '');
      styleStart++;
    }

    let nextDirective = lines.length;
    for (let i = styleStart + 1; i < lines.length; i++) {
      if (/^---\s/.test(lines[i])) {
        nextDirective = i;
        break;
      }
    }

    while (nextDirective > styleStart + 1 && lines[nextDirective - 1].trim() === '') {
      lines.splice(nextDirective - 1, 1);
      nextDirective--;
    }
    if (nextDirective < lines.length && lines[nextDirective - 1].trim() !== '') {
      lines.splice(nextDirective, 0, '');
    }

    return lines;
  };

  const lines = source.split('\n');
  const isDefault = Math.abs(value - 1) < 0.001;

  let styleBlockStart = -1;
  let lineHeightScaleLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/^---\s+style\b/.test(lines[i])) {
      styleBlockStart = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^---\s/.test(lines[j])) break;
        if (/^\s*lineHeightScale:/.test(lines[j])) {
          lineHeightScaleLine = j;
        }
      }
      break;
    }
  }

  if (lineHeightScaleLine !== -1) {
    if (isDefault) {
      lines.splice(lineHeightScaleLine, 1);
    } else {
      const existingIndent = lines[lineHeightScaleLine].match(/^(\s*)/)?.[1] ?? '';
      lines[lineHeightScaleLine] = `${existingIndent}lineHeightScale: ${value}`;
    }
    return normalizeStyleSpacing(lines).join('\n');
  }

  if (styleBlockStart !== -1 && !isDefault) {
    lines.splice(styleBlockStart + 1, 0, `lineHeightScale: ${value}`);
    return normalizeStyleSpacing(lines).join('\n');
  }

  if (styleBlockStart === -1 && !isDefault) {
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^---\s+(preset|theme|use|define-theme|define-preset)[\s:]/.test(lines[i])) {
        insertIdx = i + 1;
      } else if (/^---\s+meta\b/.test(lines[i])) {
        insertIdx = i + 1;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === '' || /^---\s/.test(lines[j])) break;
          insertIdx = j + 1;
        }
      }
    }
    lines.splice(insertIdx, 0, `--- style`, `lineHeightScale: ${value}`, '');
    return normalizeStyleSpacing(lines).join('\n');
  }

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
  const [showLhHelp, setShowLhHelp] = useState(false);

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
  const lineHeightScale = useMemo(() => parseLineHeightScale(source), [source]);

  const hasActivePreset = activePresets.length > 0 || implicitPresets.length > 0;

  const handleGapScaleChange = useCallback((value: number) => {
    const src = useEditorStore.getState().source;
    setSource(writeGapScale(src, value));
  }, [setSource]);

  const handleGapScaleReset = useCallback(() => {
    const src = useEditorStore.getState().source;
    setSource(writeGapScale(src, 1));
  }, [setSource]);

  const handleLineHeightScaleChange = useCallback((value: number) => {
    const src = useEditorStore.getState().source;
    setSource(writeLineHeightScale(src, value));
  }, [setSource]);

  const handleLineHeightScaleReset = useCallback(() => {
    const src = useEditorStore.getState().source;
    setSource(writeLineHeightScale(src, 1));
  }, [setSource]);

  const updatePresets = useCallback((newPresets: string[]) => {
    const src = useEditorStore.getState().source;
    const lines = src.split('\n');

    const filtered = lines.filter((l) => !l.match(/^---\s+preset:\s/));

    let insertIdx = 0;
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i].match(/^---\s+(theme|use|define-theme|define-preset)[\s:]/)) {
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

  const stepPresetName = useCallback((currentName: string, direction: 1 | -1): string | null => {
    if (availablePresets.length === 0) return null;
    const idx = availablePresets.findIndex((p) => p.label === currentName);
    if (idx === -1) return availablePresets[0]?.label ?? null;
    const nextIdx = (idx + direction + availablePresets.length) % availablePresets.length;
    return availablePresets[nextIdx]?.label ?? null;
  }, [availablePresets]);

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
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                  const direction = e.key === 'ArrowUp' ? -1 : 1;
                  const next = stepPresetName(name, direction);
                  if (!next || next === name) return;
                  e.preventDefault();
                  handleChange(name, next);
                }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
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
              <span style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--ed-accent)',
                fontWeight: 600,
              }}>
                {gapScale.toFixed(1)}x
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
              {showGapHelp && (
                <div style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  left: 0,
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: 'var(--ed-text-muted)',
                  background: 'var(--ed-bg, #1a1a1a)',
                  border: '1px solid var(--ed-border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 10,
                  width: 200,
                }}>
                  Controls the vertical space between content blocks.
                  <strong style={{ color: 'var(--ed-text)' }}> 1.0x</strong> is the preset default.
                  Set to <strong style={{ color: 'var(--ed-text)' }}>0</strong> for no gaps,
                  increase for more breathing room.
                </div>
              )}
            </div>
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
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--ed-text-muted)',
              flexShrink: 0,
              minWidth: 20,
            }}>
              0x
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
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--ed-text-muted)',
              flexShrink: 0,
              minWidth: 20,
              textAlign: 'right',
            }}>
              2x
            </span>
          </div>

          {/* Line Height Scale */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
            marginBottom: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--ed-text-muted)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>
                Line Height
              </span>
              <span style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--ed-accent)',
                fontWeight: 600,
              }}>
                {lineHeightScale.toFixed(1)}x
              </span>
              <button
                onClick={() => setShowLhHelp((v) => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '1px solid var(--ed-border)',
                  background: showLhHelp ? 'var(--ed-accent)' : 'none',
                  fontSize: 9,
                  fontWeight: 700,
                  color: showLhHelp ? '#fff' : 'var(--ed-text-muted)',
                  cursor: 'pointer',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                ?
              </button>
              {showLhHelp && (
                <div style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  left: 0,
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: 'var(--ed-text-muted)',
                  background: 'var(--ed-bg, #1a1a1a)',
                  border: '1px solid var(--ed-border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 10,
                  width: 200,
                }}>
                  Scales the line-height of body text and paragraphs.
                  <strong style={{ color: 'var(--ed-text)' }}> 1.0x</strong> is the preset default.
                  Reduce for tighter, more compact text.
                </div>
              )}
            </div>
            {Math.abs(lineHeightScale - 1) >= 0.001 && (
              <button
                onClick={handleLineHeightScaleReset}
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
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--ed-text-muted)',
              flexShrink: 0,
              minWidth: 24,
            }}>
              .8x
            </span>
            <input
              type="range"
              min={0.8}
              max={1.2}
              step={0.05}
              value={lineHeightScale}
              onChange={(e) => handleLineHeightScaleChange(parseFloat(e.target.value))}
              style={{ flex: 1, minWidth: 0 }}
            />
            <span style={{
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--ed-text-muted)',
              flexShrink: 0,
              minWidth: 24,
              textAlign: 'right',
            }}>
              1.2x
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
