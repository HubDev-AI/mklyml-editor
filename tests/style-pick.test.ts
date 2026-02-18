import { describe, it, expect } from 'bun:test';
import {
  detectTarget,
  extractBlockType,
  generateStyleClass,
  injectClassAnnotation,
  generateBlockLabel,
  injectBlockLabel,
  findSourceLine,
  resolveInlineElement,
} from '../src/preview/target-detect';
import { Window } from 'happy-dom';

// ---------------------------------------------------------------------------
// Happy-DOM setup — browser-like Document for testing
// ---------------------------------------------------------------------------
const _window = new Window();
(globalThis as Record<string, unknown>).HTMLElement = _window.HTMLElement;
(globalThis as Record<string, unknown>).Element = _window.Element;
(globalThis as Record<string, unknown>).Node = _window.Node;
(globalThis as Record<string, unknown>).Document = _window.Document;

function createDoc(html: string): Document {
  const win = new Window();
  const doc = win.document as unknown as Document;
  doc.write(`<!DOCTYPE html><html><body>${html}</body></html>`);
  return doc;
}

// ===== detectTarget =====

describe('detectTarget', () => {
  it('returns "self" when clicking the block root', () => {
    const doc = createDoc('<div class="mkly-core-card" data-mkly-id="core/card:1"></div>');
    const block = doc.querySelector('[data-mkly-id]')!;
    expect(detectTarget(block, block)).toBe('self');
  });

  it('returns BEM target when clicking a sub-element', () => {
    const doc = createDoc(`
      <div class="mkly-core-card" data-mkly-id="core/card:1">
        <a class="mkly-core-card__link" href="#">Link</a>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const link = doc.querySelector('.mkly-core-card__link')!;
    expect(detectTarget(link, block)).toBe('link');
  });

  it('returns BEM target when clicking inside a sub-element', () => {
    const doc = createDoc(`
      <div class="mkly-core-card" data-mkly-id="core/card:1">
        <div class="mkly-core-card__body"><p>Text</p></div>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const p = doc.querySelector('p')!;
    expect(detectTarget(p, block)).toBe('body');
  });

  it('returns tag target for non-BEM elements', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <p>Paragraph</p>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const p = doc.querySelector('p')!;
    expect(detectTarget(p, block)).toBe('>p');
  });

  it('returns "self" for generic wrapper elements', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <div><p>Nested</p></div>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const inner = doc.querySelector('div div')!;
    expect(detectTarget(inner, block)).toBe('self');
  });

  it('returns style class target when element has sN class', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <li class="s3">Item</li>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const li = doc.querySelector('.s3')!;
    expect(detectTarget(li, block)).toBe('>.s3');
  });

  it('prioritizes style class over tag target', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <li class="s1">Styled</li>
        <li>Unstyled</li>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const styled = doc.querySelector('.s1')!;
    const unstyled = doc.querySelectorAll('li')[1]!;
    expect(detectTarget(styled, block)).toBe('>.s1');
    expect(detectTarget(unstyled, block)).toBe('>li');
  });

  it('resolves <strong> inside <p> to >p', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <p><strong>Bold text</strong></p>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const strong = doc.querySelector('strong')!;
    expect(detectTarget(strong, block)).toBe('>p');
  });

  it('resolves <a> inside <li> to >li', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <ul><li><a href="#">Link</a></li></ul>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const a = doc.querySelector('a')!;
    expect(detectTarget(a, block)).toBe('>li');
  });

  it('resolves <code> inside <p> to >p', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <p>Some <code>inline code</code> here</p>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const code = doc.querySelector('code')!;
    expect(detectTarget(code, block)).toBe('>p');
  });

  it('does not resolve <p> — already block-level', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <p>Paragraph</p>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const p = doc.querySelector('p')!;
    expect(detectTarget(p, block)).toBe('>p');
  });

  it('resolves <em> inside <li class="s1"> to >.s1', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <ul><li class="s1"><em>Italic</em></li></ul>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const em = doc.querySelector('em')!;
    expect(detectTarget(em, block)).toBe('>.s1');
  });

  it('resolves nested inline (em inside strong) to parent block', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <p><strong><em>Bold italic</em></strong></p>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const em = doc.querySelector('em')!;
    expect(detectTarget(em, block)).toBe('>p');
  });

  it('resolves inline element to "self" when only wrappers above', () => {
    const doc = createDoc(`
      <div class="mkly-core-text" data-mkly-id="core/text:1">
        <span>Direct inline</span>
      </div>
    `);
    const block = doc.querySelector('[data-mkly-id]')!;
    const span = doc.querySelector('span')!;
    expect(detectTarget(span, block)).toBe('self');
  });
});

// ===== resolveInlineElement =====

describe('resolveInlineElement', () => {
  it('returns the same element for block-level tags', () => {
    const doc = createDoc('<div id="root"><p>Text</p></div>');
    const root = doc.querySelector('#root')!;
    const p = doc.querySelector('p')!;
    expect(resolveInlineElement(p, root)).toBe(p);
  });

  it('walks up from inline to block-level parent', () => {
    const doc = createDoc('<div id="root"><p><strong>Bold</strong></p></div>');
    const root = doc.querySelector('#root')!;
    const strong = doc.querySelector('strong')!;
    const p = doc.querySelector('p')!;
    expect(resolveInlineElement(strong, root)).toBe(p);
  });

  it('walks through multiple inline levels', () => {
    const doc = createDoc('<div id="root"><li><a><em>Text</em></a></li></div>');
    const root = doc.querySelector('#root')!;
    const em = doc.querySelector('em')!;
    const li = doc.querySelector('li')!;
    expect(resolveInlineElement(em, root)).toBe(li);
  });

  it('stops at root and returns root', () => {
    const doc = createDoc('<div id="root"><span>Direct</span></div>');
    const root = doc.querySelector('#root')!;
    const span = doc.querySelector('span')!;
    expect(resolveInlineElement(span, root)).toBe(root);
  });
});

// ===== extractBlockType =====

describe('extractBlockType', () => {
  it('extracts block type from data-mkly-id', () => {
    const doc = createDoc('<div data-mkly-id="core/card:5"></div>');
    const el = doc.querySelector('[data-mkly-id]')!;
    expect(extractBlockType(el)).toBe('core/card');
  });

  it('returns null for elements without data-mkly-id', () => {
    const doc = createDoc('<div></div>');
    const el = doc.querySelector('div')!;
    expect(extractBlockType(el)).toBeNull();
  });

  it('handles nested block type paths', () => {
    const doc = createDoc('<div data-mkly-id="newsletter/item:3"></div>');
    const el = doc.querySelector('[data-mkly-id]')!;
    expect(extractBlockType(el)).toBe('newsletter/item');
  });
});

// ===== generateStyleClass =====

describe('generateStyleClass', () => {
  it('returns s1 when no existing classes', () => {
    expect(generateStyleClass('--- core/text\nHello world')).toBe('s1');
  });

  it('increments past existing classes', () => {
    expect(generateStyleClass('- item {.s1}\n- item {.s2}')).toBe('s3');
  });

  it('finds the max, not just count', () => {
    expect(generateStyleClass('- item {.s5}')).toBe('s6');
  });

  it('handles source with no annotations', () => {
    expect(generateStyleClass('--- core/card\ntitle: Hello\n\nSome content')).toBe('s1');
  });

  it('does not collide with existing block labels', () => {
    const src = '--- newsletter/recommendations: s1\ntitle: Weekend Reads';
    expect(generateStyleClass(src)).toBe('s2');
  });

  it('does not collide with existing labeled style selectors', () => {
    const src = [
      '--- style',
      'newsletter/recommendations:s3',
      '  >.s2',
      '    text-align: center',
    ].join('\n');
    expect(generateStyleClass(src)).toBe('s4');
  });
});

// ===== injectClassAnnotation =====

describe('injectClassAnnotation', () => {
  const source = [
    '--- core/text',    // line 1
    '- item one',       // line 2
    '- item two',       // line 3
    '- item three',     // line 4
  ].join('\n');

  it('injects class on the correct line (1-based)', () => {
    const result = injectClassAnnotation(source, 3, 's1');
    expect(result).not.toBeNull();
    const lines = result!.split('\n');
    expect(lines[2]).toBe('- item two {.s1}');
  });

  it('injects on first content line', () => {
    const result = injectClassAnnotation(source, 2, 's1');
    expect(result).not.toBeNull();
    const lines = result!.split('\n');
    expect(lines[1]).toBe('- item one {.s1}');
  });

  it('injects on last content line', () => {
    const result = injectClassAnnotation(source, 4, 's1');
    expect(result).not.toBeNull();
    const lines = result!.split('\n');
    expect(lines[3]).toBe('- item three {.s1}');
  });

  it('skips blank lines and scans backward', () => {
    const src = '--- core/text\n- item\n\n';
    // Line 3 is blank, should scan back to line 2
    const result = injectClassAnnotation(src, 3, 's1');
    expect(result).not.toBeNull();
    const lines = result!.split('\n');
    expect(lines[1]).toBe('- item {.s1}');
  });

  it('skips block headers and scans backward', () => {
    const src = '--- core/text\ncontent here\n--- core/card\ntitle: Hello';
    // Line 3 is "--- core/card", should scan back to line 2
    const result = injectClassAnnotation(src, 3, 's1');
    expect(result).not.toBeNull();
    const lines = result!.split('\n');
    expect(lines[1]).toBe('content here {.s1}');
  });

  it('does not double-inject on lines with existing class', () => {
    const src = '--- core/text\n- item {.s1}';
    const result = injectClassAnnotation(src, 2, 's2');
    expect(result).toBeNull();
  });

  it('returns null for out-of-bounds line numbers', () => {
    expect(injectClassAnnotation(source, 0, 's1')).toBeNull();
    expect(injectClassAnnotation(source, 99, 's1')).toBeNull();
  });

  it('returns null when no content line found (all headers/blank)', () => {
    const src = '--- core/text\n';
    const result = injectClassAnnotation(src, 1, 's1');
    // Line 1 is "--- core/text", scans back — no content found
    expect(result).toBeNull();
  });
});

// ===== generateBlockLabel =====

describe('generateBlockLabel', () => {
  it('returns s1 when no existing labels', () => {
    expect(generateBlockLabel('--- core/card\ntitle: Hello')).toBe('s1');
  });

  it('increments past existing labels', () => {
    const src = '--- core/card: s1\ntitle: A\n\n--- core/card: s2\ntitle: B';
    expect(generateBlockLabel(src)).toBe('s3');
  });

  it('finds the max label number', () => {
    const src = '--- core/card: s5\ntitle: Test';
    expect(generateBlockLabel(src)).toBe('s6');
  });

  it('does not collide with existing class annotations', () => {
    const src = '--- core/text\n- Item one {.s1}\n- Item two';
    expect(generateBlockLabel(src)).toBe('s2');
  });
});

// ===== injectBlockLabel =====

describe('injectBlockLabel', () => {
  const source = [
    '--- core/card',     // line 1
    'title: My Card',    // line 2
    '',                  // line 3
    '--- core/text',     // line 4
    'Some content',      // line 5
  ].join('\n');

  it('injects label on the correct block header (1-based line)', () => {
    const result = injectBlockLabel(source, 1, 's1');
    expect(result).not.toBeNull();
    const lines = result!.split('\n');
    expect(lines[0]).toBe('--- core/card: s1');
    // Other lines unchanged
    expect(lines[1]).toBe('title: My Card');
  });

  it('injects label on second block header', () => {
    const result = injectBlockLabel(source, 4, 's1');
    expect(result).not.toBeNull();
    const lines = result!.split('\n');
    expect(lines[3]).toBe('--- core/text: s1');
  });

  it('returns null if line already has a label', () => {
    const src = '--- core/card: hero\ntitle: Hello';
    const result = injectBlockLabel(src, 1, 's1');
    expect(result).toBeNull();
  });

  it('returns null for non-header lines', () => {
    // Line 2 is "title: My Card" — not a block header
    const result = injectBlockLabel(source, 2, 's1');
    expect(result).toBeNull();
  });

  it('returns null for out-of-bounds line numbers', () => {
    expect(injectBlockLabel(source, 0, 's1')).toBeNull();
    expect(injectBlockLabel(source, 99, 's1')).toBeNull();
  });

  it('handles block types with paths', () => {
    const src = '--- newsletter/item\nSome content';
    const result = injectBlockLabel(src, 1, 's1');
    expect(result).not.toBeNull();
    expect(result!.split('\n')[0]).toBe('--- newsletter/item: s1');
  });
});

// ===== findSourceLine =====

describe('findSourceLine', () => {
  it('finds data-mkly-line on the element itself', () => {
    const doc = createDoc('<div data-mkly-line="5"><p>Text</p></div>');
    const el = doc.querySelector('div')!;
    const result = findSourceLine(el, el);
    expect(result).not.toBeNull();
    expect(result!.lineNum).toBe(5);
  });

  it('walks up to parent with data-mkly-line', () => {
    const doc = createDoc('<div data-mkly-line="3"><span><em>Text</em></span></div>');
    const em = doc.querySelector('em')!;
    const block = doc.querySelector('div')!;
    const result = findSourceLine(em, block);
    expect(result).not.toBeNull();
    expect(result!.lineNum).toBe(3);
  });

  it('returns null when no data-mkly-line found', () => {
    const doc = createDoc('<div><span>Text</span></div>');
    const span = doc.querySelector('span')!;
    const block = doc.querySelector('div')!;
    const result = findSourceLine(span, block);
    expect(result).toBeNull();
  });

  it('stops at the stopAt element', () => {
    const doc = createDoc(`
      <div data-mkly-line="1">
        <div data-mkly-line="3">
          <p>Text</p>
        </div>
      </div>
    `);
    const p = doc.querySelector('p')!;
    const inner = doc.querySelector('[data-mkly-line="3"]')!;
    const result = findSourceLine(p, inner);
    expect(result).not.toBeNull();
    expect(result!.lineNum).toBe(3);
  });
});
