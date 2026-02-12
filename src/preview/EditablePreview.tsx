import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editor-store';
import { mkly } from '@milkly/mkly';
import { makeBlocksEditable, EDIT_MODE_CSS } from './editable-blocks';
import { captureScrollAnchor, restoreScrollAnchor } from './scroll-anchor';
import { findBlockElement, shouldScrollToBlock } from '../store/selection-orchestrator';
import { cleanHtmlForReverse, MKLY_KITS, findLineForBlockIndex } from './reverse-helpers';
import { SyncEngine } from './SyncEngine';
import { IFRAME_DARK_CSS } from './iframe-dark-css';

const ACTIVE_BLOCK_CSS = '[data-mkly-active]{outline:2px solid rgba(59,130,246,0.5);outline-offset:2px;transition:outline 0.15s}';

interface EditablePreviewProps {
  onSyncError: (error: string | null) => void;
}

export function EditablePreview({ onSyncError }: EditablePreviewProps) {
  const html = useEditorStore((s) => s.html);
  const setSource = useEditorStore((s) => s.setSource);
  const activeBlockLine = useEditorStore((s) => s.activeBlockLine);
  const focusOrigin = useEditorStore((s) => s.focusOrigin);
  const focusIntent = useEditorStore((s) => s.focusIntent);
  const focusVersion = useEditorStore((s) => s.focusVersion);
  const scrollLock = useEditorStore((s) => s.scrollLock);
  const setScrollLock = useEditorStore((s) => s.setScrollLock);
  const theme = useEditorStore((s) => s.theme);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isEditingRef = useRef(false);
  const lastHtmlRef = useRef('');
  const handleInputRef = useRef<() => void>(() => {});
  const syncRef = useRef(new SyncEngine());

  useEffect(() => {
    const sync = syncRef.current;
    return () => sync.destroy();
  }, []);

  const writeToIframe = useCallback((content: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    setScrollLock(true);
    const anchor = captureScrollAnchor(doc);
    const isDark = useEditorStore.getState().theme === 'dark';
    const darkCss = isDark ? IFRAME_DARK_CSS : '';
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>${EDIT_MODE_CSS}\n${ACTIVE_BLOCK_CSS}\n${darkCss}</style></head><body style="margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;">${content}</body></html>`);
    doc.close();

    const finalize = () => {
      makeBlocksEditable(doc);
      setScrollLock(false);
    };

    if (anchor) {
      requestAnimationFrame(() => {
        restoreScrollAnchor(doc, anchor);
        finalize();
      });
    } else {
      requestAnimationFrame(finalize);
    }
    setTimeout(() => setScrollLock(false), 100);

    doc.body.addEventListener('input', () => handleInputRef.current());
    // Prevent link/button clicks from navigating the iframe — let the user edit the text instead
    doc.addEventListener('click', (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      if (a) e.preventDefault();
    });

    doc.body.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      let el = target.closest<HTMLElement>('[data-mkly-line]');
      if (!el) {
        const blocks = doc.querySelectorAll<HTMLElement>('[data-mkly-line]');
        for (const block of blocks) {
          const rect = block.getBoundingClientRect();
          if (e.clientY >= rect.top && e.clientY <= rect.bottom &&
              e.clientX >= rect.left && e.clientX <= rect.right) {
            el = block;
            break;
          }
        }
      }
      if (el) {
        const line = Number(el.dataset.mklyLine);
        useEditorStore.getState().focusBlock(line, 'edit');
      }
    });
  }, []);

  const handleInput = useCallback(() => {
    isEditingRef.current = true;

    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument;
    const activeEl = iframeDoc?.activeElement as HTMLElement | null;
    const blockEl = activeEl?.closest?.('[data-mkly-line]') as HTMLElement | null;

    let editingBlockIndex = -1;
    let editingBlockClass: string | null = null;
    if (blockEl && iframeDoc) {
      const allBlocks = iframeDoc.querySelectorAll('[data-mkly-line]');
      editingBlockIndex = Array.from(allBlocks).indexOf(blockEl);
      const classes = blockEl.className.split(/\s+/);
      editingBlockClass = classes.find(c => c.startsWith('mkly-') && !c.includes('__') && !c.includes('--')) ?? null;
    }

    const mklyDoc = iframe?.contentDocument?.querySelector('.mkly-document');
    const rawHtml = mklyDoc?.innerHTML ?? iframe?.contentDocument?.body.innerHTML ?? '';
    const editedHtml = cleanHtmlForReverse(rawHtml);
    const currentSource = useEditorStore.getState().source;

    syncRef.current.debouncedReverse(editedHtml, (result) => {
      if (result.error) {
        onSyncError(result.error);
        setTimeout(() => { isEditingRef.current = false; }, 200);
        return;
      }
      if (result.source === undefined) {
        setTimeout(() => { isEditingRef.current = false; }, 200);
        return;
      }

      const source = result.source;
      const latestSource = useEditorStore.getState().source;
      let updated = false;

      if (source !== latestSource) {
        try {
          const testResult = mkly(source, { kits: MKLY_KITS, sourceMap: true });
          const currentHtml = useEditorStore.getState().html;
          if (testResult.html !== currentHtml) {
            setSource(source);
            updated = true;
          }
        } catch (e) {
          onSyncError(`Compile error: ${String(e)}`);
          setSource(source);
          updated = true;
        }
      }

      if (updated) {
        onSyncError(null);
        if (editingBlockIndex >= 0) {
          const line = findLineForBlockIndex(source, editingBlockIndex, editingBlockClass);
          if (line !== null) {
            useEditorStore.getState().focusBlock(line, 'edit');
          }
        }
      } else {
        // Compare edited HTML against compiled HTML to distinguish
        // "edit lost" from "user reverted"
        const compiledHtml = cleanHtmlForReverse(
          iframe?.contentDocument?.querySelector('.mkly-document')?.innerHTML
            ?? lastHtmlRef.current,
        );
        // Normalize whitespace for comparison
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
        if (norm(editedHtml) !== norm(compiledHtml)) {
          onSyncError('Edit was not applied — this change is not supported in the current block type');
        } else {
          onSyncError(null);
        }
      }

      setTimeout(() => { isEditingRef.current = false; }, 200);
    }, 300, { preservePreambleFrom: currentSource });
  }, [setSource, onSyncError]);
  handleInputRef.current = handleInput;

  useEffect(() => {
    if (isEditingRef.current) return;
    if (html === lastHtmlRef.current && theme === (iframeRef.current?.dataset.lastTheme ?? 'dark')) return;
    lastHtmlRef.current = html;
    if (iframeRef.current) iframeRef.current.dataset.lastTheme = theme;
    writeToIframe(html);
  }, [html, writeToIframe, theme]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[data-mkly-active]').forEach((el) => el.removeAttribute('data-mkly-active'));
    if (activeBlockLine !== null) {
      const el = findBlockElement(activeBlockLine, doc);
      if (el) {
        el.setAttribute('data-mkly-active', '');
        if (shouldScrollToBlock(focusOrigin, 'edit', focusIntent, scrollLock)) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [activeBlockLine, focusOrigin, focusIntent, scrollLock, focusVersion]);

  return (
    <iframe
      ref={iframeRef}
      title="Editable Preview"
      style={{
        flex: 1,
        border: 'none',
        background: theme === 'dark' ? '#0a0a0a' : 'white',
      }}
    />
  );
}
