import { useState, useRef, useEffect } from 'react';

interface UsagePreviewProps {
  usage: string;
  htmlPreview?: string;
}

export function UsagePreview({ usage, htmlPreview }: UsagePreviewProps) {
  const [tab, setTab] = useState<'mkly' | 'preview'>('mkly');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (tab !== 'preview' || !htmlPreview) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>body{margin:0;padding:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.5;color:#222;}</style></head><body>${htmlPreview}</body></html>`);
    doc.close();
  }, [tab, htmlPreview]);

  const showTabs = !!htmlPreview;

  return (
    <div>
      {showTabs && (
        <div
          style={{
            display: 'flex',
            gap: 1,
            marginBottom: 4,
          }}
        >
          <TabButton active={tab === 'mkly'} onClick={() => setTab('mkly')}>mkly</TabButton>
          <TabButton active={tab === 'preview'} onClick={() => setTab('preview')}>Preview</TabButton>
        </div>
      )}

      {tab === 'mkly' && (
        <pre
          style={{
            background: 'var(--ed-surface)',
            border: '1px solid var(--ed-border)',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--ed-text)',
            margin: 0,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
            overflow: 'auto',
          }}
        >
          {usage}
        </pre>
      )}

      {tab === 'preview' && htmlPreview && (
        <iframe
          ref={iframeRef}
          title="Block preview"
          style={{
            width: '100%',
            minHeight: 80,
            border: '1px solid var(--ed-border)',
            borderRadius: 6,
            background: 'white',
          }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        border: 'none',
        background: active ? 'var(--ed-accent)' : 'var(--ed-surface)',
        color: active ? '#fff' : 'var(--ed-text-muted)',
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        cursor: 'pointer',
        borderRadius: 4,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
