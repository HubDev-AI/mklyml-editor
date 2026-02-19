import { useState } from 'react';
import type { BlockDocs } from '@mklyml/core';
import { UsagePreview } from '../ui/usage-preview';

interface BlockDocsPanelProps {
  blockType: string;
  docs: BlockDocs;
  kitName?: string;
}

export function BlockDocsPanel({ blockType: _blockType, docs, kitName }: BlockDocsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        padding: '0 14px 12px',
        fontSize: 12,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        borderTop: '1px solid var(--ed-border)',
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '8px 0',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--ed-text-muted)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <span
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            fontSize: 8,
          }}
        >
          &#9660;
        </span>
        Docs
        {kitName && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 500,
              background: 'var(--ed-surface)',
              border: '1px solid var(--ed-border)',
              borderRadius: 3,
              padding: '1px 5px',
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            {kitName}
          </span>
        )}
      </button>

      {!collapsed && (
        <>
          <p style={{ color: 'var(--ed-text)', margin: '0 0 10px', lineHeight: 1.5 }}>
            {docs.summary}
          </p>

          {docs.usage && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--ed-text-muted)',
                  marginBottom: 4,
                }}
              >
                Usage
              </div>
              <UsagePreview usage={docs.usage} htmlPreview={docs.htmlPreview} />
            </div>
          )}

          {docs.properties && docs.properties.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--ed-text-muted)',
                  marginBottom: 4,
                }}
              >
                Properties
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {docs.properties.map((p) => (
                  <div
                    key={p.name}
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'baseline',
                    }}
                  >
                    <code
                      style={{
                        fontSize: 10,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: 'var(--ed-accent)',
                        flexShrink: 0,
                      }}
                    >
                      {p.name}
                      {p.required ? '*' : ''}
                    </code>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--ed-text-muted)',
                      }}
                    >
                      {p.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {docs.tips && docs.tips.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--ed-text-muted)',
                  marginBottom: 4,
                }}
              >
                Tips
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 16,
                  color: 'var(--ed-text-muted)',
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {docs.tips.map((tip, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
