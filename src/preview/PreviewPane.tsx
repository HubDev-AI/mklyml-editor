import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '../store/editor-store';
import { HtmlSourceEditor } from './HtmlSourceEditor';
import { EditablePreview } from './EditablePreview';
import { SyncEngine } from './SyncEngine';
import { prettifyHtml } from './prettify-html';
import { captureScrollAnchor, restoreScrollAnchor } from './scroll-anchor';
import { IFRAME_DARK_CSS } from './iframe-dark-css';

export function PreviewPane() {
  const html = useEditorStore((s) => s.html);
  const viewMode = useEditorStore((s) => s.viewMode);
  const errors = useEditorStore((s) => s.errors);
  const setSource = useEditorStore((s) => s.setSource);
  const activeBlockLine = useEditorStore((s) => s.activeBlockLine);
  const setScrollLock = useEditorStore((s) => s.setScrollLock);
  const theme = useEditorStore((s) => s.theme);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncRef = useRef(new SyncEngine());
  const prettyHtml = useMemo(() => prettifyHtml(html), [html]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const sync = syncRef.current;
    return () => sync.destroy();
  }, []);

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

    // Inject dark mode styles
    const isDark = useEditorStore.getState().theme === 'dark';
    if (isDark) {
      const style = doc.createElement('style');
      style.textContent = IFRAME_DARK_CSS;
      (doc.head ?? doc.documentElement)?.appendChild(style);
    }

    // Intercept link clicks — open in new browser tab instead of navigating the iframe
    doc.addEventListener('click', (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      if (a?.href) {
        e.preventDefault();
        window.open(a.href, '_blank', 'noopener');
      }
    });

    if (anchor) {
      requestAnimationFrame(() => {
        restoreScrollAnchor(doc, anchor);
        setScrollLock(false);
      });
    } else {
      requestAnimationFrame(() => setScrollLock(false));
    }
    setTimeout(() => setScrollLock(false), 100);
  }, [html, viewMode, setScrollLock, theme]);

  // Send highlight message to preview iframe when active block changes or when switching to this tab
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    if (viewMode !== 'preview') return;
    iframe.contentWindow.postMessage({ type: 'mkly:highlight', line: activeBlockLine }, window.location.origin);
  }, [activeBlockLine, viewMode]);

  // Listen for click messages from preview iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data && e.data.type === 'mkly:click' && typeof e.data.line === 'number') {
        useEditorStore.getState().focusBlock(e.data.line, 'preview');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const lastCompiledRef = useRef('');
  useEffect(() => { lastCompiledRef.current = prettyHtml; }, [prettyHtml]);

  const handleHtmlChange = useCallback((newHtml: string) => {
    syncRef.current.debouncedReverse(newHtml, (result) => {
      if (result.source !== undefined) {
        const currentSource = useEditorStore.getState().source;
        if (result.source !== currentSource) {
          setSource(result.source);
          setSyncError(null);
        } else if (newHtml !== lastCompiledRef.current) {
          // Source unchanged but HTML differs from compiled — edit was lost
          setSyncError('Edit was not applied — this change is not supported in the current block type');
        } else {
          // HTML matches compiled output (user reverted) — clear warning
          setSyncError(null);
        }
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
          background: theme === 'dark' ? '#0a0a0a' : 'white',
          display: viewMode === 'preview' ? 'block' : 'none',
        }}
      />
      {viewMode === 'edit' && <EditablePreview onSyncError={setSyncError} />}
      <div style={{ display: viewMode === 'html' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '6px 14px',
          background: 'var(--ed-warning-bg, rgba(234, 179, 8, 0.1))',
          borderBottom: '1px solid var(--ed-border)',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--ed-warning-text, #ca8a04)',
          flexShrink: 0,
        }}>
          Experimental: Direct HTML edits may lose formatting when converted back to mkly
        </div>
        <HtmlSourceEditor value={prettyHtml} onChange={handleHtmlChange} />
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
