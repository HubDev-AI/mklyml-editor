import { describe, it, expect } from 'bun:test';
import { mkly, emptyStyleGraph, CORE_KIT } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import { applyStyleChange } from '../src/store/block-properties';
import { parseSourceStyleGraph } from '../src/store/block-properties';
import {
  generateStyleClass,
  injectClassAnnotation,
  generateBlockLabel,
  injectBlockLabel,
} from '../src/preview/target-detect';

const KITS = { core: CORE_KIT, newsletter: NEWSLETTER_KIT };

/** Compile mkly source and assert no fatal errors. */
function compile(source: string) {
  return mkly(source, { kits: KITS, sourceMap: true });
}

/** Common preamble with meta block. */
const META = '--- meta\nversion: 1\n';

// ===== Full Style Change Flow =====

describe('style pick: full style change flow', () => {
  it('applies a style to block self target', () => {
    const source = `--- use: core\n\n${META}\n--- core/heading\nlevel: 2\nHeading Text`;
    const result = compile(source);
    expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);

    const graph = result.styleGraph ?? emptyStyleGraph();
    const { newSource } = applyStyleChange(
      source, graph, 'core/heading', 'self', 'color', '#ff0000',
    );

    expect(newSource).toContain('core/heading');
    expect(newSource).toContain('color: #ff0000');

    // Recompile should succeed
    const recompiled = compile(newSource);
    expect(recompiled.errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  it('applies multiple styles to the same target', () => {
    const source = `--- use: core\n\n${META}\n--- core/heading\nlevel: 2\nHeading Text`;
    const graph = compile(source).styleGraph ?? emptyStyleGraph();

    // First change: color
    const step1 = applyStyleChange(source, graph, 'core/heading', 'self', 'color', '#ff0000');
    // Second change: font-size
    const step2 = applyStyleChange(
      step1.newSource, step1.newGraph, 'core/heading', 'self', 'fontSize', '24px',
    );

    expect(step2.newSource).toContain('color: #ff0000');
    expect(step2.newSource).toContain('fontSize: 24px');

    const recompiled = compile(step2.newSource);
    expect(recompiled.errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  it('removes a style when value is empty', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- style',
      'core/heading',
      '  color: #ff0000',
      '  fontSize: 24px',
      '',
      '--- core/heading',
      'level: 2',
      'Heading Text',
    ].join('\n');
    const graph = parseSourceStyleGraph(source);

    const { newSource } = applyStyleChange(
      source, graph, 'core/heading', 'self', 'color', '',
    );

    expect(newSource).not.toContain('color: #ff0000');
    // Serializer may output camelCase or kebab-case depending on parse path
    expect(newSource.includes('fontSize: 24px') || newSource.includes('font-size: 24px')).toBe(true);

    const recompiled = compile(newSource);
    expect(recompiled.errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });
});

// ===== Label Scoping =====

describe('style pick: label scoping', () => {
  it('label injection + style change scopes to one block', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- core/card',
      'title: Card A',
      '',
      '--- core/card',
      'title: Card B',
    ].join('\n');

    // Simulate: user clicks Card A (line 4 — "--- core/card" after meta block)
    const lines = source.split('\n');
    const cardLine = lines.findIndex(l => l.trim() === '--- core/card') + 1; // 1-based

    const label = generateBlockLabel(source);
    expect(label).toBe('s1');

    const labeled = injectBlockLabel(source, cardLine, label);
    expect(labeled).not.toBeNull();
    expect(labeled!.split('\n')[cardLine - 1]).toBe('--- core/card: s1');

    // Apply style with label
    const graph = compile(labeled!).styleGraph ?? emptyStyleGraph();
    const { newSource } = applyStyleChange(
      labeled!, graph, 'core/card', 'self', 'backgroundColor', '#fef3c7', 's1',
    );

    expect(newSource).toContain('core/card:s1');
    expect(newSource).toContain('backgroundColor: #fef3c7');

    // Recompile — only Card A gets the style
    const recompiled = compile(newSource);
    expect(recompiled.errors.filter(e => e.severity === 'error')).toHaveLength(0);
    expect(recompiled.html).toContain('mkly-core-card--s1');
  });

  it('second label is unique', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- core/card: s1',
      'title: Card A',
      '',
      '--- core/card',
      'title: Card B',
    ].join('\n');

    const label = generateBlockLabel(source);
    expect(label).toBe('s2');
  });

  it('does not inject label on block that already has one', () => {
    const source = `--- use: core\n\n${META}\n--- core/card: hero\ntitle: Hero Card`;
    const lines = source.split('\n');
    const heroLine = lines.findIndex(l => l.includes('--- core/card: hero')) + 1;
    const result = injectBlockLabel(source, heroLine, 's1');
    expect(result).toBeNull();
  });
});

// ===== Class Injection =====

describe('style pick: class injection', () => {
  it('injects class and applies style to tagged target', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- core/text',
      '- Item one',
      '- Item two',
      '- Item three',
    ].join('\n');

    const lines = source.split('\n');
    const itemTwoLine = lines.findIndex(l => l === '- Item two') + 1; // 1-based

    const className = generateStyleClass(source);
    expect(className).toBe('s1');

    const injected = injectClassAnnotation(source, itemTwoLine, className);
    expect(injected).not.toBeNull();
    expect(injected!.split('\n')[itemTwoLine - 1]).toBe('- Item two {.s1}');

    // Apply style to the class target
    const graph = compile(injected!).styleGraph ?? emptyStyleGraph();
    const { newSource } = applyStyleChange(
      injected!, graph, 'core/text', '>.s1', 'color', '#e2725b',
    );

    expect(newSource).toContain('color: #e2725b');

    // Recompile — only Item two gets the class + style
    const recompiled = compile(newSource);
    expect(recompiled.errors.filter(e => e.severity === 'error')).toHaveLength(0);
    expect(recompiled.html).toContain('class="s1"');
  });

  it('generates unique class names across multiple injections', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- core/text',
      '- Item one {.s1}',
      '- Item two',
    ].join('\n');

    const className = generateStyleClass(source);
    expect(className).toBe('s2');

    const lines = source.split('\n');
    const itemTwoLine = lines.findIndex(l => l === '- Item two') + 1;
    const injected = injectClassAnnotation(source, itemTwoLine, className);
    expect(injected).not.toBeNull();
    expect(injected!.split('\n')[itemTwoLine - 1]).toBe('- Item two {.s2}');
  });
});

// ===== BEM Sub-element Styling =====

describe('style pick: BEM sub-element styling', () => {
  it('styles a BEM target with auto-label', () => {
    const source = [
      '--- use: core',
      '--- use: newsletter',
      '',
      META,
      '--- newsletter/item',
      'title: Article',
      'url: https://example.com',
    ].join('\n');

    const lines = source.split('\n');
    const itemLine = lines.findIndex(l => l === '--- newsletter/item') + 1;

    const label = generateBlockLabel(source);
    const labeled = injectBlockLabel(source, itemLine, label);
    expect(labeled).not.toBeNull();
    expect(labeled!.split('\n')[itemLine - 1]).toBe('--- newsletter/item: s1');

    // Apply style to the link target with label
    const graph = compile(labeled!).styleGraph ?? emptyStyleGraph();
    const { newSource } = applyStyleChange(
      labeled!, graph, 'newsletter/item', 'link', 'color', '#1d4ed8', 's1',
    );

    expect(newSource).toContain('newsletter/item:s1');
    expect(newSource).toContain('link');
    expect(newSource).toContain('color: #1d4ed8');

    const recompiled = compile(newSource);
    expect(recompiled.errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });
});

// ===== lineDelta Tracking =====

describe('style pick: lineDelta tracking', () => {
  it('returns positive lineDelta when style block is created', () => {
    const source = `--- use: core\n\n${META}\n--- core/heading\nlevel: 2\nHeading`;
    const graph = emptyStyleGraph();

    const { lineDelta } = applyStyleChange(
      source, graph, 'core/heading', 'self', 'color', '#ff0000',
    );

    expect(lineDelta).toBeGreaterThan(0);
  });

  it('returns positive lineDelta when adding to existing style block', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- style',
      'core/heading',
      '  color: #ff0000',
      '',
      '--- core/heading',
      'level: 2',
      'Heading',
    ].join('\n');
    const graph = parseSourceStyleGraph(source);

    const { lineDelta } = applyStyleChange(
      source, graph, 'core/heading', 'self', 'fontSize', '24px',
    );

    // Adding a property to existing rule increases line count
    expect(lineDelta).toBeGreaterThan(0);
  });

  it('sourceLine adjustment is correct after multiple changes', () => {
    const source = `--- use: core\n\n${META}\n--- core/heading\nlevel: 2\nHeading`;
    let currentSource = source;
    let graph = emptyStyleGraph();

    // Find the initial heading line
    const initialLine = currentSource.split('\n').findIndex(l => l === '--- core/heading') + 1;
    let sourceLine = initialLine;

    // First change: creates style block
    const step1 = applyStyleChange(currentSource, graph, 'core/heading', 'self', 'color', '#ff0000');
    currentSource = step1.newSource;
    graph = step1.newGraph;
    sourceLine += step1.lineDelta;

    // Second change: adds to existing style block
    const step2 = applyStyleChange(currentSource, graph, 'core/heading', 'self', 'fontSize', '24px');
    currentSource = step2.newSource;
    graph = step2.newGraph;
    sourceLine += step2.lineDelta;

    // Source line should still point to "--- core/heading"
    const lines = currentSource.split('\n');
    expect(lines[sourceLine - 1]).toMatch(/^--- core\/heading/);
  });
});

// ===== Round-Trip Stability =====

describe('style pick: round-trip stability', () => {
  it('source with class annotations compiles cleanly', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- style',
      'core/text',
      '  >.s1',
      '    color: #e2725b',
      '',
      '--- core/text',
      '- Item one {.s1}',
      '- Item two',
    ].join('\n');

    const result = compile(source);
    expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
    expect(result.html).toContain('class="s1"');
  });

  it('source with labeled blocks compiles cleanly', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- style',
      'core/card:hero',
      '  backgroundColor: #fef3c7',
      '',
      '--- core/card: hero',
      'title: Hero Card',
    ].join('\n');

    const result = compile(source);
    expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
    expect(result.html).toContain('mkly-core-card--hero');
  });

  it('style change does not corrupt source', () => {
    const source = [
      '--- use: core',
      '--- use: newsletter',
      '',
      META,
      '--- newsletter/item',
      'title: Article Title',
      'url: https://example.com',
      'description: A great article',
      '',
      '--- newsletter/item',
      'title: Second Article',
      'url: https://example.com/2',
    ].join('\n');

    let currentSource = source;
    let graph = compile(source).styleGraph ?? emptyStyleGraph();

    // Multiple style changes
    const step1 = applyStyleChange(currentSource, graph, 'newsletter/item', 'self', 'backgroundColor', '#f9fafb');
    currentSource = step1.newSource;
    graph = step1.newGraph;

    const step2 = applyStyleChange(currentSource, graph, 'newsletter/item', 'self', 'borderRadius', '8px');
    currentSource = step2.newSource;
    graph = step2.newGraph;

    const step3 = applyStyleChange(currentSource, graph, 'newsletter/item', 'self', 'padding', '16px');
    currentSource = step3.newSource;
    graph = step3.newGraph;

    // Should still compile cleanly after 3 changes
    const recompiled = compile(currentSource);
    expect(recompiled.errors.filter(e => e.severity === 'error')).toHaveLength(0);

    // All styles should be present
    expect(currentSource).toContain('backgroundColor: #f9fafb');
    expect(currentSource).toContain('borderRadius: 8px');
    expect(currentSource).toContain('padding: 16px');
  });
});

// ===== Edge Cases =====

describe('style pick: edge cases', () => {
  it('styling first block in document', () => {
    const source = `--- use: core\n\n${META}\n--- core/heading\nlevel: 1\nTitle`;
    const graph = emptyStyleGraph();
    const { newSource } = applyStyleChange(source, graph, 'core/heading', 'self', 'color', '#000');
    const recompiled = compile(newSource);
    expect(recompiled.errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  it('styling with special characters in values', () => {
    const source = `--- use: core\n\n${META}\n--- core/heading\nlevel: 2\nText`;
    const graph = emptyStyleGraph();
    const { newSource } = applyStyleChange(
      source, graph, 'core/heading', 'self', 'fontFamily', "'Plus Jakarta Sans', sans-serif",
    );
    const recompiled = compile(newSource);
    expect(recompiled.errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  it('handles empty source gracefully', () => {
    expect(generateStyleClass('')).toBe('s1');
    expect(generateBlockLabel('')).toBe('s1');
    expect(injectClassAnnotation('', 1, 's1')).toBeNull();
    expect(injectBlockLabel('', 1, 's1')).toBeNull();
  });

  it('class injection preserves surrounding content', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- core/text',
      '# Big Heading',
      '- Item **bold** one',
      '- Item [link](https://example.com) two',
      '',
      '--- core/heading',
      'level: 2',
      'Another block',
    ].join('\n');

    const lines = source.split('\n');
    const boldLine = lines.findIndex(l => l.includes('Item **bold** one')) + 1;
    const injected = injectClassAnnotation(source, boldLine, 's1');
    expect(injected).not.toBeNull();

    const resultLines = injected!.split('\n');
    expect(resultLines[boldLine - 1]).toBe('- Item **bold** one {.s1}');
    // Adjacent lines untouched
    expect(resultLines[boldLine - 2]).toBe('# Big Heading');
    expect(resultLines[boldLine]).toBe('- Item [link](https://example.com) two');
  });
});
