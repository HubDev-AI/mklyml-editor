import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '../store/editor-store';
import { HtmlSourceEditor } from './HtmlSourceEditor';
import { EditablePreview } from './EditablePreview';
import { SyncEngine } from './SyncEngine';
import { prettifyHtml } from './prettify-html';
import { captureScrollAnchor, restoreScrollAnchor } from './scroll-anchor';

export function PreviewPane() {
  const html = useEditorStore((s) => s.html);
  const viewMode = useEditorStore((s) => s.viewMode);
  const errors = useEditorStore((s) => s.errors);
  const setSource = useEditorStore((s) => s.setSource);
  const activeBlockLine = useEditorStore((s) => s.activeBlockLine);
  const setScrollLock = useEditorStore((s) => s.setScrollLock);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncRef = useRef(new SyncEngine());
  const prettyHtml = useMemo(() => prettifyHtml(html), [html]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Write HTML to preview iframe imperatively (preserves scroll position)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html || viewMode !== 'preview') return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    setScrollLock(true);
    const anchor = captureScrollAnchor(doc);
    doc.open();
    doc.write(html);
    doc.close();
    if (anchor) {
      requestAnimationFrame(() => {
        restoreScrollAnchor(doc, anchor);
        setScrollLock(false);
      });
    } else {
      requestAnimationFrame(() => setScrollLock(false));
    }
    setTimeout(() => setScrollLock(false), 100);
  }, [html, viewMode, setScrollLock]);

  // Send highlight message to preview iframe when active block changes or when switching to this tab
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    if (viewMode !== 'preview') return;
    iframe.contentWindow.postMessage({ type: 'mkly:highlight', line: activeBlockLine }, '*');
  }, [activeBlockLine, viewMode]);

  // Listen for click messages from preview iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'mkly:click' && typeof e.data.line === 'number') {
        useEditorStore.getState().focusBlock(e.data.line, 'preview');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleHtmlChange = useCallback((newHtml: string) => {
    syncRef.current.debouncedReverse(newHtml, (result) => {
      if (result.source) {
        setSource(result.source);
        setSyncError(null);
      } else if (result.error) {
        setSyncError(result.error);
      }
    });
  }, [setSource]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      overflow: 'hidden',
    }}>
      <iframe
        ref={iframeRef}
        title="Preview"
        style={{
          flex: 1,
          border: 'none',
          background: 'white',
          display: viewMode === 'preview' ? 'block' : 'none',
        }}
      />
      {viewMode === 'edit' && <EditablePreview />}
      <div style={{ display: viewMode === 'html' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        <HtmlSourceEditor value={prettyHtml} onChange={handleHtmlChange} />
        <div style={{
          padding: '4px 14px',
          background: 'var(--ed-warning-bg, rgba(234, 179, 8, 0.1))',
          borderTop: '1px solid var(--ed-border)',
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--ed-warning-text, #ca8a04)',
          flexShrink: 0,
          opacity: 0.8,
        }}>
          HTML editing is experimental — changes may not round-trip perfectly back to mkly
        </div>
      </div>
      {syncError && (
        <div style={{
          padding: '4px 14px',
          background: 'var(--ed-error-bg)',
          borderTop: '1px solid var(--ed-border)',
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--ed-warning-text)',
          flexShrink: 0,
        }}>
          {syncError}
        </div>
      )}
      {errors.length > 0 && (
        <div style={{
          padding: '6px 14px',
          background: 'var(--ed-error-bg)',
          borderTop: '1px solid var(--ed-border)',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--ed-error-text)',
          maxHeight: 100,
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          {errors.map((err, i) => (
            <p
              key={i}
              style={{
                margin: '1px 0',
                color: err.severity === 'warning' ? 'var(--ed-warning-text)' : undefined,
              }}
            >
              {err.severity === 'warning' ? 'warn' : 'error'}: line {err.line}
              {'blockType' in err ? ` [${err.blockType}]` : ''} — {err.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
