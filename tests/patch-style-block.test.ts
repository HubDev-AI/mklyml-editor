import { describe, it, expect } from 'bun:test';
import { emptyStyleGraph, mergeRule, CORE_KIT } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import { applyStyleChange, parseSourceStyleGraph } from '../src/store/block-properties';
import { mkly } from '@mklyml/core';

const META = '--- meta\nversion: 1\n';
const KITS = { core: CORE_KIT, newsletter: NEWSLETTER_KIT };

function compile(source: string) {
  return mkly(source, { kits: KITS, sourceMap: true });
}

/** Assert no fatal compilation errors. */
function assertClean(source: string) {
  const result = compile(source);
  const fatal = result.errors.filter(e => e.severity === 'error');
  if (fatal.length > 0) {
    throw new Error(`Compile errors: ${fatal.map(e => `[line ${e.line}] ${e.message}`).join('; ')}\n\nSource:\n${source}`);
  }
  return result;
}

// ===== patchStyleBlock: Create Style Block =====

describe('patchStyleBlock: create style block', () => {
  it('inserts style block after meta when none exists', () => {
    const source = `--- use: core\n\n${META}\n--- core/heading\nlevel: 2\nTitle`;
    const { newSource, lineDelta } = applyStyleChange(
      source, emptyStyleGraph(), 'core/heading', 'self', 'color', '#ff0000',
    );

    expect(newSource).toContain('--- style');
    expect(newSource).toContain('color: #ff0000');
    expect(lineDelta).toBeGreaterThan(0);

    // Style block should appear before content blocks
    const styleIdx = newSource.indexOf('--- style');
    const headingIdx = newSource.indexOf('--- core/heading');
    expect(styleIdx).toBeLessThan(headingIdx);

    assertClean(newSource);
  });

  it('inserts style block after use directives', () => {
    const source = `--- use: core\n--- use: newsletter\n\n${META}\n--- core/heading\nlevel: 2\nTitle`;
    const { newSource } = applyStyleChange(
      source, emptyStyleGraph(), 'core/heading', 'self', 'color', '#000',
    );

    const lines = newSource.split('\n');
    const useCoreIdx = lines.findIndex(l => l === '--- use: core');
    const useNewsIdx = lines.findIndex(l => l === '--- use: newsletter');
    const styleIdx = lines.findIndex(l => l === '--- style');

    expect(styleIdx).toBeGreaterThan(useNewsIdx);
    assertClean(newSource);
  });
});

// ===== patchStyleBlock: Update Existing Style Block =====

describe('patchStyleBlock: update existing style block', () => {
  it('adds property to existing rule', () => {
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
      'Title',
    ].join('\n');

    const graph = parseSourceStyleGraph(source);
    const { newSource } = applyStyleChange(
      source, graph, 'core/heading', 'self', 'fontSize', '24px',
    );

    expect(newSource).toContain('color: #ff0000');
    expect(newSource).toContain('fontSize: 24px');
    assertClean(newSource);
  });

  it('adds a new rule to existing style block', () => {
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
      'Title',
      '',
      '--- core/text',
      'Some text',
    ].join('\n');

    const graph = parseSourceStyleGraph(source);
    const { newSource } = applyStyleChange(
      source, graph, 'core/text', 'self', 'fontSize', '16px',
    );

    expect(newSource).toContain('core/heading');
    expect(newSource).toContain('core/text');
    expect(newSource).toContain('fontSize: 16px');
    assertClean(newSource);
  });

  it('removes a property without removing the rule', () => {
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
      'Title',
    ].join('\n');

    const graph = parseSourceStyleGraph(source);
    const { newSource } = applyStyleChange(
      source, graph, 'core/heading', 'self', 'color', '',
    );

    expect(newSource).not.toContain('#ff0000');
    // fontSize should remain (may be camelCase or kebab-case)
    expect(newSource.includes('fontSize') || newSource.includes('font-size')).toBe(true);
    assertClean(newSource);
  });

  it('removes the last property and cleans up empty rules', () => {
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
      'Title',
    ].join('\n');

    const graph = parseSourceStyleGraph(source);
    const { newSource } = applyStyleChange(
      source, graph, 'core/heading', 'self', 'color', '',
    );

    // Style block should be empty or minimal
    assertClean(newSource);
    // The heading block should still be present
    expect(newSource).toContain('--- core/heading');
  });
});

// ===== patchStyleBlock: Source Integrity =====

describe('patchStyleBlock: source integrity', () => {
  it('does not corrupt non-style blocks', () => {
    const source = [
      '--- use: core',
      '--- use: newsletter',
      '',
      META,
      '--- core/heading',
      'level: 2',
      'My Heading',
      '',
      '--- core/text',
      '- Item one',
      '- Item two',
      '',
      '--- newsletter/item',
      'title: Article',
      'url: https://example.com',
    ].join('\n');

    let currentSource = source;
    let graph = compile(source).styleGraph ?? emptyStyleGraph();

    // Apply 5 style changes in sequence
    for (const [bt, t, p, v] of [
      ['core/heading', 'self', 'color', '#ff0000'],
      ['core/heading', 'self', 'fontSize', '32px'],
      ['core/text', 'self', 'padding', '16px'],
      ['newsletter/item', 'self', 'backgroundColor', '#f9fafb'],
      ['newsletter/item', 'link', 'color', '#1d4ed8'],
    ] as const) {
      const step = applyStyleChange(currentSource, graph, bt, t, p, v);
      currentSource = step.newSource;
      graph = step.newGraph;
    }

    // All original content should be preserved
    expect(currentSource).toContain('My Heading');
    expect(currentSource).toContain('- Item one');
    expect(currentSource).toContain('- Item two');
    expect(currentSource).toContain('title: Article');
    expect(currentSource).toContain('url: https://example.com');

    // Should compile cleanly
    assertClean(currentSource);
  });

  it('handles adding a second block type to existing style block', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- style',
      'core/heading',
      '  color: blue',
      '',
      '--- core/heading',
      'level: 1',
      'First',
      '',
      '--- core/text',
      'Second block',
    ].join('\n');

    const graph = parseSourceStyleGraph(source);
    const { newSource } = applyStyleChange(
      source, graph, 'core/text', 'self', 'padding', '8px',
    );

    // Both content blocks should survive
    expect(newSource).toContain('First');
    expect(newSource).toContain('Second block');
    // Both style rules should be present
    expect(newSource).toContain('core/heading');
    expect(newSource).toContain('core/text');
    assertClean(newSource);
  });

  it('lineDelta is consistent across sequential changes', () => {
    const source = `--- use: core\n\n${META}\n--- core/heading\nlevel: 2\nTitle`;
    let currentSource = source;
    let graph = emptyStyleGraph();

    const headingLineInitial = currentSource.split('\n').findIndex(l => l === '--- core/heading') + 1;
    let headingLine = headingLineInitial;

    // 10 sequential style changes
    const changes = [
      ['color', '#111'], ['fontSize', '20px'], ['fontWeight', 'bold'],
      ['padding', '8px'], ['margin', '0'], ['backgroundColor', '#fff'],
      ['borderRadius', '4px'], ['opacity', '0.9'], ['display', 'flex'],
      ['lineHeight', '1.5'],
    ];

    for (const [prop, value] of changes) {
      const step = applyStyleChange(currentSource, graph, 'core/heading', 'self', prop, value as string);
      currentSource = step.newSource;
      graph = step.newGraph;
      headingLine += step.lineDelta;
    }

    // After all changes, headingLine should still point to "--- core/heading"
    const lines = currentSource.split('\n');
    expect(lines[headingLine - 1]).toMatch(/^--- core\/heading/);

    // All properties should be in the source
    expect(currentSource).toContain('#111');
    expect(currentSource).toContain('1.5');

    assertClean(currentSource);
  });

  it('conditional cursor adjustment keeps selection when style block is below the selected block', () => {
    const source = [
      '--- use: core',
      '',
      '--- core/heading',
      'level: 2',
      'Title',
      '',
      '--- style',
      'core/heading',
      '  color: #ff0000',
      '',
      '--- core/text',
      'Body',
    ].join('\n');

    const selectedLine = source.split('\n').findIndex(l => l === '--- core/heading') + 1;
    const graph = parseSourceStyleGraph(source);
    const step = applyStyleChange(source, graph, 'core/heading', 'self', 'fontSize', '24px');

    const adjustedLine = selectedLine > step.shiftAfterLine
      ? selectedLine + step.lineDelta
      : selectedLine;

    const lines = step.newSource.split('\n');
    expect(lines[adjustedLine - 1]).toBe('--- core/heading');
  });

  it('conditional cursor adjustment tracks selection when style block is above the selected block', () => {
    const source = [
      '--- use: core',
      '',
      '--- style',
      'core/heading',
      '  color: #ff0000',
      '',
      '--- core/heading',
      'level: 2',
      'Title',
    ].join('\n');

    const selectedLine = source.split('\n').findIndex(l => l === '--- core/heading') + 1;
    const graph = parseSourceStyleGraph(source);
    const step = applyStyleChange(source, graph, 'core/heading', 'self', 'fontSize', '24px');

    const adjustedLine = selectedLine > step.shiftAfterLine
      ? selectedLine + step.lineDelta
      : selectedLine;

    const lines = step.newSource.split('\n');
    expect(lines[adjustedLine - 1]).toBe('--- core/heading');
  });
});

// ===== Label + Style Block Interaction =====

describe('patchStyleBlock: label interaction', () => {
  it('creates labeled rule in style block', () => {
    const source = `--- use: core\n\n${META}\n--- core/card: hero\ntitle: Hero Card`;
    const graph = emptyStyleGraph();
    const { newSource } = applyStyleChange(
      source, graph, 'core/card', 'self', 'backgroundColor', '#fef3c7', 'hero',
    );

    expect(newSource).toContain('core/card:hero');
    expect(newSource).toContain('backgroundColor: #fef3c7');
    assertClean(newSource);
  });

  it('keeps labeled and unlabeled rules separate', () => {
    const source = `--- use: core\n\n${META}\n--- core/card: hero\ntitle: Hero\n\n--- core/card\ntitle: Regular`;
    let graph = emptyStyleGraph();

    // Style the labeled card
    const step1 = applyStyleChange(source, graph, 'core/card', 'self', 'backgroundColor', '#fef3c7', 'hero');
    // Style all cards (no label)
    const step2 = applyStyleChange(step1.newSource, step1.newGraph, 'core/card', 'self', 'padding', '16px');

    expect(step2.newSource).toContain('core/card:hero');
    expect(step2.newSource).toContain('backgroundColor: #fef3c7');
    expect(step2.newSource).toContain('padding: 16px');

    assertClean(step2.newSource);
  });

  it('creates sub-element rule with label', () => {
    const source = [
      '--- use: core',
      '--- use: newsletter',
      '',
      META,
      '--- newsletter/item: s1',
      'title: Article',
      'url: https://example.com',
    ].join('\n');

    const graph = emptyStyleGraph();
    const { newSource } = applyStyleChange(
      source, graph, 'newsletter/item', 'link', 'color', '#1d4ed8', 's1',
    );

    expect(newSource).toContain('newsletter/item:s1');
    assertClean(newSource);
  });
});

// ===== parseSourceStyleGraph =====

describe('parseSourceStyleGraph', () => {
  it('parses style block from full source', () => {
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
      'Title',
    ].join('\n');

    const graph = parseSourceStyleGraph(source);
    expect(graph.rules.length).toBeGreaterThan(0);
    expect(graph.rules[0].blockType).toBe('core/heading');
    expect(graph.rules[0].properties).toHaveProperty('color');
  });

  it('returns empty graph when no style block', () => {
    const source = `--- use: core\n\n${META}\n--- core/heading\nlevel: 2\nTitle`;
    const graph = parseSourceStyleGraph(source);
    expect(graph.rules).toHaveLength(0);
  });

  it('does not parse non-style block content', () => {
    const source = [
      '--- use: core',
      '',
      META,
      '--- core/heading',
      'level: 2',
      'Title',
    ].join('\n');

    const graph = parseSourceStyleGraph(source);
    // "level: 2" should NOT be treated as a style property
    expect(graph.rules).toHaveLength(0);
  });
});
