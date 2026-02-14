import { describe, test, expect } from 'bun:test';
import { mkly, htmlToMkly, CORE_KIT } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import { findBlockByOriginalLine, ensurePreamble, cleanHtmlForReverse } from './reverse-helpers';
import { resolveBlockLine } from '../store/selection-orchestrator';

const KITS = { core: CORE_KIT, newsletter: NEWSLETTER_KIT };

// Full source with all block types for end-to-end testing
const FULL_SOURCE = `--- use: core
--- use: newsletter
--- theme: core/dark

--- style
accent: #e2725b

--- meta
version: 1
title: Weekly Digest

--- core/header
title: My Newsletter

--- core/hero
image: https://example.com/hero.jpg

# Welcome to the Digest

--- newsletter/intro

Hello readers! This week we have exciting updates.

--- core/section
title: Featured

--- core/card
link: https://example.com/1

## First Card

Great content here.

--- core/card
link: https://example.com/2

## Second Card

More great content.

--- /core/section

--- newsletter/category
title: Quick Reads

--- newsletter/item
source: TechCrunch
link: https://example.com/tc

A story about AI advancement.

--- newsletter/item
source: Ars Technica
link: https://example.com/ars

A story about open source.

--- /newsletter/category

--- newsletter/quickHits

- **Bun 1.3** released
- **Deno 2.0** announced

--- core/quote
author: A Developer

mkly changed everything.

--- newsletter/community
author: Jane

Sharing my experience with mkly.

--- core/cta
url: https://example.com/sub
buttonText: Subscribe

Don't miss next week!

--- core/footer

[Unsubscribe](https://example.com/unsub)
`;

// ─── End-to-end compile → reverse → find block ───

describe('end-to-end: compile → reverse → findBlockByOriginalLine', () => {
  // Compile the source once
  const compiled = mkly(FULL_SOURCE, { kits: KITS, sourceMap: true });

  test('compilation succeeds', () => {
    expect(compiled.html.length).toBeGreaterThan(0);
    expect(compiled.errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  test('source map entries exist', () => {
    expect(compiled.sourceMap).toBeDefined();
    expect(compiled.sourceMap!.length).toBeGreaterThan(0);
  });

  // For each content block, verify that after reverse compilation,
  // findBlockByOriginalLine maps back to the same block type
  const blockTests = [
    { type: 'core/header', class: 'mkly-core-header' },
    { type: 'core/hero', class: 'mkly-core-hero' },
    { type: 'newsletter/intro', class: 'mkly-newsletter-intro' },
    { type: 'core/section', class: 'mkly-core-section' },
    { type: 'core/card', class: 'mkly-core-card' },
    { type: 'newsletter/category', class: 'mkly-newsletter-category' },
    { type: 'newsletter/item', class: 'mkly-newsletter-item' },
    { type: 'newsletter/quickHits', class: 'mkly-newsletter-quickHits' },
    { type: 'core/quote', class: 'mkly-core-quote' },
    { type: 'newsletter/community', class: 'mkly-newsletter-community' },
    { type: 'core/cta', class: 'mkly-core-cta' },
    { type: 'core/footer', class: 'mkly-core-footer' },
  ];

  for (const bt of blockTests) {
    test(`round-trip: ${bt.type} maps back correctly`, () => {
      // Find original line for this block type
      const lines = FULL_SOURCE.split('\n');
      const originalLine = lines.findIndex(l => l.trim().startsWith(`--- ${bt.type}`)) + 1;
      expect(originalLine).toBeGreaterThan(0);

      // Reverse compile the HTML
      const cleanedHtml = cleanHtmlForReverse(compiled.html);
      const reversed = htmlToMkly(cleanedHtml, { kits: KITS });
      const withPreamble = ensurePreamble(reversed, FULL_SOURCE);

      // Find the block in the reversed source
      const resultLine = findBlockByOriginalLine(withPreamble, originalLine, bt.class);
      expect(resultLine).not.toBeNull();

      // Verify the found line is the right block type
      const resultLines = withPreamble.split('\n');
      const resultText = resultLines[resultLine! - 1]?.trim() ?? '';
      expect(resultText).toMatch(new RegExp(`^---\\s+${bt.type.replace('/', '\\/')}`));
    });
  }

  // Specifically verify the bug scenario
  test('newsletter/intro does NOT round-trip to newsletter/item', () => {
    const lines = FULL_SOURCE.split('\n');
    const introLine = lines.findIndex(l => l.trim() === '--- newsletter/intro') + 1;

    const cleanedHtml = cleanHtmlForReverse(compiled.html);
    const reversed = htmlToMkly(cleanedHtml, { kits: KITS });
    const withPreamble = ensurePreamble(reversed, FULL_SOURCE);

    const resultLine = findBlockByOriginalLine(withPreamble, introLine, 'mkly-newsletter-intro');
    expect(resultLine).not.toBeNull();

    const resultLines = withPreamble.split('\n');
    const resultText = resultLines[resultLine! - 1]?.trim() ?? '';
    expect(resultText).toContain('newsletter/intro');
    expect(resultText).not.toContain('newsletter/item');
  });

  // Verify duplicate block types (cards, items) round-trip to the correct instance
  test('first core/card round-trips to first core/card', () => {
    const lines = FULL_SOURCE.split('\n');
    const cardLines: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === '--- core/card') cardLines.push(i + 1);
    });
    expect(cardLines.length).toBe(2);

    const cleanedHtml = cleanHtmlForReverse(compiled.html);
    const reversed = htmlToMkly(cleanedHtml, { kits: KITS });
    const withPreamble = ensurePreamble(reversed, FULL_SOURCE);

    const result1 = findBlockByOriginalLine(withPreamble, cardLines[0], 'mkly-core-card');
    const result2 = findBlockByOriginalLine(withPreamble, cardLines[1], 'mkly-core-card');

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    // They should map to different lines
    expect(result1).not.toBe(result2);
    // And both should be core/card
    const resultLines = withPreamble.split('\n');
    expect(resultLines[result1! - 1]?.trim()).toMatch(/^--- core\/card/);
    expect(resultLines[result2! - 1]?.trim()).toMatch(/^--- core\/card/);
    // First card should be before second card
    expect(result1!).toBeLessThan(result2!);
  });

  test('first newsletter/item round-trips to first newsletter/item', () => {
    const lines = FULL_SOURCE.split('\n');
    const itemLines: number[] = [];
    lines.forEach((l, i) => {
      if (l.trim() === '--- newsletter/item') itemLines.push(i + 1);
    });
    expect(itemLines.length).toBe(2);

    const cleanedHtml = cleanHtmlForReverse(compiled.html);
    const reversed = htmlToMkly(cleanedHtml, { kits: KITS });
    const withPreamble = ensurePreamble(reversed, FULL_SOURCE);

    const result1 = findBlockByOriginalLine(withPreamble, itemLines[0], 'mkly-newsletter-item');
    const result2 = findBlockByOriginalLine(withPreamble, itemLines[1], 'mkly-newsletter-item');

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1).not.toBe(result2);
    expect(result1!).toBeLessThan(result2!);
  });
});

// ─── resolveBlockLine with compiled source ───

describe('resolveBlockLine with compiled source', () => {
  test('cursor on any content line resolves to containing block', () => {
    const lines = FULL_SOURCE.split('\n');

    // Find all content block start lines
    const blockStarts: Array<{ line: number; type: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const match = trimmed.match(/^---\s+([\w/]+)/);
      if (match && !trimmed.startsWith('--- /') &&
          !['use', 'meta', 'theme', 'style'].includes(match[1])) {
        blockStarts.push({ line: i + 1, type: match[1] });
      }
    }

    // For each block, verify that cursor on the delimiter resolves to that block
    for (const block of blockStarts) {
      const result = resolveBlockLine(block.line, FULL_SOURCE);
      expect(result.blockLine).toBe(block.line);
      expect(result.blockType).toBe(block.type);
    }
  });

  test('cursor 1 line below block delimiter resolves to that block', () => {
    const lines = FULL_SOURCE.split('\n');
    const introLine = lines.findIndex(l => l.trim() === '--- newsletter/intro') + 1;

    const result = resolveBlockLine(introLine + 1, FULL_SOURCE);
    expect(result.blockLine).toBe(introLine);
    expect(result.blockType).toBe('newsletter/intro');
  });
});
