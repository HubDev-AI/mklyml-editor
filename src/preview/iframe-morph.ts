import morphdom from 'morphdom';

/**
 * Update an iframe's compiled CSS by patching the <style> tag that contains @layer.
 * Returns true if CSS was found and updated.
 */
function updateCompiledCss(doc: Document, newDoc: Document): boolean {
  // Find the compiled style tag (contains @layer) — might be in head or body
  const find = (d: Document) => {
    for (const s of d.querySelectorAll('style')) {
      if (s.textContent?.includes('@layer')) return s;
    }
    return null;
  };

  const existing = find(doc);
  const next = find(newDoc);

  if (existing && next) {
    if (existing.textContent !== next.textContent) {
      existing.textContent = next.textContent;
    }
    return true;
  }
  return false;
}

/**
 * Sync <meta name="mkly:*"> tags between documents.
 */
function syncMetaTags(doc: Document, newDoc: Document): void {
  const container = doc.head ?? doc.body;
  if (!container) return;

  doc.querySelectorAll('meta[name^="mkly:"]').forEach((m) => m.remove());

  const anchor = doc.querySelector('.mkly-document') ?? null;
  for (const m of newDoc.querySelectorAll('meta[name^="mkly:"]')) {
    const clone = doc.importNode(m, true);
    if (anchor?.parentNode) {
      anchor.parentNode.insertBefore(clone, anchor);
    } else {
      container.appendChild(clone);
    }
  }
}

/**
 * Sync <script type="text/mkly-*"> data tags.
 */
function syncScriptTags(doc: Document, newDoc: Document): void {
  for (const type of ['text/mkly-style', 'text/mkly-defines']) {
    const existing = doc.querySelector(`script[type="${type}"]`);
    const next = newDoc.querySelector(`script[type="${type}"]`);

    if (existing && next) {
      if (existing.textContent !== next.textContent) {
        existing.textContent = next.textContent;
      }
    } else if (!existing && next) {
      const clone = doc.importNode(next, true);
      const anchor = doc.querySelector('.mkly-document');
      if (anchor?.parentNode) {
        anchor.parentNode.insertBefore(clone, anchor);
      } else {
        (doc.body ?? doc.documentElement).appendChild(clone);
      }
    } else if (existing && !next) {
      existing.remove();
    }
  }
}

/**
 * Morph an iframe's content using DOM diffing instead of doc.open()/write()/close().
 *
 * Preserves:
 * - Scroll position (DOM stays in place, no reset)
 * - Body-level event handlers (mousedown, input, click)
 * - Focus state on unchanged elements
 *
 * Returns false if the iframe hasn't been initialized (caller should do full doc.write).
 */
export function morphIframeContent(doc: Document, newHtml: string): boolean {
  const existingMain = doc.querySelector('.mkly-document');
  if (!existingMain) return false;

  // Parse new HTML into a temporary document
  const parser = doc.defaultView?.DOMParser
    ? new (doc.defaultView.DOMParser)()
    : new DOMParser();
  const newDoc = parser.parseFromString(newHtml, 'text/html');

  const newMain = newDoc.querySelector('.mkly-document');
  if (!newMain) return false;

  // 1. Update compiled CSS
  updateCompiledCss(doc, newDoc);

  // 2. Sync metadata
  syncMetaTags(doc, newDoc);

  // 3. Sync script data tags
  syncScriptTags(doc, newDoc);

  // 4. Morph the .mkly-document element (content + attributes)
  morphdom(existingMain, newMain, {
    onBeforeElUpdated(fromEl, toEl) {
      // Preserve data-mkly-active highlight (set by editor, not in compiled HTML)
      if (fromEl.hasAttribute('data-mkly-active')) {
        toEl.setAttribute('data-mkly-active', '');
      }
      // Preserve style-pick hover highlight
      if (fromEl.hasAttribute('data-mkly-style-hover')) {
        toEl.setAttribute('data-mkly-style-hover', '');
      }
      // Preserve authoritative style selection marker across source recompiles.
      const selectedId = fromEl.getAttribute('data-mkly-style-selected');
      if (selectedId !== null) {
        toEl.setAttribute('data-mkly-style-selected', selectedId);
      }
      return true;
    },
  });

  return true;
}
