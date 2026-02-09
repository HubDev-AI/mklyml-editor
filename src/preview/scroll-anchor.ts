export interface ScrollAnchor {
  line: number;
  offset: number;
  elementIndex: number;
  viewportRatio: number;
}

export function captureScrollAnchor(doc: Document): ScrollAnchor | null {
  const elements = doc.querySelectorAll<HTMLElement>('[data-mkly-line]');
  const win = doc.defaultView;
  const viewportHeight = win?.innerHeight ?? 600;

  for (let idx = 0; idx < elements.length; idx++) {
    const el = elements[idx];
    const rect = el.getBoundingClientRect();
    if (rect.top >= 0) {
      const line = Number(el.dataset.mklyLine);
      if (!isNaN(line)) {
        return {
          line,
          offset: rect.top,
          elementIndex: idx,
          viewportRatio: viewportHeight > 0 ? rect.top / viewportHeight : 0,
        };
      }
    }
  }

  // If no element has top >= 0, use the last one above the viewport
  if (elements.length > 0) {
    const lastIdx = elements.length - 1;
    const last = elements[lastIdx];
    const line = Number(last.dataset.mklyLine);
    if (!isNaN(line)) {
      const rect = last.getBoundingClientRect();
      return {
        line,
        offset: rect.top,
        elementIndex: lastIdx,
        viewportRatio: viewportHeight > 0 ? rect.top / viewportHeight : 0,
      };
    }
  }
  return null;
}

export function restoreScrollAnchor(doc: Document, anchor: ScrollAnchor): void {
  const win = doc.defaultView;
  if (!win) return;

  // Tier 1: Try exact line match
  const byLine = doc.querySelector<HTMLElement>(`[data-mkly-line="${anchor.line}"]`);
  if (byLine) {
    const currentTop = byLine.getBoundingClientRect().top;
    win.scrollBy(0, currentTop - anchor.offset);
    return;
  }

  // Tier 2: Try element index fallback
  const elements = doc.querySelectorAll<HTMLElement>('[data-mkly-line]');
  const idx = Math.min(anchor.elementIndex, elements.length - 1);
  if (idx >= 0 && elements[idx]) {
    const currentTop = elements[idx].getBoundingClientRect().top;
    win.scrollBy(0, currentTop - anchor.offset);
    return;
  }

  // Tier 3: Use viewport ratio to approximate position
  const bodyHeight = doc.body?.scrollHeight ?? 0;
  if (bodyHeight > 0) {
    const targetScroll = anchor.viewportRatio * bodyHeight;
    win.scrollTo(0, targetScroll);
  }
}
