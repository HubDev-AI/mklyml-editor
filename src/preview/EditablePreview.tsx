import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editor-store';
import { mkly, buildGoogleFontsLink } from '@mklyml/core';
import { makeBlocksEditable, EDIT_MODE_CSS } from './editable-blocks';
import { cleanHtmlForReverse, MKLY_KITS, findBlockByOriginalLine } from './reverse-helpers';
import { SyncEngine } from './SyncEngine';
import { IFRAME_DARK_CSS } from './iframe-dark-css';
import { ACTIVE_BLOCK_CSS, STYLE_PICK_CSS, syncActiveBlock, bindBlockClicks, setStylePickClass, bindStylePickHover, bindStylePickClick } from './iframe-highlight';
import { queryComputedStyles } from './computed-styles';
import { morphIframeContent } from './iframe-morph';
import { EDITOR_DOCUMENT_MAX_WIDTH } from '../store/compile-config';

interface EditablePreviewProps {
  onSyncError: (error: string | null) => void;
}

export function EditablePreview({ onSyncError }: EditablePreviewProps) {
  const html = useEditorStore((s) => s.html);
  const setSource = useEditorStore((s) => s.setSource);
  const activeBlockLine = useEditorStore((s) => s.activeBlockLine);
  const cursorLine = useEditorStore((s) => s.cursorLine);
  const selectionId = useEditorStore((s) => s.selectionId);
  const focusOrigin = useEditorStore((s) => s.focusOrigin);
  const focusIntent = useEditorStore((s) => s.focusIntent);
  const focusVersion = useEditorStore((s) => s.focusVersion);
  const scrollLock = useEditorStore((s) => s.scrollLock);
  const setComputedStyles = useEditorStore((s) => s.setComputedStyles);
  const theme = useEditorStore((s) => s.theme);
  const stylePickMode = useEditorStore((s) => s.stylePickMode);
  const styleSelection = useEditorStore((s) => s.styleSelection);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isEditingRef = useRef(false);
  const lastHtmlRef = useRef('');
  const handleInputRef = useRef<() => void>(() => {});
  const syncRef = useRef(new SyncEngine());
  const stylePickModeRef = useRef(stylePickMode);
  const initializedRef = useRef(false);
  const pendingSyncRef = useRef<{ html: string; theme: 'light' | 'dark' } | null>(null);
  const flushPendingSyncRef = useRef<() => void>(() => {});
  stylePickModeRef.current = stylePickMode;

  useEffect(() => {
    const sync = syncRef.current;
    return () => sync.destroy();
  }, []);

  /**
   * Full document write — used for first render and theme changes.
   * Sets up the iframe document structure with all CSS and event handlers.
   */
  const writeToIframe = useCallback((content: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const isDark = useEditorStore.getState().theme === 'dark';
    const darkCss = isDark ? IFRAME_DARK_CSS : '';
    const fontsLink = buildGoogleFontsLink(content);
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>${fontsLink}<style>${EDIT_MODE_CSS}\n${ACTIVE_BLOCK_CSS}\n${STYLE_PICK_CSS}\n${darkCss}</style></head><body style="margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;">${content}</body></html>`);
    doc.close();

    initializedRef.current = true;

    // Style pick handlers are managed exclusively by the useEffect([stylePickMode, html])
    // below, which re-runs after every iframe rewrite. Don't bind them here to avoid
    // orphaned handlers that survive after style pick mode is toggled off.
    if (!stylePickModeRef.current) {
      requestAnimationFrame(() => {
        makeBlocksEditable(doc);
      });
    }

    doc.body.addEventListener('input', () => handleInputRef.current());
    doc.addEventListener('click', (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      if (a) e.preventDefault();
    });
    doc.addEventListener('focusout', () => {
      requestAnimationFrame(() => flushPendingSyncRef.current());
    });

    bindBlockClicks(doc, 'edit');
  }, []);

  /**
   * DOM morph — used for subsequent content/style updates.
   * Patches only changed elements, preserving scroll, focus, and event handlers.
   */
  const morphToIframe = useCallback((content: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return false;
    const doc = iframe.contentDocument;
    if (!doc) return false;

    // Build the full HTML that would have been written — morphIframeContent
    // needs the same structure to find .mkly-document and style tags.
    const isDark = useEditorStore.getState().theme === 'dark';
    const darkCss = isDark ? IFRAME_DARK_CSS : '';
    const fontsLink = buildGoogleFontsLink(content);
    const fullHtml = `<!DOCTYPE html><html><head>${fontsLink}<style>${EDIT_MODE_CSS}\n${ACTIVE_BLOCK_CSS}\n${STYLE_PICK_CSS}\n${darkCss}</style></head><body style="margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;">${content}</body></html>`;

    const morphed = morphIframeContent(doc, fullHtml);
    if (!morphed) return false;

    // Re-apply editable attributes after morph (handles new/changed elements)
    const isStylePick = stylePickModeRef.current;
    if (!isStylePick) {
      makeBlocksEditable(doc);
    }

    return true;
  }, []);

  const syncLatestHtmlToIframe = useCallback((nextHtml: string, nextTheme: 'light' | 'dark') => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const prevTheme = iframe.dataset.lastTheme ?? 'dark';
    const themeChanged = nextTheme !== prevTheme;

    // First render of the editable iframe must always materialize immediately.
    if (!initializedRef.current) {
      pendingSyncRef.current = null;
      lastHtmlRef.current = nextHtml;
      iframe.dataset.lastTheme = nextTheme;
      writeToIframe(nextHtml);
      return;
    }

    if (doc.hasFocus() || isEditingRef.current) {
      pendingSyncRef.current = { html: nextHtml, theme: nextTheme };
      return;
    }
    pendingSyncRef.current = null;
    lastHtmlRef.current = nextHtml;
    iframe.dataset.lastTheme = nextTheme;

    if (!initializedRef.current || themeChanged) {
      writeToIframe(nextHtml);
      return;
    }

    if (!morphToIframe(nextHtml)) {
      writeToIframe(nextHtml);
    }
  }, [morphToIframe, writeToIframe]);

  const flushPendingSync = useCallback(() => {
    const pending = pendingSyncRef.current;
    if (!pending) return;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc || doc.hasFocus() || isEditingRef.current) return;
    pendingSyncRef.current = null;
    const prevTheme = iframe.dataset.lastTheme ?? 'dark';
    const themeChanged = pending.theme !== prevTheme;
    lastHtmlRef.current = pending.html;
    iframe.dataset.lastTheme = pending.theme;
    if (!initializedRef.current || themeChanged) {
      writeToIframe(pending.html);
      return;
    }
    if (!morphToIframe(pending.html)) {
      writeToIframe(pending.html);
    }
  }, [morphToIframe, writeToIframe]);

  flushPendingSyncRef.current = flushPendingSync;

  const releaseEditingLock = useCallback((delayMs = 200) => {
    setTimeout(() => {
      isEditingRef.current = false;
      const state = useEditorStore.getState();
      if (
        state.html !== lastHtmlRef.current
        || state.theme !== (iframeRef.current?.dataset.lastTheme ?? 'dark')
      ) {
        syncLatestHtmlToIframe(state.html, state.theme);
      }
      flushPendingSync();
    }, delayMs);
  }, [syncLatestHtmlToIframe, flushPendingSync]);

  const handleInput = useCallback(() => {
    isEditingRef.current = true;

    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument;
    const activeEl = iframeDoc?.activeElement as HTMLElement | null;
    const blockEl = activeEl?.closest?.('[data-mkly-line]') as HTMLElement | null;

    let editingOriginalLine = -1;
    let editingBlockClass: string | null = null;
    if (blockEl) {
      editingOriginalLine = Number(blockEl.dataset.mklyLine ?? -1);
      const classes = blockEl.className.split(/\s+/);
      editingBlockClass = classes.find(c => c.startsWith('mkly-') && !c.includes('__') && !c.includes('--')) ?? null;
    }

    const doc = iframe?.contentDocument;
    const parts: string[] = [];
    if (doc) {
      doc.querySelectorAll('meta[name^="mkly:"]').forEach(m => parts.push(m.outerHTML));
      const styleScript = doc.querySelector('script[type="text/mkly-style"]');
      if (styleScript) parts.push(styleScript.outerHTML);
      const definesScript = doc.querySelector('script[type="text/mkly-defines"]');
      if (definesScript) parts.push(definesScript.outerHTML);
    }
    const mklyDoc = doc?.querySelector('.mkly-document');
    parts.push(mklyDoc?.outerHTML ?? doc?.body.innerHTML ?? '');
    const rawHtml = parts.join('\n');
    const editedHtml = cleanHtmlForReverse(rawHtml);

    const revertIframe = (errorMsg: string) => {
      onSyncError(errorMsg);
      setTimeout(() => {
        isEditingRef.current = false;
        const state = useEditorStore.getState();
        syncLatestHtmlToIframe(state.html, state.theme);
      }, 100);
    };

    syncRef.current.debouncedReverse(editedHtml, (result) => {
      if (result.error) {
        revertIframe(result.error);
        return;
      }
      if (result.source === undefined) {
        releaseEditingLock();
        return;
      }

      const source = result.source;
      const latestSource = useEditorStore.getState().source;
      let updated = false;

      if (source !== latestSource) {
        try {
          const testResult = mkly(source, {
            kits: MKLY_KITS,
            sourceMap: true,
            maxWidth: EDITOR_DOCUMENT_MAX_WIDTH,
          });
          const fatalErrors = testResult.errors.filter(e => e.severity === 'error');
          if (fatalErrors.length > 0) {
            const details = fatalErrors.map(e => `[line ${e.line}] ${e.message}`).join('; ');
            console.error('[mkly-preview] Revert errors:', fatalErrors);
            console.error('[mkly-preview] Reversed source:\n', source);
            revertIframe(`Edit produced invalid source — reverting (${details})`);
            return;
          }
          const currentHtml = useEditorStore.getState().html;
          if (testResult.html !== currentHtml) {
            setSource(source);
            updated = true;
          }
        } catch (e) {
          revertIframe(`Compile error: ${String(e)}`);
          return;
        }
      }

      if (updated) {
        onSyncError(null);
        if (editingOriginalLine >= 1) {
          const line = findBlockByOriginalLine(source, editingOriginalLine, editingBlockClass);
          if (line !== null) {
            useEditorStore.getState().focusBlock(line, 'edit', 'recompile');
          }
        } else {
          // User typed outside any existing block — focus the newly created block.
          // The reverse engine wraps orphaned text in core/html; find the last
          // content block in the new source (most likely the one just created).
          const srcLines = source.split('\n');
          let lastBlockLine: number | null = null;
          for (let i = 0; i < srcLines.length; i++) {
            const t = srcLines[i].trim();
            const m = t.match(/^---\s+([\w/]+)/);
            if (m && !t.startsWith('--- /') && !['use', 'meta', 'theme', 'preset', 'style'].includes(m[1])) {
              lastBlockLine = i + 1;
            }
          }
          if (lastBlockLine !== null) {
            useEditorStore.getState().focusBlock(lastBlockLine, 'edit', 'recompile');
          }
        }
      } else {
        const compiledHtml = cleanHtmlForReverse(
          iframe?.contentDocument?.querySelector('.mkly-document')?.innerHTML
            ?? lastHtmlRef.current,
        );
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
        if (norm(editedHtml) !== norm(compiledHtml)) {
          onSyncError('Edit was not applied — this change is not supported in the current block type');
        } else {
          onSyncError(null);
        }
      }

      releaseEditingLock();
    }, 300);
  }, [setSource, onSyncError, releaseEditingLock, syncLatestHtmlToIframe]);
  handleInputRef.current = handleInput;

  // Sync HTML to iframe: morph on update, full write on first render or theme change
  useEffect(() => {
    if (isEditingRef.current) return;
    if (html === lastHtmlRef.current && theme === (iframeRef.current?.dataset.lastTheme ?? 'dark')) return;
    syncLatestHtmlToIframe(html, theme);
  }, [html, theme, syncLatestHtmlToIframe]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const styleTarget = styleSelection
      ? {
          blockType: styleSelection.blockType,
          target: styleSelection.target,
          targetIndex: styleSelection.targetIndex,
          selectionId: styleSelection.selectionId,
        }
      : null;
    syncActiveBlock(doc, activeBlockLine, focusOrigin, 'edit', focusIntent, scrollLock, styleTarget, cursorLine, selectionId);
    if (activeBlockLine !== null) {
      setComputedStyles(queryComputedStyles(doc, activeBlockLine, styleTarget, cursorLine));
    }
    // html dep: after recompilation morphs the iframe, re-sync the highlight on the
    // updated DOM. Without this, focusBlock() called before compile finishes would
    // highlight the wrong block (stale line numbers) and the morph would preserve it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlockLine, cursorLine, selectionId, focusOrigin, focusIntent, scrollLock, focusVersion, setComputedStyles, styleSelection, html]);

  // Style pick mode: bind/unbind hover and click handlers.
  // Depends on `html` so handlers are re-bound after every iframe morph/rewrite,
  // ensuring they reference the live document and are properly cleaned up.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc?.body) return;

    setStylePickClass(doc, stylePickMode);

    if (stylePickMode) {
      doc.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('contenteditable', 'false'));
      const cleanupHover = bindStylePickHover(doc);
      const cleanupClick = bindStylePickClick(doc, iframe, 'edit');
      return () => {
        cleanupHover();
        cleanupClick();
        if (doc.body) {
          setStylePickClass(doc, false);
          makeBlocksEditable(doc);
        }
      };
    }
    makeBlocksEditable(doc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stylePickMode, html]);

  return (
    <iframe
      ref={iframeRef}
      title="Editable Preview"
      style={{
        flex: 1,
        border: 'none',
        background: 'var(--ed-surface, #fff)',
      }}
    />
  );
}
