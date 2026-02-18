import { describe, test, expect } from 'bun:test';
import {
  findLineForBlockIndex,
  findBlockByOriginalLine,
  blockClassToType,
  findLineForBlockIndex as _findLineForBlockIndex,
} from './reverse-helpers';
import { resolveBlockLine, findHtmlPositionForBlock } from '../store/selection-orchestrator';

// ─── Shared test sources ───

const SIMPLE_SOURCE = `--- use: core
--- use: newsletter

--- core/header
title: My Newsletter

--- core/hero
image: https://example.com/hero.jpg

# Welcome

--- newsletter/intro

Hello world!

--- core/section
title: Features

--- core/card
link: https://example.com

## Card One

Content here.

--- core/card
link: https://example.com/2

## Card Two

More content.

--- /core/section

--- newsletter/category
title: Quick Reads

--- newsletter/item
source: The Verge
link: https://example.com/story-1

First story about tech.

--- newsletter/item
source: Wired
link: https://example.com/story-2

Second story about design.

--- /newsletter/category

--- newsletter/quickHits

- **TypeScript 6.0** is out
- **Bun 1.3** adds SQLite

--- core/footer

[Unsubscribe](https://example.com/unsub)
`;

// ─── blockClassToType ───

describe('blockClassToType', () => {
  test('converts core block classes', () => {
    expect(blockClassToType('mkly-core-header')).toBe('core/header');
    expect(blockClassToType('mkly-core-hero')).toBe('core/hero');
    expect(blockClassToType('mkly-core-card')).toBe('core/card');
    expect(blockClassToType('mkly-core-footer')).toBe('core/footer');
    expect(blockClassToType('mkly-core-section')).toBe('core/section');
    expect(blockClassToType('mkly-core-cta')).toBe('core/cta');
  });

  test('converts newsletter block classes', () => {
    expect(blockClassToType('mkly-newsletter-intro')).toBe('newsletter/intro');
    expect(blockClassToType('mkly-newsletter-item')).toBe('newsletter/item');
    expect(blockClassToType('mkly-newsletter-category')).toBe('newsletter/category');
    expect(blockClassToType('mkly-newsletter-quickHits')).toBe('newsletter/quickHits');
    expect(blockClassToType('mkly-newsletter-personalNote')).toBe('newsletter/personalNote');
    expect(blockClassToType('mkly-newsletter-outro')).toBe('newsletter/outro');
  });

  test('returns null for non-mkly classes', () => {
    expect(blockClassToType('some-other-class')).toBeNull();
    expect(blockClassToType('')).toBeNull();
  });

  test('handles single-segment types', () => {
    expect(blockClassToType('mkly-custom')).toBe('custom');
  });
});

// ─── findLineForBlockIndex ───

describe('findLineForBlockIndex', () => {
  test('finds first content block (index 0)', () => {
    const line = findLineForBlockIndex(SIMPLE_SOURCE, 0);
    const lines = SIMPLE_SOURCE.split('\n');
    expect(lines[(line ?? 0) - 1].trim()).toBe('--- core/header');
  });

  test('finds newsletter/intro by index', () => {
    const line = findLineForBlockIndex(SIMPLE_SOURCE, 2);
    const lines = SIMPLE_SOURCE.split('\n');
    expect(lines[(line ?? 0) - 1].trim()).toBe('--- newsletter/intro');
  });

  test('skips use/meta/theme/style blocks', () => {
    const source = `--- use: core
--- meta
version: 1
--- style
accent: red
--- core/header
title: Test
--- core/text

Hello
`;
    const line = findLineForBlockIndex(source, 0);
    const lines = source.split('\n');
    expect(lines[(line ?? 0) - 1].trim()).toBe('--- core/header');
  });

  test('skips preset blocks', () => {
    const source = `--- use: core
--- meta
version: 1
--- preset: default
spacing: compact
--- core/header
title: Test
--- core/text

Hello
`;
    const line = findLineForBlockIndex(source, 0);
    const lines = source.split('\n');
    expect(lines[(line ?? 0) - 1].trim()).toBe('--- core/header');
  });

  test('skips all directive types together', () => {
    const source = `--- use: core
--- use: newsletter
--- meta
version: 1
--- theme: brand
primary: #ff0000
--- preset: default
spacing: compact
--- style
accent: blue

--- core/header
title: Test
`;
    const line = findLineForBlockIndex(source, 0);
    const lines = source.split('\n');
    expect(lines[(line ?? 0) - 1].trim()).toBe('--- core/header');
  });

  test('skips closing tags', () => {
    const line = findLineForBlockIndex(SIMPLE_SOURCE, 3);
    const lines = SIMPLE_SOURCE.split('\n');
    // index 3 should be core/section, NOT the closing tag
    expect(lines[(line ?? 0) - 1].trim()).toBe('--- core/section');
  });

  test('counts nested blocks inside wrappers', () => {
    // core/section (3), core/card (4), core/card (5)
    const line4 = findLineForBlockIndex(SIMPLE_SOURCE, 4);
    const line5 = findLineForBlockIndex(SIMPLE_SOURCE, 5);
    const lines = SIMPLE_SOURCE.split('\n');
    expect(lines[(line4 ?? 0) - 1].trim()).toBe('--- core/card');
    expect(lines[(line5 ?? 0) - 1].trim()).toMatch(/^--- core\/card/);
  });

  test('returns null for out-of-bounds index', () => {
    expect(findLineForBlockIndex(SIMPLE_SOURCE, 99)).toBeNull();
  });

  test('returns null for empty source', () => {
    expect(findLineForBlockIndex('', 0)).toBeNull();
  });

  test('fallback: matches by block class', () => {
    const source = `--- core/header
--- core/text
Hello
`;
    // Index out of range, but class matches
    const line = findLineForBlockIndex(source, 99, 'mkly-core-text');
    const lines = source.split('\n');
    expect(lines[(line ?? 0) - 1].trim()).toBe('--- core/text');
  });
});

// ─── findBlockByOriginalLine (the NEW function) ───

describe('findBlockByOriginalLine', () => {
  test('finds exact match by line and type', () => {
    // Find newsletter/intro — it's at a specific line
    const lines = SIMPLE_SOURCE.split('\n');
    const introLineIdx = lines.findIndex(l => l.trim() === '--- newsletter/intro');
    const introLine = introLineIdx + 1;

    const result = findBlockByOriginalLine(SIMPLE_SOURCE, introLine, 'mkly-newsletter-intro');
    expect(result).toBe(introLine);
  });

  test('finds block even when line shifts by a few positions', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const introLineIdx = lines.findIndex(l => l.trim() === '--- newsletter/intro');
    const introLine = introLineIdx + 1;

    // Search with originalLine offset by ±3 — should still find the right block
    const result1 = findBlockByOriginalLine(SIMPLE_SOURCE, introLine + 3, 'mkly-newsletter-intro');
    expect(result1).toBe(introLine);

    const result2 = findBlockByOriginalLine(SIMPLE_SOURCE, introLine - 3, 'mkly-newsletter-intro');
    expect(result2).toBe(introLine);
  });

  test('handles core/header at start of content', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const headerLine = lines.findIndex(l => l.trim() === '--- core/header') + 1;
    const result = findBlockByOriginalLine(SIMPLE_SOURCE, headerLine, 'mkly-core-header');
    expect(result).toBe(headerLine);
  });

  test('handles last block (core/footer)', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const footerLine = lines.findIndex(l => l.trim() === '--- core/footer') + 1;
    const result = findBlockByOriginalLine(SIMPLE_SOURCE, footerLine, 'mkly-core-footer');
    expect(result).toBe(footerLine);
  });

  test('distinguishes between multiple newsletter/item blocks', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const itemLines: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === '--- newsletter/item') itemLines.push(i + 1);
    });

    // First item
    const result1 = findBlockByOriginalLine(SIMPLE_SOURCE, itemLines[0], 'mkly-newsletter-item');
    expect(result1).toBe(itemLines[0]);

    // Second item
    const result2 = findBlockByOriginalLine(SIMPLE_SOURCE, itemLines[1], 'mkly-newsletter-item');
    expect(result2).toBe(itemLines[1]);
  });

  test('distinguishes between multiple core/card blocks', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const cardLines: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === '--- core/card') cardLines.push(i + 1);
    });

    const result1 = findBlockByOriginalLine(SIMPLE_SOURCE, cardLines[0], 'mkly-core-card');
    expect(result1).toBe(cardLines[0]);

    const result2 = findBlockByOriginalLine(SIMPLE_SOURCE, cardLines[1], 'mkly-core-card');
    expect(result2).toBe(cardLines[1]);
  });

  test('falls back to proximity when block type not found', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const introLine = lines.findIndex(l => l.trim() === '--- newsletter/intro') + 1;

    // Search for nonexistent type — should find closest block
    const result = findBlockByOriginalLine(SIMPLE_SOURCE, introLine, 'mkly-nonexistent-block');
    expect(result).not.toBeNull();
    // Should be close to the original line
    expect(Math.abs((result ?? 0) - introLine)).toBeLessThan(10);
  });

  test('falls back to proximity when no class provided', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const introLine = lines.findIndex(l => l.trim() === '--- newsletter/intro') + 1;

    const result = findBlockByOriginalLine(SIMPLE_SOURCE, introLine, null);
    expect(result).not.toBeNull();
    expect(Math.abs((result ?? 0) - introLine)).toBeLessThan(5);
  });

  test('returns null for invalid originalLine', () => {
    expect(findBlockByOriginalLine(SIMPLE_SOURCE, 0, null)).toBeNull();
    expect(findBlockByOriginalLine(SIMPLE_SOURCE, -1, null)).toBeNull();
  });

  test('returns null for empty source', () => {
    expect(findBlockByOriginalLine('', 5, 'mkly-core-text')).toBeNull();
  });

  test('handles source with only special blocks', () => {
    const source = `--- use: core
--- meta
version: 1
--- style
accent: red
`;
    expect(findBlockByOriginalLine(source, 1, 'mkly-core-header')).toBeNull();
  });

  // KEY TEST: this is the exact scenario that was broken before
  test('editing newsletter/intro should NOT jump to newsletter/item', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const introLine = lines.findIndex(l => l.trim() === '--- newsletter/intro') + 1;
    const itemLine = lines.findIndex(l => l.trim() === '--- newsletter/item') + 1;

    const result = findBlockByOriginalLine(SIMPLE_SOURCE, introLine, 'mkly-newsletter-intro');
    expect(result).toBe(introLine);
    expect(result).not.toBe(itemLine);
  });

  // Simulate reverse-compiled source with slightly shifted lines
  test('finds block when reverse compilation shifts lines', () => {
    // Simulate: preamble preserved, but one block's content grew by 2 lines
    const lines = SIMPLE_SOURCE.split('\n');
    const introIdx = lines.findIndex(l => l.trim() === '--- newsletter/intro');
    // Insert 2 extra lines in the intro content
    const shifted = [
      ...lines.slice(0, introIdx + 2),
      'Extra line 1',
      'Extra line 2',
      ...lines.slice(introIdx + 2),
    ].join('\n');

    // The section block moved down by 2 lines in the new source
    const sectionLineOld = lines.findIndex(l => l.trim() === '--- core/section') + 1;
    const result = findBlockByOriginalLine(shifted, sectionLineOld, 'mkly-core-section');
    expect(result).not.toBeNull();
    // Should find core/section, which is now at sectionLineOld + 2
    const shiftedLines = shifted.split('\n');
    expect(shiftedLines[(result ?? 0) - 1].trim()).toBe('--- core/section');
  });

  test('finds block when reverse compilation removes lines', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    // Remove the content line from newsletter/intro (simulate shorter reverse output)
    const introIdx = lines.findIndex(l => l.trim() === '--- newsletter/intro');
    const shortened = [
      ...lines.slice(0, introIdx + 1),
      // Skip content lines, jump to next block
      ...lines.slice(introIdx + 3),
    ].join('\n');

    const sectionLineOld = lines.findIndex(l => l.trim() === '--- core/section') + 1;
    const result = findBlockByOriginalLine(shortened, sectionLineOld, 'mkly-core-section');
    expect(result).not.toBeNull();
    const shortenedLines = shortened.split('\n');
    expect(shortenedLines[(result ?? 0) - 1].trim()).toBe('--- core/section');
  });
});

// ─── resolveBlockLine ───

describe('resolveBlockLine', () => {
  test('resolves cursor on block delimiter to that block', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const introLine = lines.findIndex(l => l.trim() === '--- newsletter/intro') + 1;
    const result = resolveBlockLine(introLine, SIMPLE_SOURCE);
    expect(result.blockLine).toBe(introLine);
    expect(result.blockType).toBe('newsletter/intro');
  });

  test('resolves cursor inside block content to block delimiter', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const introLine = lines.findIndex(l => l.trim() === '--- newsletter/intro') + 1;
    // Cursor 2 lines below the delimiter (inside content)
    const result = resolveBlockLine(introLine + 2, SIMPLE_SOURCE);
    expect(result.blockLine).toBe(introLine);
    expect(result.blockType).toBe('newsletter/intro');
  });

  test('returns null for special blocks (use/meta/theme/preset/style)', () => {
    const result = resolveBlockLine(1, SIMPLE_SOURCE);
    expect(result.blockLine).toBeNull();
    expect(result.blockType).toBeNull();
  });

  test('returns null for preset blocks', () => {
    const source = `--- use: core
--- preset: core/default

--- core/header
title: Test
`;
    const presetLine = source.split('\n').findIndex(l => l.trim().startsWith('--- preset:')) + 1;
    const result = resolveBlockLine(presetLine, source);
    expect(result.blockLine).toBeNull();
    expect(result.blockType).toBeNull();
  });

  test('resolves cursor on closing tag to parent block', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const closingLine = lines.findIndex(l => l.trim() === '--- /core/section') + 1;
    const result = resolveBlockLine(closingLine, SIMPLE_SOURCE);
    // Should walk back past closing tag to find a real block
    expect(result.blockLine).not.toBeNull();
    expect(result.blockType).not.toBeNull();
  });

  test('resolves content inside nested card to the card', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    // Find first core/card and go 2 lines below it
    const cardLine = lines.findIndex(l => l.trim() === '--- core/card') + 1;
    const result = resolveBlockLine(cardLine + 2, SIMPLE_SOURCE);
    expect(result.blockLine).toBe(cardLine);
    expect(result.blockType).toBe('core/card');
  });

  test('resolves cursor at very end of document', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const result = resolveBlockLine(lines.length, SIMPLE_SOURCE);
    expect(result.blockLine).not.toBeNull();
  });

  test('handles cursor beyond document length', () => {
    const result = resolveBlockLine(9999, SIMPLE_SOURCE);
    expect(result.blockLine).not.toBeNull();
  });
});

// ─── findHtmlPositionForBlock ───

describe('findHtmlPositionForBlock', () => {
  const sampleHtml = `<div data-mkly-line="5" class="mkly-core-header"><h1>Header</h1></div>
<div data-mkly-line="10" class="mkly-newsletter-intro"><p>Intro text</p></div>
<div data-mkly-line="15" class="mkly-core-section">
  <div data-mkly-line="18" class="mkly-core-card"><p>Card 1</p></div>
  <div data-mkly-line="25" class="mkly-core-card"><p>Card 2</p></div>
</div>`;

  test('finds header block position', () => {
    const pos = findHtmlPositionForBlock(5, sampleHtml);
    expect(pos).not.toBeNull();
    expect(sampleHtml.slice(pos!.from, pos!.to)).toContain('data-mkly-line="5"');
    expect(sampleHtml.slice(pos!.from, pos!.to)).toContain('Header');
  });

  test('finds intro block position', () => {
    const pos = findHtmlPositionForBlock(10, sampleHtml);
    expect(pos).not.toBeNull();
    expect(sampleHtml.slice(pos!.from, pos!.to)).toContain('Intro text');
  });

  test('finds nested card block position', () => {
    const pos = findHtmlPositionForBlock(18, sampleHtml);
    expect(pos).not.toBeNull();
    expect(sampleHtml.slice(pos!.from, pos!.to)).toContain('Card 1');
  });

  test('returns null for nonexistent block line', () => {
    expect(findHtmlPositionForBlock(999, sampleHtml)).toBeNull();
  });
});

// ─── Cross-pane sync integration tests ───

describe('cross-pane sync: editing block X should focus block X', () => {
  // Simulate what handleInput does: given a DOM element's data-mkly-line + class,
  // call findBlockByOriginalLine on the (possibly modified) source, and verify
  // the result points to the correct block.

  function simulateEditAndFocus(
    originalSource: string,
    editedSource: string,
    editedBlockLine: number,
    editedBlockClass: string,
  ): { resultLine: number | null; resultType: string | null } {
    const resultLine = findBlockByOriginalLine(editedSource, editedBlockLine, editedBlockClass);
    if (resultLine === null) return { resultLine: null, resultType: null };
    const lines = editedSource.split('\n');
    const resultLineText = lines[resultLine - 1]?.trim() ?? '';
    const match = resultLineText.match(/^---\s+([\w/]+)/);
    return { resultLine, resultType: match ? match[1] : null };
  }

  test('editing newsletter/intro returns newsletter/intro (identical source)', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const introLine = lines.findIndex(l => l.trim() === '--- newsletter/intro') + 1;
    const { resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, SIMPLE_SOURCE, introLine, 'mkly-newsletter-intro',
    );
    expect(resultType).toBe('newsletter/intro');
  });

  test('editing core/header returns core/header', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const headerLine = lines.findIndex(l => l.trim() === '--- core/header') + 1;
    const { resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, SIMPLE_SOURCE, headerLine, 'mkly-core-header',
    );
    expect(resultType).toBe('core/header');
  });

  test('editing core/hero returns core/hero', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const heroLine = lines.findIndex(l => l.trim() === '--- core/hero') + 1;
    const { resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, SIMPLE_SOURCE, heroLine, 'mkly-core-hero',
    );
    expect(resultType).toBe('core/hero');
  });

  test('editing first core/card returns core/card (not section)', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const cardLine = lines.findIndex(l => l.trim() === '--- core/card') + 1;
    const { resultType, resultLine } = simulateEditAndFocus(
      SIMPLE_SOURCE, SIMPLE_SOURCE, cardLine, 'mkly-core-card',
    );
    expect(resultType).toBe('core/card');
    expect(resultLine).toBe(cardLine);
  });

  test('editing second core/card returns second core/card', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const cardLines: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === '--- core/card') cardLines.push(i + 1);
    });
    const { resultLine } = simulateEditAndFocus(
      SIMPLE_SOURCE, SIMPLE_SOURCE, cardLines[1], 'mkly-core-card',
    );
    expect(resultLine).toBe(cardLines[1]);
  });

  test('editing first newsletter/item returns first newsletter/item', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const itemLines: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === '--- newsletter/item') itemLines.push(i + 1);
    });
    const { resultLine, resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, SIMPLE_SOURCE, itemLines[0], 'mkly-newsletter-item',
    );
    expect(resultType).toBe('newsletter/item');
    expect(resultLine).toBe(itemLines[0]);
  });

  test('editing second newsletter/item returns second newsletter/item', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const itemLines: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === '--- newsletter/item') itemLines.push(i + 1);
    });
    const { resultLine, resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, SIMPLE_SOURCE, itemLines[1], 'mkly-newsletter-item',
    );
    expect(resultType).toBe('newsletter/item');
    expect(resultLine).toBe(itemLines[1]);
  });

  test('editing newsletter/quickHits returns newsletter/quickHits', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const qhLine = lines.findIndex(l => l.trim() === '--- newsletter/quickHits') + 1;
    const { resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, SIMPLE_SOURCE, qhLine, 'mkly-newsletter-quickHits',
    );
    expect(resultType).toBe('newsletter/quickHits');
  });

  test('editing core/footer returns core/footer', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const footerLine = lines.findIndex(l => l.trim() === '--- core/footer') + 1;
    const { resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, SIMPLE_SOURCE, footerLine, 'mkly-core-footer',
    );
    expect(resultType).toBe('core/footer');
  });

  // Simulate reverse compilation that shifts lines
  test('editing intro with shifted reverse source still finds intro', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const introLine = lines.findIndex(l => l.trim() === '--- newsletter/intro') + 1;

    // Simulate: reverse compilation adds 2 extra content lines to core/hero
    const heroIdx = lines.findIndex(l => l.trim() === '--- core/hero');
    const shifted = [
      ...lines.slice(0, heroIdx + 3),
      'Extra hero line 1',
      'Extra hero line 2',
      ...lines.slice(heroIdx + 3),
    ].join('\n');

    const { resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, shifted, introLine, 'mkly-newsletter-intro',
    );
    expect(resultType).toBe('newsletter/intro');
  });

  test('editing item with shifted reverse source still finds item', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const itemLines: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === '--- newsletter/item') itemLines.push(i + 1);
    });

    // Add extra lines in intro
    const introIdx = lines.findIndex(l => l.trim() === '--- newsletter/intro');
    const shifted = [
      ...lines.slice(0, introIdx + 2),
      'Extra intro line',
      ...lines.slice(introIdx + 2),
    ].join('\n');

    const { resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, shifted, itemLines[0], 'mkly-newsletter-item',
    );
    expect(resultType).toBe('newsletter/item');
  });

  // Simulate reverse compilation that LOSES a wrapper block
  test('editing card when section wrapper is lost still finds card', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const cardLines: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === '--- core/card') cardLines.push(i + 1);
    });

    // Remove core/section and /core/section
    const withoutSection = lines
      .filter(l => l.trim() !== '--- core/section' && l.trim() !== '--- /core/section' && !l.trim().startsWith('title: Features'))
      .join('\n');

    const { resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, withoutSection, cardLines[0], 'mkly-core-card',
    );
    expect(resultType).toBe('core/card');
  });

  // Simulate reverse compilation that LOSES a category wrapper
  test('editing item when category wrapper is lost still finds item', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const itemLines: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === '--- newsletter/item') itemLines.push(i + 1);
    });

    // Remove category wrapper
    const withoutCategory = lines
      .filter(l => l.trim() !== '--- newsletter/category' && l.trim() !== '--- /newsletter/category' && !l.trim().startsWith('title: Quick Reads'))
      .join('\n');

    const { resultType } = simulateEditAndFocus(
      SIMPLE_SOURCE, withoutCategory, itemLines[0], 'mkly-newsletter-item',
    );
    expect(resultType).toBe('newsletter/item');
  });

  // THE BUG SCENARIO: this was the exact user-reported issue
  test('newsletter/intro NEVER maps to newsletter/item regardless of source changes', () => {
    const lines = SIMPLE_SOURCE.split('\n');
    const introLine = lines.findIndex(l => l.trim() === '--- newsletter/intro') + 1;

    // Test with various modified sources
    const variations = [
      SIMPLE_SOURCE, // Original
      lines.filter(l => l.trim() !== '--- core/section' && l.trim() !== '--- /core/section').join('\n'), // No section wrapper
      lines.filter(l => l.trim() !== '--- newsletter/category' && l.trim() !== '--- /newsletter/category').join('\n'), // No category wrapper
      [...lines.slice(0, 3), 'Extra preamble line', ...lines.slice(3)].join('\n'), // Extra preamble
    ];

    for (const variant of variations) {
      const result = findBlockByOriginalLine(variant, introLine, 'mkly-newsletter-intro');
      if (result !== null) {
        const resultLines = variant.split('\n');
        const resultText = resultLines[result - 1]?.trim() ?? '';
        expect(resultText).not.toContain('newsletter/item');
        expect(resultText).toContain('newsletter/intro');
      }
    }
  });
});
