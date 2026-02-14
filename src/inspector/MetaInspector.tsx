import { useCallback } from 'react';
import type { CompletionData } from '@mklyml/core';
import { useEditorStore } from '../store/editor-store';

interface MetaInspectorProps {
  properties: Record<string, string>;
  startLine: number;
  endLine: number;
  completionData: CompletionData;
}

export function MetaInspector({ properties, startLine, endLine, completionData }: MetaInspectorProps) {
  const setSource = useEditorStore((s) => s.setSource);

  const handlePropertyChange = useCallback((key: string, value: string) => {
    const currentSource = useEditorStore.getState().source;
    const lines = currentSource.split('\n');
    let found = false;

    for (let i = startLine - 1; i < endLine - 1 && i < lines.length; i++) {
      const match = lines[i].match(/^([\w]+):\s*/);
      if (match && match[1] === key) {
        if (value === '') {
          lines.splice(i, 1);
        } else {
          lines[i] = `${key}: ${value}`;
        }
        found = true;
        break;
      }
    }

    if (!found && value !== '') {
      const insertAt = Math.min(endLine - 1, lines.length);
      lines.splice(insertAt, 0, `${key}: ${value}`);
    }

    setSource(lines.join('\n'));
  }, [startLine, endLine, setSource]);

  return (
    <div style={{
      padding: '12px 14px',
      fontSize: 12,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: '1px solid var(--ed-border)',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'var(--ed-accent)',
          color: 'white',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}>
          M
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>meta</div>
          <div style={{ fontSize: 10, color: 'var(--ed-text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            L{startLine}–{endLine}
          </div>
        </div>
      </div>

      <div style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--ed-text-muted)',
        marginBottom: 6,
      }}>
        Properties
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {completionData.metaProperties.map((meta) => {
          const currentValue = properties[meta.name] ?? '';
          return (
            <div key={meta.name}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 2,
              }}>
                <code style={{
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--ed-accent)',
                }}>
                  {meta.name}{meta.required ? '*' : ''}
                </code>
                <span style={{ fontSize: 10, color: 'var(--ed-text-muted)' }}>
                  {meta.description}
                </span>
              </label>
              <input
                type="text"
                value={currentValue}
                placeholder={meta.example}
                onChange={(e) => handlePropertyChange(meta.name, e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--ed-surface)',
                  color: 'var(--ed-text)',
                  border: '1px solid var(--ed-border)',
                  borderRadius: 4,
                  padding: '4px 6px',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  boxSizing: 'border-box',
                }}
              />
            </div>
          );
        })}
      </div>

      {Object.keys(properties).some((k) => !completionData.metaProperties.find((m) => m.name === k)) && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--ed-text-muted)',
            marginBottom: 4,
          }}>
            Custom
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Object.entries(properties)
              .filter(([k]) => !completionData.metaProperties.find((m) => m.name === k))
              .map(([key, value]) => (
                <div key={key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <code style={{
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: 'var(--ed-text)',
                    flexShrink: 0,
                  }}>
                    {key}:
                  </code>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handlePropertyChange(key, e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--ed-surface)',
                      color: 'var(--ed-text)',
                      border: '1px solid var(--ed-border)',
                      borderRadius: 4,
                      padding: '3px 6px',
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
