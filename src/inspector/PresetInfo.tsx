import { useCallback, useMemo } from 'react';
import type { CompletionData } from '@milkly/mkly';
import { useEditorStore } from '../store/editor-store';

interface PresetInfoProps {
  activePresets: string[];
  completionData: CompletionData;
}

export function PresetInfo({ activePresets, completionData }: PresetInfoProps) {
  const source = useEditorStore((s) => s.source);
  const setSource = useEditorStore((s) => s.setSource);
  const availablePresets = completionData.presets;

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
                  <option key={p.label} value={p.label} title={p.description}>
                    {p.label}
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
          {implicitPresets.map((name) => (
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
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--ed-text-muted)',
                cursor: 'pointer',
              }}
              onClick={() => handleMakeExplicit(name)}
              title="Click to make explicit in source"
            >
              <span style={{ flex: 1 }}>{name}</span>
              <span style={{
                fontSize: 9,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                opacity: 0.7,
                fontStyle: 'italic',
              }}>
                auto
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--ed-text-muted)', fontStyle: 'italic', fontSize: 11 }}>
          No preset — using default block styles
        </div>
      )}
    </div>
  );
}
