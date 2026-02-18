import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '../store/editor-store';
import { HtmlSourceEditor } from './HtmlSourceEditor';
import { EditablePreview } from './EditablePreview';
import { EmptyState } from './EmptyState';
import { SyncEngine } from './SyncEngine';
import { prettifyHtml } from './prettify-html';
import { IFRAME_DARK_CSS } from './iframe-dark-css';
import { ACTIVE_BLOCK_CSS, STYLE_PICK_CSS, syncActiveBlock, bindBlockClicks, setStylePickClass, bindStylePickHover, bindStylePickClick } from './iframe-highlight';
import { queryComputedStyles } from './computed-styles';
import { morphIframeContent } from './iframe-morph';
import { getErrorHint } from './error-hints';

interface PreviewPaneProps {
  onInsertBlock?: (blockType: string) => void;
}

export function PreviewPane({ onInsertBlock }: PreviewPaneProps) {
  const source = useEditorStore((s) => s.source);
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
  const stylePopup = useEditorStore((s) => s.stylePopup);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncRef = useRef(new SyncEngine());
  const prettyHtml = useMemo(() => prettifyHtml(html), [html]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stylePickModeRef = useRef(stylePickMode);
  const initializedRef = useRef(false);
  const lastThemeRef = useRef(theme);
  const blockClickCleanupRef = useRef<(() => void) | null>(null);
  stylePickModeRef.current = stylePickMode;

  useEffect(() => {
    const sync = syncRef.current;
    return () => sync.destroy();
  }, []);

  // Write HTML to preview iframe — first render does full doc.write,
  // subsequent updates use DOM morphing to preserve scroll + state.
  useEffect(() => {
    const iframe = iframeRef.current;
    const showIframe = viewMode === 'preview' || (viewMode === 'edit' && outputMode === 'email');
    if (!iframe || !html || !showIframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const themeChanged = theme !== lastThemeRef.current;
    lastThemeRef.current = theme;

    // Try morph for subsequent renders (same theme)
    if (initializedRef.current && !themeChanged) {
      const morphed = morphIframeContent(doc, html);
      if (morphed) {
        // Style pick handlers survive morph (they're on the document, not elements)
        return;
      }
    }

    // Full document write: first render, theme change, or morph failed
    setScrollLock(true);
    doc.open();
    doc.write(html);
    doc.close();

    initializedRef.current = true;

    // Inject highlight + dark mode styles
    const isDark = useEditorStore.getState().theme === 'dark';
    const extraCss = ACTIVE_BLOCK_CSS + '\n' + STYLE_PICK_CSS + (isDark ? IFRAME_DARK_CSS : '');
    if (extraCss) {
      const style = doc.createElement('style');
      style.textContent = extraCss;
      (doc.head ?? doc.documentElement)?.appendChild(style);
    }

    // Intercept link clicks — open in new browser tab instead of navigating the iframe.
    // In style pick mode, just prevent navigation (don't open in new tab).
    doc.addEventListener('click', (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      if (a?.href) {
        e.preventDefault();
        if (!stylePickModeRef.current) {
          window.open(a.href, '_blank', 'noopener');
        }
      }
    });

    // Ensure only one block click handler is active for the current iframe document.
    blockClickCleanupRef.current?.();
    blockClickCleanupRef.current = bindBlockClicks(doc, 'preview');

    requestAnimationFrame(() => setScrollLock(false));
    setTimeout(() => setScrollLock(false), 100);
  }, [html, viewMode, outputMode, setScrollLock, theme]);

  useEffect(() => {
    return () => {
      blockClickCleanupRef.current?.();
      blockClickCleanupRef.current = null;
    };
  }, []);

  // Highlight active block in preview iframe (same logic as edit pane)
  useEffect(() => {
    const iframeVisible = viewMode === 'preview' || (viewMode === 'edit' && outputMode === 'email');
    if (!iframeVisible) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const styleTarget = stylePopup ? { blockType: stylePopup.blockType, target: stylePopup.target, targetIndex: stylePopup.targetIndex } : null;
    syncActiveBlock(doc, activeBlockLine, focusOrigin, 'preview', focusIntent, scrollLock, styleTarget);
    if (activeBlockLine !== null) {
      setComputedStyles(queryComputedStyles(doc, activeBlockLine, styleTarget));
    }
    // html dep: after recompilation morphs the iframe, re-sync the highlight on the
    // updated DOM. Without this, focusBlock() called before compile finishes can
    // leave data-mkly-active on a stale/morphed element (wrong specific target).
  }, [activeBlockLine, focusOrigin, focusIntent, scrollLock, focusVersion, viewMode, outputMode, setComputedStyles, stylePopup, html]);

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

  const hasContentBlocks = /^--- [\w-]+\/\w/m.test(source);
  const showEmptyState = !hasContentBlocks && viewMode === 'preview' && onInsertBlock;

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
      {showEmptyState && <EmptyState onInsertBlock={onInsertBlock} />}
      <iframe
        ref={iframeRef}
        title="Preview"
        style={{
          flex: 1,
          border: 'none',
          background: 'var(--ed-surface, #fff)',
          display: !showEmptyState && (viewMode === 'preview' || (viewMode === 'edit' && outputMode === 'email'))
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
        <div
          data-error-panel
          style={{
            padding: '6px 14px',
            background: 'var(--ed-error-bg)',
            borderTop: '1px solid var(--ed-border)',
            fontSize: 12,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: 'var(--ed-error-text)',
            maxHeight: 120,
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          {errors.map((err, i) => {
            const hint = getErrorHint(err.message);
            return (
              <div key={i} style={{ margin: '4px 0' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                    color: err.severity === 'warning' ? 'var(--ed-warning-text)' : undefined,
                  }}
                >
                  <span
                    onClick={() => useEditorStore.getState().focusBlock(err.line, 'preview', 'navigate')}
                    style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', opacity: 0.7, flexShrink: 0 }}
                    title="Jump to line"
                  >
                    line {err.line}
                  </span>
                  <span>{hint.friendly}</span>
                </div>
                {hint.fix && (
                  <div style={{ fontSize: 11, color: 'var(--ed-accent)', opacity: 0.85, marginLeft: 2, marginTop: 1 }}>
                    {hint.fix}
                  </div>
                )}
                {hint.friendly !== err.message && (
                  <div style={{ fontSize: 10, color: 'var(--ed-text-muted)', opacity: 0.5, marginLeft: 2, marginTop: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                    {err.message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
