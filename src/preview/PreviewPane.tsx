import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '../store/editor-store';
import { HtmlSourceEditor } from './HtmlSourceEditor';
import { EditablePreview } from './EditablePreview';
import { SyncEngine } from './SyncEngine';
import { prettifyHtml } from './prettify-html';
import { captureScrollAnchor, restoreScrollAnchor } from './scroll-anchor';
import { IFRAME_DARK_CSS } from './iframe-dark-css';
import { ACTIVE_BLOCK_CSS, STYLE_PICK_CSS, syncActiveBlock, bindBlockClicks, setStylePickClass, bindStylePickHover, bindStylePickClick } from './iframe-highlight';
import { queryComputedStyles } from './computed-styles';

export function PreviewPane() {
  const html = useEditorStore((s) => s.html);
  const viewMode = useEditorStore((s) => s.viewMode);
  const outputMode = useEditorStore((s) => s.outputMode);
  const errors = useEditorStore((s) => s.errors);
  const setSource = useEditorStore((s) => s.setSource);
  const activeBlockLine = useEditorStore((s) => s.activeBlockLine);
  const focusOrigin = useEditorStore((s) => s.focusOrigin);
  const focusIntent = useEditorStore((s) => s.focusIntent);
  const focusVersion = useEditorStore((s) => s.focusVersion);
  const scrollLock = useEditorStore((s) => s.scrollLock);
  const setScrollLock = useEditorStore((s) => s.setScrollLock);
  const setComputedStyles = useEditorStore((s) => s.setComputedStyles);
  const theme = useEditorStore((s) => s.theme);
  const stylePickMode = useEditorStore((s) => s.stylePickMode);
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
    const showIframe = viewMode === 'preview' || (viewMode === 'edit' && outputMode === 'email');
    if (!iframe || !html || !showIframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    setScrollLock(true);
    const anchor = captureScrollAnchor(doc);
    doc.open();
    doc.write(html);
    doc.close();

    // Inject highlight + dark mode styles
    const isDark = useEditorStore.getState().theme === 'dark';
    const extraCss = ACTIVE_BLOCK_CSS + '\n' + STYLE_PICK_CSS + (isDark ? IFRAME_DARK_CSS : '');
    if (extraCss) {
      const style = doc.createElement('style');
      style.textContent = extraCss;
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

    bindBlockClicks(doc, 'preview');

    if (anchor) {
      requestAnimationFrame(() => {
        restoreScrollAnchor(doc, anchor);
        setScrollLock(false);
      });
    } else {
      requestAnimationFrame(() => setScrollLock(false));
    }
    setTimeout(() => setScrollLock(false), 100);
  }, [html, viewMode, outputMode, setScrollLock, theme]);

  // Highlight active block in preview iframe (same logic as edit pane)
  useEffect(() => {
    const iframeVisible = viewMode === 'preview' || (viewMode === 'edit' && outputMode === 'email');
    if (!iframeVisible) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    syncActiveBlock(doc, activeBlockLine, focusOrigin, 'preview', focusIntent, scrollLock);
    if (activeBlockLine !== null) {
      setComputedStyles(queryComputedStyles(doc, activeBlockLine));
    }
  }, [activeBlockLine, focusOrigin, focusIntent, scrollLock, focusVersion, viewMode, outputMode, setComputedStyles]);

  // Style pick mode: toggle hover/click handlers in preview iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.body || !iframe) return;

    setStylePickClass(doc, stylePickMode);

    if (stylePickMode) {
      const cleanupHover = bindStylePickHover(doc);
      const cleanupClick = bindStylePickClick(doc, iframe);
      return () => {
        cleanupHover();
        cleanupClick();
        if (doc.body) setStylePickClass(doc, false);
      };
    }
  }, [stylePickMode, html]);

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
      {viewMode === 'edit' && outputMode === 'email' && (
        <div style={{
          padding: '6px 14px',
          background: 'var(--ed-info-bg, rgba(59, 130, 246, 0.1))',
          borderBottom: '1px solid var(--ed-border)',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--ed-info-text, #3b82f6)',
          flexShrink: 0,
        }}>
          Email output is read-only — switch to Web to edit
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Preview"
        style={{
          flex: 1,
          border: 'none',
          background: 'var(--ed-surface, #fff)',
          display: viewMode === 'preview' || (viewMode === 'edit' && outputMode === 'email')
            ? 'block' : 'none',
        }}
      />
      {viewMode === 'edit' && outputMode !== 'email' && <EditablePreview onSyncError={setSyncError} />}
      <div style={{ display: viewMode === 'html' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '6px 14px',
          background: outputMode === 'email'
            ? 'var(--ed-info-bg, rgba(59, 130, 246, 0.1))'
            : 'var(--ed-warning-bg, rgba(234, 179, 8, 0.1))',
          borderBottom: '1px solid var(--ed-border)',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: outputMode === 'email'
            ? 'var(--ed-info-text, #3b82f6)'
            : 'var(--ed-warning-text, #ca8a04)',
          flexShrink: 0,
        }}>
          {outputMode === 'email'
            ? 'Email HTML is read-only — switch to Web to edit'
            : 'Experimental: Direct HTML edits may lose formatting when converted back to mkly'}
        </div>
        <HtmlSourceEditor value={prettyHtml} onChange={handleHtmlChange} readOnly={outputMode === 'email'} />
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
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span
            style={{ flex: 1, cursor: 'pointer' }}
            onClick={() => {
              const lineMatch = syncError.match(/\[line (\d+)\]/);
              if (lineMatch) {
                const line = Number(lineMatch[1]);
                useEditorStore.getState().focusBlock(line, 'mkly', 'navigate');
              }
            }}
            title={syncError.match(/\[line/) ? 'Click to navigate to error line' : undefined}
          >
            {syncError}
          </span>
          <button
            onClick={() => setSyncError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '0 2px',
              fontSize: 14,
              lineHeight: 1,
              opacity: 0.7,
            }}
            title="Dismiss"
          >
            ×
          </button>
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
