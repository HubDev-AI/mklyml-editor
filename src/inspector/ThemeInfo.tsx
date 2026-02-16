import { useCallback } from 'react';
import type { CompletionData } from '@mklyml/core';
import { useEditorStore } from '../store/editor-store';

interface ThemeInfoProps {
  activeThemes: string[];
  completionData: CompletionData;
}

export function ThemeInfo({ activeThemes, completionData }: ThemeInfoProps) {
  const setSource = useEditorStore((s) => s.setSource);
  const availableThemes = completionData.themes;

  const updateThemes = useCallback((newThemes: string[]) => {
    const source = useEditorStore.getState().source;
    const lines = source.split('\n');

    // Remove all existing --- theme: lines
    const filtered = lines.filter((l) => !l.match(/^---\s+theme:\s/));

    // Find insertion point: after last --- use: line, or after comments at top
    let insertIdx = 0;
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i].match(/^---\s+use:\s/)) {
        insertIdx = i + 1;
      }
    }

    // Insert new theme lines
    const themeLines = newThemes.map((t) => `--- theme: ${t}`);
    filtered.splice(insertIdx, 0, ...themeLines);

    setSource(filtered.join('\n'));
  }, [setSource]);

  const handleAdd = useCallback(() => {
    // Pick first available theme that isn't already active
    const next = availableThemes.find((t) => !activeThemes.includes(t.label));
    if (next) {
      updateThemes([...activeThemes, next.label]);
    }
  }, [activeThemes, availableThemes, updateThemes]);

  const handleRemove = useCallback((name: string) => {
    updateThemes(activeThemes.filter((t) => t !== name));
  }, [activeThemes, updateThemes]);

  const handleChange = useCallback((oldName: string, newName: string) => {
    updateThemes(activeThemes.map((t) => (t === oldName ? newName : t)));
  }, [activeThemes, updateThemes]);

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
          Document Themes
        </span>
        <button
          onClick={handleAdd}
          title="Add theme"
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

      {activeThemes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeThemes.map((name) => (
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
                title={availableThemes.find((t) => t.label === name)?.description}
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
                {availableThemes.map((t) => (
                  <option key={t.label} value={t.label} title={t.description}>
                    {t.description || t.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleRemove(name)}
                title="Remove theme"
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
      ) : (
        <div style={{ color: 'var(--ed-text-muted)', fontStyle: 'italic', fontSize: 11 }}>
          No theme — unstyled
        </div>
      )}
    </div>
  );
}
