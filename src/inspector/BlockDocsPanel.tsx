import type { BlockDocs } from '@milkly/mkly';
import { UsagePreview } from '../ui/usage-preview';

interface BlockDocsPanelProps {
  blockType: string;
  docs: BlockDocs;
  kitName?: string;
}

export function BlockDocsPanel({ blockType, docs, kitName }: BlockDocsPanelProps) {
  return (
    <div style={{
      padding: '12px 14px',
      fontSize: 12,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      borderTop: '1px solid var(--ed-border)',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--ed-text-muted)',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        Docs
        {kitName && (
          <span style={{
            fontSize: 9,
            fontWeight: 500,
            background: 'var(--ed-surface)',
            border: '1px solid var(--ed-border)',
            borderRadius: 3,
            padding: '1px 5px',
            textTransform: 'none',
            letterSpacing: 0,
          }}>
            {kitName}
          </span>
        )}
      </div>

      <p style={{ color: 'var(--ed-text)', margin: '0 0 10px', lineHeight: 1.5 }}>
        {docs.summary}
      </p>

      {docs.usage && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--ed-text-muted)',
            marginBottom: 4,
          }}>
            Usage
          </div>
          <UsagePreview usage={docs.usage} htmlPreview={docs.htmlPreview} />
        </div>
      )}

      {docs.properties && docs.properties.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--ed-text-muted)',
            marginBottom: 4,
          }}>
            Properties
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {docs.properties.map((p) => (
              <div key={p.name} style={{
                display: 'flex',
                gap: 6,
                alignItems: 'baseline',
              }}>
                <code style={{
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--ed-accent)',
                  flexShrink: 0,
                }}>
                  {p.name}{p.required ? '*' : ''}
                </code>
                <span style={{
                  fontSize: 11,
                  color: 'var(--ed-text-muted)',
                }}>
                  {p.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {docs.tips && docs.tips.length > 0 && (
        <div>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--ed-text-muted)',
            marginBottom: 4,
          }}>
            Tips
          </div>
          <ul style={{
            margin: 0,
            paddingLeft: 16,
            color: 'var(--ed-text-muted)',
            fontSize: 11,
            lineHeight: 1.5,
          }}>
            {docs.tips.map((tip, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
