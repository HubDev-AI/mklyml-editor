import type { EditorView } from '@codemirror/view';

/**
 * Check if a CodeMirror line is currently visible in the scroll viewport.
 */
export function isCmLineVisible(view: EditorView, lineFrom: number): boolean {
  try {
    const line = view.state.doc.line(lineFrom);
    const lineTop = view.lineBlockAt(line.from).top;
    const lineBottom = view.lineBlockAt(line.from).bottom;
    const { top, bottom } = view.scrollDOM.getBoundingClientRect();
    const scrollTop = view.scrollDOM.scrollTop;
    const visibleTop = scrollTop;
    const visibleBottom = scrollTop + (bottom - top);
    return lineTop >= visibleTop && lineBottom <= visibleBottom;
  } catch {
    return false;
  }
}

/**
 * Scroll a CodeMirror editor to a line only if it's not currently visible.
 * Uses 'nearest' to minimize displacement.
 */
export function scrollCmIfNeeded(view: EditorView, lineFrom: number): void {
  if (isCmLineVisible(view, lineFrom)) return;
  try {
    const line = view.state.doc.line(lineFrom);
    view.dispatch({
      effects: view.scrollSnapshot(),
      selection: undefined,
    });
    const pos = line.from;
    view.dispatch({
      effects: [],
      scrollIntoView: false,
    });
    // Use requestMeasure for accurate scrolling
    view.requestMeasure({
      read() {
        return view.coordsAtPos(pos);
      },
      write(coords) {
        if (!coords) return;
        const scrollDOM = view.scrollDOM;
        const rect = scrollDOM.getBoundingClientRect();
        if (coords.top < rect.top) {
          scrollDOM.scrollTop -= rect.top - coords.top + 20;
        } else if (coords.bottom > rect.bottom) {
          scrollDOM.scrollTop += coords.bottom - rect.bottom + 20;
        }
      },
    });
  } catch {
    // Ignore invalid line numbers
  }
}

/**
 * Check if a DOM element is visible within its scroll container.
 */
export function isDomElementVisible(el: Element, container: Element): boolean {
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return (
    elRect.top >= containerRect.top &&
    elRect.bottom <= containerRect.bottom
  );
}

/**
 * Scroll a DOM element into view within its container only if not visible.
 * Uses 'nearest' to minimize displacement.
 */
export function scrollDomIfNeeded(el: Element, container: Element): void {
  if (isDomElementVisible(el, container)) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
