import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BlockDocs } from '@milkly/mkly';
import { KitBadge } from '../ui/kit-badge';

interface BlockHelpPopoverProps {
  docs: BlockDocs;
  blockName: string;
  kitName?: string;
  anchorEl: HTMLElement;
  onClose: () => void;
}

type Tab = 'overview' | 'usage' | 'preview';

export function BlockHelpPopover({ docs, blockName, kitName, anchorEl, onClose }: BlockHelpPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const rect = anchorEl.getBoundingClientRect();
  const x = rect.right + 8;
  const y = rect.top;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorEl]);

  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        if (ref.current && !ref.current.contains(document.activeElement)) {
          onClose();
        }
      }, 0);
    };
    window.addEventListener('blur', handler);
    return () => window.removeEventListener('blur', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '4px 10px',
    border: 'none',
    borderRadius: 4,
    background: tab === t ? 'var(--ed-accent)' : 'transparent',
    color: tab === t ? 'white' : 'var(--ed-text)',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: tab === t ? 600 : 500,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  });

  return createPortal(
    <div
      ref={ref}
      className="liquid-glass-overlay"
      style={{
        position: 'fixed',
        left: Math.min(x, window.innerWidth - 340),
        top: Math.max(0, Math.min(y, window.innerHeight - 420)),
        width: 320,
        maxHeight: 400,
        overflowY: 'auto',
        padding: 0,
        zIndex: 9999,
        borderRadius: 12,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div style={{ padding: '10px 14px 0', borderBottom: '1px solid var(--ed-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ed-text)' }}>
            {blockName}
          </div>
          {kitName && <KitBadge kit={kitName} size="md" />}
        </div>
        <div style={{ display: 'flex', gap: 2, paddingBottom: 8 }}>
          <button style={tabStyle('overview')} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button style={tabStyle('usage')} onClick={() => setTab('usage')}>
            Usage
          </button>
          <button style={tabStyle('preview')} onClick={() => setTab('preview')}>
            Preview
          </button>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        {tab === 'overview' && (
          <>
            <p
              style={{
                fontSize: 12,
                color: 'var(--ed-text)',
                lineHeight: 1.6,
                margin: '0 0 12px',
              }}
            >
              {docs.summary}
            </p>

            {docs.properties && docs.properties.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--ed-text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 6,
                    opacity: 0.7,
                  }}
                >
                  Properties
                </div>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <tbody>
                    {docs.properties.map((p) => (
                      <tr key={p.name} style={{ borderBottom: '1px solid var(--ed-border)' }}>
                        <td
                          style={{
                            padding: '4px 8px 4px 0',
                            fontWeight: 600,
                            color: 'var(--ed-accent)',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.name}
                          {p.required ? '*' : ''}
                        </td>
                        <td style={{ padding: '4px 0', color: 'var(--ed-text)' }}>
                          {p.description}
                          {p.example && (
                            <span
                              style={{
                                display: 'block',
                                fontSize: 10,
                                color: 'var(--ed-text)',
                                opacity: 0.6,
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              e.g. {p.example}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {docs.tips && docs.tips.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--ed-text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    opacity: 0.7,
                  }}
                >
                  Tips
                </div>
                <ul
                  style={{
                    margin: 0,
                    padding: '0 0 0 16px',
                    fontSize: 11,
                    color: 'var(--ed-text)',
                    lineHeight: 1.6,
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

        {tab === 'usage' && (
          <pre
            style={{
              padding: 10,
              borderRadius: 6,
              background: 'var(--ed-surface)',
              border: '1px solid var(--ed-border)',
              fontSize: 11,
              lineHeight: 1.5,
              overflow: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--ed-text)',
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}
          >
            {docs.usage}
          </pre>
        )}

        {tab === 'preview' && (
          <PreviewIframe html={docs.htmlPreview} />
        )}
      </div>
    </div>,
    document.body,
  );
}

function PreviewIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const writeContent = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>body{margin:0;padding:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;}</style></head><body>${html}</body></html>`);
    doc.close();
  }, [html]);

  useEffect(() => {
    writeContent();
  }, [writeContent]);

  return (
    <iframe
      ref={iframeRef}
      title="Block preview"
      sandbox="allow-same-origin"
      style={{
        width: '100%',
        minHeight: 80,
        borderRadius: 6,
        background: 'white',
        border: '1px solid var(--ed-border)',
      }}
    />
  );
}
