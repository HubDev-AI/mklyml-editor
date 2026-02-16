import { describe, it, expect } from 'bun:test';
import { Window } from 'happy-dom';

// ---------------------------------------------------------------------------
// Happy-DOM setup — provides a browser-like Document for testing.
// morphdom needs global HTMLElement, so we install happy-dom globals.
// ---------------------------------------------------------------------------

const _window = new Window();
(globalThis as Record<string, unknown>).HTMLElement = _window.HTMLElement;
(globalThis as Record<string, unknown>).Element = _window.Element;
(globalThis as Record<string, unknown>).Node = _window.Node;
(globalThis as Record<string, unknown>).Document = _window.Document;
(globalThis as Record<string, unknown>).DOMParser = _window.DOMParser;
(globalThis as Record<string, unknown>).document = _window.document;

// Import AFTER globals are set so morphdom finds HTMLElement
const { morphIframeContent } = await import('../src/preview/iframe-morph');

function createDoc(html: string): Document {
  const win = new Window();
  const doc = win.document as unknown as Document;
  doc.write(html);
  return doc;
}

const BASE_CSS = `@layer kit, theme, preset, user;
@layer kit { .mkly-core-heading { font-weight: bold; } }`;

const UPDATED_CSS = `@layer kit, theme, preset, user;
@layer kit { .mkly-core-heading { font-weight: bold; color: red; } }`;

function makeHtml(css: string, body: string): string {
  return `<!DOCTYPE html><html><head><style>${css}</style></head><body>${body}</body></html>`;
}

function makeBody(blocks: string): string {
  return `<style>${BASE_CSS}</style>
<meta name="mkly:version" content="1">
<main class="mkly-document" style="max-width:600px;margin:0 auto;">${blocks}</main>`;
}

function makeBodyWithCss(css: string, blocks: string): string {
  return `<style>${css}</style>
<meta name="mkly:version" content="1">
<main class="mkly-document" style="max-width:600px;margin:0 auto;">${blocks}</main>`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('morphIframeContent', () => {
  describe('returns false when iframe is not initialized', () => {
    it('empty document', () => {
      const doc = createDoc('<!DOCTYPE html><html><body></body></html>');
      const ok = morphIframeContent(doc, makeHtml(BASE_CSS, '<main class="mkly-document"></main>'));
      expect(ok).toBe(false);
    });

    it('no .mkly-document in new HTML', () => {
      const doc = createDoc(makeHtml(BASE_CSS, '<main class="mkly-document"><div>content</div></main>'));
      const ok = morphIframeContent(doc, '<html><body><p>no document</p></body></html>');
      expect(ok).toBe(false);
    });
  });

  describe('CSS-only changes', () => {
    it('updates compiled style tag without touching DOM structure', () => {
      const blocks = '<h2 data-mkly-line="5" class="mkly-core-heading">Hello</h2>';
      const doc = createDoc(makeHtml(BASE_CSS, `<main class="mkly-document">${blocks}</main>`));

      const heading = doc.querySelector('.mkly-core-heading');
      expect(heading).toBeTruthy();

      const newHtml = makeHtml(UPDATED_CSS, `<main class="mkly-document">${blocks}</main>`);
      const ok = morphIframeContent(doc, newHtml);

      expect(ok).toBe(true);

      // Style tag updated
      const style = doc.querySelector('style');
      expect(style?.textContent).toContain('color: red');

      // DOM structure unchanged — same element, same content
      const sameHeading = doc.querySelector('.mkly-core-heading');
      expect(sameHeading?.textContent).toBe('Hello');
      expect(sameHeading?.getAttribute('data-mkly-line')).toBe('5');
    });
  });

  describe('content changes', () => {
    it('morphs text content within a block', () => {
      const doc = createDoc(makeHtml(BASE_CSS,
        '<main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">Hello</h2></main>'));

      const ok = morphIframeContent(doc, makeHtml(BASE_CSS,
        '<main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">World</h2></main>'));

      expect(ok).toBe(true);
      expect(doc.querySelector('.mkly-core-heading')?.textContent).toBe('World');
    });

    it('adds a new block', () => {
      const doc = createDoc(makeHtml(BASE_CSS,
        '<main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">Title</h2></main>'));

      const ok = morphIframeContent(doc, makeHtml(BASE_CSS,
        `<main class="mkly-document">
          <h2 data-mkly-line="5" class="mkly-core-heading">Title</h2>
          <div data-mkly-line="8" class="mkly-core-text"><p>New text</p></div>
        </main>`));

      expect(ok).toBe(true);
      const blocks = doc.querySelectorAll('[data-mkly-line]');
      expect(blocks.length).toBe(2);
      expect(doc.querySelector('.mkly-core-text')?.textContent).toBe('New text');
    });

    it('removes a block', () => {
      const doc = createDoc(makeHtml(BASE_CSS,
        `<main class="mkly-document">
          <h2 data-mkly-line="5" class="mkly-core-heading">Title</h2>
          <div data-mkly-line="8" class="mkly-core-text"><p>Text</p></div>
        </main>`));

      const ok = morphIframeContent(doc, makeHtml(BASE_CSS,
        '<main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">Title</h2></main>'));

      expect(ok).toBe(true);
      const blocks = doc.querySelectorAll('[data-mkly-line]');
      expect(blocks.length).toBe(1);
      expect(doc.querySelector('.mkly-core-text')).toBeNull();
    });
  });

  describe('attribute preservation', () => {
    it('preserves data-mkly-active on active block', () => {
      const doc = createDoc(makeHtml(BASE_CSS,
        '<main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">Hello</h2></main>'));

      // Simulate editor highlighting the active block
      doc.querySelector('.mkly-core-heading')!.setAttribute('data-mkly-active', '');

      // Morph with updated content
      const ok = morphIframeContent(doc, makeHtml(BASE_CSS,
        '<main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">Hello!</h2></main>'));

      expect(ok).toBe(true);
      expect(doc.querySelector('.mkly-core-heading')?.hasAttribute('data-mkly-active')).toBe(true);
    });

    it('preserves data-mkly-style-hover during style pick', () => {
      const doc = createDoc(makeHtml(BASE_CSS,
        '<main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">Hello</h2></main>'));

      doc.querySelector('.mkly-core-heading')!.setAttribute('data-mkly-style-hover', '');

      const ok = morphIframeContent(doc, makeHtml(UPDATED_CSS,
        '<main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">Hello</h2></main>'));

      expect(ok).toBe(true);
      expect(doc.querySelector('.mkly-core-heading')?.hasAttribute('data-mkly-style-hover')).toBe(true);
    });

    it('updates data-mkly-line when lines shift', () => {
      const doc = createDoc(makeHtml(BASE_CSS,
        '<main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">Title</h2></main>'));

      const ok = morphIframeContent(doc, makeHtml(BASE_CSS,
        '<main class="mkly-document"><h2 data-mkly-line="7" class="mkly-core-heading">Title</h2></main>'));

      expect(ok).toBe(true);
      expect(doc.querySelector('.mkly-core-heading')?.getAttribute('data-mkly-line')).toBe('7');
    });
  });

  describe('meta and script tags', () => {
    it('syncs meta tags', () => {
      const doc = createDoc(makeHtml(BASE_CSS,
        `<meta name="mkly:version" content="1">
         <main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">Hi</h2></main>`));

      const ok = morphIframeContent(doc,
        makeHtml(BASE_CSS,
          `<meta name="mkly:version" content="2">
           <meta name="mkly:use" content="newsletter">
           <main class="mkly-document"><h2 data-mkly-line="5" class="mkly-core-heading">Hi</h2></main>`));

      expect(ok).toBe(true);
      const metas = doc.querySelectorAll('meta[name^="mkly:"]');
      expect(metas.length).toBe(2);
    });

    it('syncs script data tags', () => {
      const doc = createDoc(makeHtml(BASE_CSS,
        `<script type="text/mkly-style">old data</script>
         <main class="mkly-document"><div data-mkly-line="5" class="mkly-core-text">Hi</div></main>`));

      const ok = morphIframeContent(doc,
        makeHtml(BASE_CSS,
          `<script type="text/mkly-style">new data</script>
           <main class="mkly-document"><div data-mkly-line="5" class="mkly-core-text">Hi</div></main>`));

      expect(ok).toBe(true);
      const script = doc.querySelector('script[type="text/mkly-style"]');
      expect(script?.textContent).toBe('new data');
    });
  });

  describe('mixed changes (CSS + content)', () => {
    it('handles simultaneous CSS and content update', () => {
      const doc = createDoc(makeHtml(BASE_CSS,
        `<main class="mkly-document">
          <h2 data-mkly-line="5" class="mkly-core-heading">Old Title</h2>
          <div data-mkly-line="8" class="mkly-core-text"><p>Old text</p></div>
        </main>`));

      const ok = morphIframeContent(doc, makeHtml(UPDATED_CSS,
        `<main class="mkly-document">
          <h2 data-mkly-line="5" class="mkly-core-heading">New Title</h2>
          <div data-mkly-line="8" class="mkly-core-text"><p>New text</p></div>
        </main>`));

      expect(ok).toBe(true);

      // CSS updated
      const style = doc.querySelector('style');
      expect(style?.textContent).toContain('color: red');

      // Content updated
      expect(doc.querySelector('.mkly-core-heading')?.textContent).toBe('New Title');
      expect(doc.querySelector('.mkly-core-text')?.textContent).toBe('New text');
    });
  });

  describe('body-context content (EditablePreview pattern)', () => {
    it('morphs when style tag is in body (not head)', () => {
      // EditablePreview puts compiled CSS style tag inside <body>
      const bodyContent = makeBody(
        '<h2 data-mkly-line="5" class="mkly-core-heading">Hello</h2>');
      const doc = createDoc(
        `<!DOCTYPE html><html><head><style>.edit{}</style></head><body>${bodyContent}</body></html>`);

      const newBodyContent = makeBodyWithCss(UPDATED_CSS,
        '<h2 data-mkly-line="5" class="mkly-core-heading">World</h2>');
      const newHtml = `<!DOCTYPE html><html><head><style>.edit{}</style></head><body>${newBodyContent}</body></html>`;

      const ok = morphIframeContent(doc, newHtml);
      expect(ok).toBe(true);
      expect(doc.querySelector('.mkly-core-heading')?.textContent).toBe('World');
    });
  });
});
