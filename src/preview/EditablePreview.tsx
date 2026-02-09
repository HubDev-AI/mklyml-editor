import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editor-store';
import { htmlToMkly, mkly, CORE_KIT } from '@milkly/mkly';
import { NEWSLETTER_KIT } from '@mkly-kits/newsletter';
import { makeBlocksEditable, EDIT_MODE_CSS } from './editable-blocks';
import { captureScrollAnchor, restoreScrollAnchor } from './scroll-anchor';
import { findBlockElement, shouldScrollToBlock } from '../store/selection-orchestrator';

const ACTIVE_BLOCK_CSS = '[data-mkly-active]{outline:2px solid rgba(59,130,246,0.5);outline-offset:2px;transition:outline 0.15s}';
const SKIP_TYPES = new Set(['use', 'meta', 'theme', 'style']);

export function EditablePreview() {
  const html = useEditorStore((s) => s.html);
  const setSource = useEditorStore((s) => s.setSource);
  const activeBlockLine = useEditorStore((s) => s.activeBlockLine);
  const focusOrigin = useEditorStore((s) => s.focusOrigin);
  const focusIntent = useEditorStore((s) => s.focusIntent);
  const focusVersion = useEditorStore((s) => s.focusVersion);
  const scrollLock = useEditorStore((s) => s.scrollLock);
  const setScrollLock = useEditorStore((s) => s.setScrollLock);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isEditingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastHtmlRef = useRef('');
  const handleInputRef = useRef<() => void>(() => {});

  const writeToIframe = useCallback((content: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    // Lock scrolling during iframe rewrite to prevent cross-pane jumps
    setScrollLock(true);
    const anchor = captureScrollAnchor(doc);
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>${EDIT_MODE_CSS}\n${ACTIVE_BLOCK_CSS}</style></head><body style="margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;">${content}</body></html>`);
    doc.close();

    // Restore scroll THEN make blocks editable (editable attrs must not interfere with scroll measurement)
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
    // Failsafe: release scrollLock after 100ms in case rAF doesn't fire
    setTimeout(() => setScrollLock(false), 100);

    doc.body.addEventListener('input', () => handleInputRef.current());
    // Use mousedown instead of click — click doesn't fire reliably on first
    // interaction with a contenteditable iframe (browser focuses iframe first)
    doc.body.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Walk up from target to find block even for pointer-events:none elements
      let el = target.closest<HTMLElement>('[data-mkly-line]');
      if (!el) {
        // For non-editable blocks (pointer-events:none), the click reaches the
        // parent container. Walk through block elements to find the one at this position.
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

    // Capture the editing block's index AND its mkly-line value for robust matching
    let editingBlockIndex = -1;
    let editingBlockLine = -1;
    let editingBlockClass: string | null = null;
    if (blockEl && iframeDoc) {
      const allBlocks = iframeDoc.querySelectorAll('[data-mkly-line]');
      editingBlockIndex = Array.from(allBlocks).indexOf(blockEl);
      editingBlockLine = Number(blockEl.dataset.mklyLine);
      // Extract the block class for type matching
      const classes = blockEl.className.split(/\s+/);
      editingBlockClass = classes.find(c => c.startsWith('mkly-') && !c.includes('__') && !c.includes('--')) ?? null;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!iframe?.contentDocument) return;

      // Strip editable and source map attributes from HTML before reverse conversion
      let editedHtml = iframe.contentDocument.body.innerHTML;
      editedHtml = editedHtml
        .replace(/\s+contenteditable="(true|false)"/g, '')
        .replace(/\s+data-mkly-(?!styles)[\w-]+(?:="[^"]*")?/g, '');

      try {
        const source = htmlToMkly(editedHtml, {
          kits: { core: CORE_KIT, newsletter: NEWSLETTER_KIT },
        });

        // Find the corresponding block line in the NEW source.
        // Strategy: count block delimiters (skipping meta/use/style/theme and closing tags).
        // Also match on block type (CSS class → block type prefix) for robustness.
        if (editingBlockIndex >= 0) {
          const lines = source.split('\n');
          let blockCount = 0;
          let matched = false;

          for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            const match = trimmed.match(/^---\s+([\w/]+)/);
            if (match && !trimmed.startsWith('--- /')) {
              if (!SKIP_TYPES.has(match[1])) {
                if (blockCount === editingBlockIndex) {
                  useEditorStore.getState().focusBlock(i + 1, 'edit');
                  matched = true;
                  break;
                }
                blockCount++;
              }
            }
          }

          // Fallback: if index didn't match (block count changed), try matching by
          // the original mkly-line value in the new source
          if (!matched && editingBlockLine > 0) {
            for (let i = 0; i < lines.length; i++) {
              const trimmed = lines[i].trim();
              const match = trimmed.match(/^---\s+([\w/]+)/);
              if (match && !trimmed.startsWith('--- /') && !SKIP_TYPES.has(match[1])) {
                // Match by block type if we have the CSS class
                if (editingBlockClass) {
                  const blockType = match[1];
                  const expectedClass = `mkly-${blockType.replace('/', '-')}`;
                  if (expectedClass === editingBlockClass) {
                    useEditorStore.getState().focusBlock(i + 1, 'edit');
                    break;
                  }
                }
              }
            }
          }
        }

        // Skip no-op source updates: if reverse-compiled source differs
        // textually but compiles to the same HTML, don't trigger a re-render
        const currentSource = useEditorStore.getState().source;
        if (source !== currentSource) {
          try {
            const testResult = mkly(source, {
              kits: { core: CORE_KIT, newsletter: NEWSLETTER_KIT },
              sourceMap: true,
            });
            const currentHtml = useEditorStore.getState().html;
            if (testResult.html !== currentHtml) {
              setSource(source);
            }
          } catch {
            setSource(source);
          }
        }
      } catch {
        // Silently ignore reverse conversion errors during editing
      }

      setTimeout(() => {
        isEditingRef.current = false;
      }, 200);
    }, 300);
  }, [setSource]);
  handleInputRef.current = handleInput;

  useEffect(() => {
    if (isEditingRef.current) return;
    if (html === lastHtmlRef.current) return;
    lastHtmlRef.current = html;
    writeToIframe(html);
  }, [html, writeToIframe]);

  // ALWAYS highlight active block, CONDITIONAL scroll
  // Include focusVersion so tab-switch events (which bump version) trigger scroll after scrollLock clears
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

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Editable Preview"
      style={{
        flex: 1,
        border: 'none',
        background: 'white',
      }}
    />
  );
}
