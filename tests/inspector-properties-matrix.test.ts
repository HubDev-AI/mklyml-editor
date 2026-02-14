import { describe, it, expect } from 'bun:test';
import { parseCursorBlock } from '../src/store/use-cursor-context';
import { applyPropertyChange, applyStyleChange, parseSourceStyleGraph } from '../src/store/block-properties';
import { emptyStyleGraph, getStyleValue } from '@milkly/mkly';

// ---------------------------------------------------------------------------
// Block configuration types
// ---------------------------------------------------------------------------

interface BlockConfig {
  block: string;
  props?: string;
  content?: string;
  isContainer?: boolean;
  childContent?: string;
}

// ---------------------------------------------------------------------------
// Core blocks (16 types)
// ---------------------------------------------------------------------------

const CORE_BLOCKS: BlockConfig[] = [
  { block: 'core/heading', props: 'level: 2\ntext: Test' },
  { block: 'core/text', content: 'Hello' },
  { block: 'core/image', props: 'src: https://example.com/x.jpg\nalt: Test' },
  { block: 'core/button', props: 'url: https://example.com\nlabel: Click' },
  { block: 'core/divider' },
  { block: 'core/spacer', props: 'height: 40' },
  { block: 'core/code', props: 'lang: js', content: 'const x = 1;' },
  { block: 'core/quote', props: 'author: Someone', content: 'A wise quote.' },
  {
    block: 'core/hero',
    props: 'image: https://example.com/hero.jpg',
    content: '# Hero',
  },
  {
    block: 'core/section',
    isContainer: true,
    childContent: '--- core/text\n\nChild',
  },
  {
    block: 'core/card',
    props: 'link: https://example.com',
    content: 'Card body',
  },
  { block: 'core/list', content: '- Item one\n- Item two' },
  { block: 'core/header', props: 'title: Header Title' },
  { block: 'core/footer', content: 'Footer content.' },
  {
    block: 'core/cta',
    props: 'url: https://example.com\nbuttonText: Go',
    content: 'CTA desc.',
  },
  { block: 'core/html', isContainer: true, childContent: '<p>Raw</p>' },
];

// ---------------------------------------------------------------------------
// Newsletter blocks (14 types)
// ---------------------------------------------------------------------------

const NEWSLETTER_BLOCKS: BlockConfig[] = [
  { block: 'newsletter/intro', content: 'Welcome' },
  {
    block: 'newsletter/featured',
    props: 'image: https://example.com/img.jpg\nsource: TechBlog\nlink: https://example.com',
    content: 'Featured summary',
  },
  {
    block: 'newsletter/category',
    isContainer: true,
    props: 'title: Frontend',
    childContent: '--- newsletter/item\nlink: https://example.com\n\nChild item',
  },
  {
    block: 'newsletter/item',
    props: 'link: https://example.com\nsource: DevBlog',
    content: 'Item description',
  },
  {
    block: 'newsletter/quickHits',
    props: 'title: Quick Hits',
    content: '- [Link](https://example.com)',
  },
  {
    block: 'newsletter/tools',
    isContainer: true,
    props: 'title: Tools',
    childContent: '--- newsletter/item\nlink: https://example.com\n\nTool desc',
  },
  {
    block: 'newsletter/tipOfTheDay',
    props: 'title: Pro Tip',
    content: 'Use shortcuts.',
  },
  {
    block: 'newsletter/community',
    props: 'author: Alice',
    content: 'Great!',
  },
  { block: 'newsletter/personalNote', content: 'My note.' },
  {
    block: 'newsletter/custom',
    props: 'title: Custom Section',
    content: 'Custom content',
  },
  {
    block: 'newsletter/poll',
    props: 'question: Fav lang?\noptions: JS, TS, Rust',
  },
  { block: 'newsletter/ad', props: 'sponsor: Acme\nlink: https://example.com' },
  {
    block: 'newsletter/story',
    props: 'title: Story\nauthor: Bob',
    content: 'Story content.',
  },
  {
    block: 'newsletter/spotlight',
    props: 'title: Spotlight\nimage: https://example.com/spot.jpg',
    content: 'Spotlight desc.',
  },
];

const ALL_BLOCKS = [...CORE_BLOCKS, ...NEWSLETTER_BLOCKS];

// ---------------------------------------------------------------------------
// CSS style properties to test via applyStyleChange
// ---------------------------------------------------------------------------

interface StyleDef {
  prop: string;
  value: string;
}

const CSS_STYLES: StyleDef[] = [
  { prop: 'color', value: '#ff0000' },
  { prop: 'background', value: '#00ff00' },
  { prop: 'border-radius', value: '12px' },
  { prop: 'background-color', value: '#eee' },
  { prop: 'font-size', value: '18px' },
  { prop: 'font-weight', value: '700' },
  { prop: 'line-height', value: '1.5' },
  { prop: 'text-align', value: 'center' },
  { prop: 'padding', value: '16px' },
  { prop: 'margin', value: '8px 16px' },
  { prop: 'border-width', value: '2px' },
  { prop: 'border-style', value: 'solid' },
  { prop: 'border-color', value: 'red' },
  { prop: 'opacity', value: '0.5' },
  { prop: 'box-shadow', value: '0 2px 8px rgba(0,0,0,0.15)' },
  { prop: 'transform', value: 'rotate(5deg)' },
  { prop: 'display', value: 'flex' },
  { prop: 'overflow', value: 'hidden' },
  { prop: 'cursor', value: 'pointer' },
  { prop: 'animation', value: 'fadeIn 0.5s ease' },
  { prop: 'transition', value: 'all 0.3s ease' },
];

// ---------------------------------------------------------------------------
// Source builders
// ---------------------------------------------------------------------------

function namespace(block: string): string {
  return block.split('/')[0];
}

function buildSourceWithoutStyle(cfg: BlockConfig): string {
  const ns = namespace(cfg.block);
  const lines: string[] = [];

  lines.push(`--- use: ${ns}`);
  lines.push('');
  lines.push('--- meta');
  lines.push('version: 1');
  lines.push('');
  lines.push(`--- ${cfg.block}`);

  if (cfg.props) {
    for (const propLine of cfg.props.split('\n')) {
      lines.push(propLine);
    }
  }

  if (cfg.content || cfg.childContent) {
    lines.push('');
  }

  if (cfg.isContainer && cfg.childContent) {
    for (const childLine of cfg.childContent.split('\n')) {
      lines.push(childLine);
    }
    lines.push('');
    lines.push(`--- /${cfg.block}`);
  } else if (cfg.content) {
    for (const contentLine of cfg.content.split('\n')) {
      lines.push(contentLine);
    }
  }

  return lines.join('\n');
}

/**
 * Find a 1-indexed cursor line that sits inside the target block.
 * We place it on the first line after the `--- blockType` header.
 */
function findCursorInBlock(source: string, blockType: string): number {
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === `--- ${blockType}`) {
      return i + 2; // 1-indexed, one line after the header
    }
  }
  throw new Error(`Block ${blockType} not found in source`);
}

// ============================================================================
// PART 1: parseCursorBlock reads native block properties
// ============================================================================

describe('Part 1: parseCursorBlock reads native block properties', () => {
  for (const blockCfg of ALL_BLOCKS) {
    if (!blockCfg.props) continue;
    describe(blockCfg.block, () => {
      const propLines = blockCfg.props!.split('\n');
      for (const propLine of propLines) {
        const colonIdx = propLine.indexOf(': ');
        if (colonIdx === -1) continue;
        const key = propLine.substring(0, colonIdx);
        const value = propLine.substring(colonIdx + 2);
        it(`reads native prop ${key}: ${value}`, () => {
          const src = buildSourceWithoutStyle(blockCfg);
          const cursor = findCursorInBlock(src, blockCfg.block);
          const result = parseCursorBlock(src, cursor);
          expect(result).not.toBeNull();
          expect(result!.properties[key]).toBe(value);
        });
      }
    });
  }
});

// ============================================================================
// Part 1b: parseCursorBlock returns correct block type
// ============================================================================

describe('Part 1b: parseCursorBlock returns correct block type', () => {
  for (const blockCfg of ALL_BLOCKS) {
    it(`identifies block type ${blockCfg.block}`, () => {
      const src = buildSourceWithoutStyle(blockCfg);
      const cursor = findCursorInBlock(src, blockCfg.block);
      const result = parseCursorBlock(src, cursor);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(blockCfg.block);
    });
  }
});

// ============================================================================
// PART 2: applyPropertyChange round-trips for native properties
// ============================================================================

describe('Part 2: applyPropertyChange round-trip -- native props', () => {
  const BLOCKS_WITH_PROPS = ALL_BLOCKS.filter((b) => b.props);

  for (const blockCfg of BLOCKS_WITH_PROPS) {
    describe(blockCfg.block, () => {
      it('adds a new native property', () => {
        const src = buildSourceWithoutStyle(blockCfg);
        const cursor = findCursorInBlock(src, blockCfg.block);
        const parsed = parseCursorBlock(src, cursor);
        expect(parsed).not.toBeNull();

        const { newSource } = applyPropertyChange(
          src,
          parsed!.startLine,
          parsed!.endLine,
          'customProp',
          'hello',
        );

        const cursor2 = findCursorInBlock(newSource, blockCfg.block);
        const parsed2 = parseCursorBlock(newSource, cursor2);
        expect(parsed2).not.toBeNull();
        expect(parsed2!.properties['customProp']).toBe('hello');
      });

      it('updates an existing native property', () => {
        const firstPropLine = blockCfg.props!.split('\n')[0];
        const colonIdx = firstPropLine.indexOf(': ');
        const key = firstPropLine.substring(0, colonIdx);

        const src = buildSourceWithoutStyle(blockCfg);
        const cursor = findCursorInBlock(src, blockCfg.block);
        const parsed = parseCursorBlock(src, cursor);
        expect(parsed).not.toBeNull();

        const { newSource } = applyPropertyChange(
          src,
          parsed!.startLine,
          parsed!.endLine,
          key,
          'updated-value',
        );

        const cursor2 = findCursorInBlock(newSource, blockCfg.block);
        const parsed2 = parseCursorBlock(newSource, cursor2);
        expect(parsed2).not.toBeNull();
        expect(parsed2!.properties[key]).toBe('updated-value');
      });

      it('removes a native property when value is empty', () => {
        const firstPropLine = blockCfg.props!.split('\n')[0];
        const colonIdx = firstPropLine.indexOf(': ');
        const key = firstPropLine.substring(0, colonIdx);

        const src = buildSourceWithoutStyle(blockCfg);
        const cursor = findCursorInBlock(src, blockCfg.block);
        const parsed = parseCursorBlock(src, cursor);
        expect(parsed).not.toBeNull();

        const { newSource } = applyPropertyChange(
          src,
          parsed!.startLine,
          parsed!.endLine,
          key,
          '',
        );

        const cursor2 = findCursorInBlock(newSource, blockCfg.block);
        const parsed2 = parseCursorBlock(newSource, cursor2);
        expect(parsed2).not.toBeNull();
        expect(parsed2!.properties[key]).toBeUndefined();
      });
    });
  }
});

// ============================================================================
// PART 3: applyStyleChange -- add style via StyleGraph
// ============================================================================

describe('Part 3: applyStyleChange adds styles via StyleGraph', () => {
  for (const blockCfg of ALL_BLOCKS) {
    describe(blockCfg.block, () => {
      for (const style of CSS_STYLES.slice(0, 6)) {
        it(`adds ${style.prop}: ${style.value}`, () => {
          const src = buildSourceWithoutStyle(blockCfg);
          const graph = emptyStyleGraph();

          const { newSource, newGraph } = applyStyleChange(
            src,
            graph,
            blockCfg.block,
            'self',
            style.prop,
            style.value,
          );

          // StyleGraph should have the value
          expect(getStyleValue(newGraph, blockCfg.block, 'self', style.prop)).toBe(style.value);

          // Source should contain a --- style block
          expect(newSource).toContain('--- style');

          // Round-trip: parse the graph back from source
          const parsedGraph = parseSourceStyleGraph(newSource);
          expect(getStyleValue(parsedGraph, blockCfg.block, 'self', style.prop)).toBe(style.value);
        });
      }
    });
  }
});

// ============================================================================
// PART 4: applyStyleChange -- update and remove styles
// ============================================================================

describe('Part 4: applyStyleChange update and remove', () => {
  const SUBSET_BLOCKS = [...CORE_BLOCKS.slice(0, 8), ...NEWSLETTER_BLOCKS.slice(0, 7)];

  for (const blockCfg of SUBSET_BLOCKS) {
    describe(blockCfg.block, () => {
      it('updates an existing style value', () => {
        const src = buildSourceWithoutStyle(blockCfg);
        const graph = emptyStyleGraph();

        // Add color
        const { newSource: src2, newGraph: g2 } = applyStyleChange(
          src, graph, blockCfg.block, 'self', 'color', '#ff0000',
        );
        expect(getStyleValue(g2, blockCfg.block, 'self', 'color')).toBe('#ff0000');

        // Update color
        const { newSource: src3, newGraph: g3 } = applyStyleChange(
          src2, g2, blockCfg.block, 'self', 'color', '#00ff00',
        );
        expect(getStyleValue(g3, blockCfg.block, 'self', 'color')).toBe('#00ff00');

        // Round-trip
        const parsedGraph = parseSourceStyleGraph(src3);
        expect(getStyleValue(parsedGraph, blockCfg.block, 'self', 'color')).toBe('#00ff00');
      });

      it('removes a style value when set to empty', () => {
        const src = buildSourceWithoutStyle(blockCfg);
        const graph = emptyStyleGraph();

        // Add
        const { newSource: src2, newGraph: g2 } = applyStyleChange(
          src, graph, blockCfg.block, 'self', 'padding', '16px',
        );
        expect(getStyleValue(g2, blockCfg.block, 'self', 'padding')).toBe('16px');

        // Remove
        const { newGraph: g3 } = applyStyleChange(
          src2, g2, blockCfg.block, 'self', 'padding', '',
        );
        expect(getStyleValue(g3, blockCfg.block, 'self', 'padding')).toBeUndefined();
      });
    });
  }
});

// ============================================================================
// PART 5: applyStyleChange -- targeted/hover styles
// ============================================================================

describe('Part 5: applyStyleChange with hover/targeted styles', () => {
  const HOVER_STYLES: StyleDef[] = [
    { prop: 'transform', value: 'scale(1.05)' },
    { prop: 'opacity', value: '0.8' },
    { prop: 'background-color', value: 'red' },
    { prop: 'box-shadow', value: '0 4px 16px rgba(0,0,0,0.15)' },
  ];

  for (const blockCfg of ALL_BLOCKS) {
    describe(blockCfg.block, () => {
      for (const style of HOVER_STYLES) {
        it(`adds self:hover ${style.prop}: ${style.value}`, () => {
          const src = buildSourceWithoutStyle(blockCfg);
          const graph = emptyStyleGraph();

          const { newGraph } = applyStyleChange(
            src, graph, blockCfg.block, 'self:hover', style.prop, style.value,
          );

          expect(getStyleValue(newGraph, blockCfg.block, 'self:hover', style.prop)).toBe(style.value);
        });
      }

      it('full add -> update -> remove cycle for hover style', () => {
        const src = buildSourceWithoutStyle(blockCfg);
        const graph = emptyStyleGraph();

        // Add
        const { newSource: s2, newGraph: g2 } = applyStyleChange(
          src, graph, blockCfg.block, 'self:hover', 'transform', 'scale(1.05)',
        );
        expect(getStyleValue(g2, blockCfg.block, 'self:hover', 'transform')).toBe('scale(1.05)');

        // Update
        const { newSource: s3, newGraph: g3 } = applyStyleChange(
          s2, g2, blockCfg.block, 'self:hover', 'transform', 'scale(1.1)',
        );
        expect(getStyleValue(g3, blockCfg.block, 'self:hover', 'transform')).toBe('scale(1.1)');

        // Round-trip
        const parsed = parseSourceStyleGraph(s3);
        expect(getStyleValue(parsed, blockCfg.block, 'self:hover', 'transform')).toBe('scale(1.1)');

        // Remove
        const { newGraph: g4 } = applyStyleChange(
          s3, g3, blockCfg.block, 'self:hover', 'transform', '',
        );
        expect(getStyleValue(g4, blockCfg.block, 'self:hover', 'transform')).toBeUndefined();
      });
    });
  }
});

// ============================================================================
// PART 6: applyStyleChange preserves existing source and native properties
// ============================================================================

describe('Part 6: style changes preserve native properties and content', () => {
  const BLOCKS_WITH_PROPS = ALL_BLOCKS.filter((b) => b.props);

  for (const blockCfg of BLOCKS_WITH_PROPS) {
    it(`${blockCfg.block}: native props preserved after style change`, () => {
      const src = buildSourceWithoutStyle(blockCfg);
      const graph = emptyStyleGraph();

      const { newSource } = applyStyleChange(
        src, graph, blockCfg.block, 'self', 'color', 'red',
      );

      // Native props should still be parseable
      const cursor = findCursorInBlock(newSource, blockCfg.block);
      const parsed = parseCursorBlock(newSource, cursor);
      expect(parsed).not.toBeNull();

      if (blockCfg.props) {
        for (const propLine of blockCfg.props.split('\n')) {
          const colonIdx = propLine.indexOf(': ');
          if (colonIdx === -1) continue;
          const key = propLine.substring(0, colonIdx);
          const value = propLine.substring(colonIdx + 2);
          expect(parsed!.properties[key]).toBe(value);
        }
      }

      // Content should still be present
      if (blockCfg.content) {
        const firstContentLine = blockCfg.content.split('\n')[0];
        expect(newSource).toContain(firstContentLine);
      }
    });
  }
});

// ============================================================================
// PART 7: Full add -> update -> remove cycle for every block x styles
// ============================================================================

describe('Part 7: full add -> update -> remove cycle via StyleGraph', () => {
  const CYCLE_STYLES = CSS_STYLES.slice(0, 6);
  const UPDATED_VALUES: Record<string, string> = {
    'color': '#00ff00',
    'background': 'yellow',
    'border-radius': '20px',
    'background-color': '#999',
    'font-size': '32px',
    'font-weight': '400',
  };

  for (const blockCfg of ALL_BLOCKS) {
    describe(blockCfg.block, () => {
      for (const style of CYCLE_STYLES) {
        it(`add -> update -> remove ${style.prop}`, () => {
          let src = buildSourceWithoutStyle(blockCfg);
          let graph = emptyStyleGraph();

          // Add
          const r1 = applyStyleChange(src, graph, blockCfg.block, 'self', style.prop, style.value);
          src = r1.newSource; graph = r1.newGraph;
          expect(getStyleValue(graph, blockCfg.block, 'self', style.prop)).toBe(style.value);

          // Update
          const newVal = UPDATED_VALUES[style.prop];
          const r2 = applyStyleChange(src, graph, blockCfg.block, 'self', style.prop, newVal);
          src = r2.newSource; graph = r2.newGraph;
          expect(getStyleValue(graph, blockCfg.block, 'self', style.prop)).toBe(newVal);

          // Remove
          const r3 = applyStyleChange(src, graph, blockCfg.block, 'self', style.prop, '');
          graph = r3.newGraph;
          expect(getStyleValue(graph, blockCfg.block, 'self', style.prop)).toBeUndefined();
        });
      }
    });
  }
});

// ============================================================================
// PART 8: Edge cases
// ============================================================================

describe('Part 8: edge cases', () => {
  it('returns null for cursor before any block', () => {
    const src = '--- use: core\n\n--- meta\nversion: 1\n\n--- core/text\n\nHello';
    const result = parseCursorBlock(src, 1);
    expect(result).not.toBeNull();
    expect(result!.isSpecial).toBe(true);
  });

  it('returns null for style block', () => {
    const src = '--- use: core\n\n--- style\n.heading { color: red; }\n\n--- core/text\n\nHello';
    const result = parseCursorBlock(src, 4);
    expect(result).toBeNull();
  });

  it('identifies meta as special block', () => {
    const src = '--- use: core\n\n--- meta\nversion: 1\n\n--- core/text\n\nHello';
    const result = parseCursorBlock(src, 4);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('meta');
    expect(result!.isSpecial).toBe(true);
    expect(result!.properties['version']).toBe('1');
  });

  it('identifies use as special block with label', () => {
    const src = '--- use: core\n\n--- meta\nversion: 1';
    const result = parseCursorBlock(src, 1);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('use');
    expect(result!.isSpecial).toBe(true);
    expect(result!.label).toBe('core');
  });

  it('handles empty source', () => {
    const result = parseCursorBlock('', 1);
    expect(result).toBeNull();
  });

  it('handles cursor beyond source length', () => {
    const src = '--- use: core\n\n--- core/text\n\nHello';
    const result = parseCursorBlock(src, 100);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('core/text');
  });

  it('handles blocks with no properties and no content', () => {
    const src = '--- use: core\n\n--- core/divider';
    const cursor = findCursorInBlock(src, 'core/divider');
    const parsed = parseCursorBlock(src, cursor);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('core/divider');
    expect(Object.keys(parsed!.properties)).toHaveLength(0);
  });

  it('applyPropertyChange does not affect adjacent blocks', () => {
    const src = [
      '--- use: core',
      '',
      '--- core/text',
      '',
      'First block',
      '',
      '--- core/heading',
      'level: 2',
      'text: Title',
      '',
      'Heading content',
    ].join('\n');

    const cursor = findCursorInBlock(src, 'core/heading');
    const parsed = parseCursorBlock(src, cursor);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('core/heading');

    const { newSource } = applyPropertyChange(
      src,
      parsed!.startLine,
      parsed!.endLine,
      'align',
      'center',
    );

    // Heading block should have the new prop
    const headingCursor = findCursorInBlock(newSource, 'core/heading');
    const headingParsed = parseCursorBlock(newSource, headingCursor);
    expect(headingParsed).not.toBeNull();
    expect(headingParsed!.properties['align']).toBe('center');
    expect(headingParsed!.properties['level']).toBe('2');
  });

  it('applyStyleChange auto-inserts --- style block', () => {
    const src = '--- use: core\n\n--- core/text\n\nHello';
    const graph = emptyStyleGraph();

    const { newSource } = applyStyleChange(
      src, graph, 'core/text', 'self', 'color', 'red',
    );

    expect(newSource).toContain('--- style');
    const parsedGraph = parseSourceStyleGraph(newSource);
    expect(getStyleValue(parsedGraph, 'core/text', 'self', 'color')).toBe('red');
  });

  it('applyStyleChange patches existing --- style block', () => {
    const src = [
      '--- use: core',
      '',
      '--- style',
      '',
      'core/text',
      '  color: blue',
      '',
      '',
      '--- core/text',
      '',
      'Hello',
    ].join('\n');

    const graph = parseSourceStyleGraph(src);
    expect(getStyleValue(graph, 'core/text', 'self', 'color')).toBe('blue');

    const { newSource, newGraph } = applyStyleChange(
      src, graph, 'core/text', 'self', 'padding', '16px',
    );

    expect(getStyleValue(newGraph, 'core/text', 'self', 'color')).toBe('blue');
    expect(getStyleValue(newGraph, 'core/text', 'self', 'padding')).toBe('16px');

    // Round-trip
    const reparsed = parseSourceStyleGraph(newSource);
    expect(getStyleValue(reparsed, 'core/text', 'self', 'color')).toBe('blue');
    expect(getStyleValue(reparsed, 'core/text', 'self', 'padding')).toBe('16px');
  });

  it('multiple style changes accumulate in the same --- style block', () => {
    let src = '--- use: core\n\n--- core/card\nlink: https://example.com\n\nCard body';
    let graph = emptyStyleGraph();

    // Add color
    const r1 = applyStyleChange(src, graph, 'core/card', 'self', 'color', 'red');
    src = r1.newSource; graph = r1.newGraph;

    // Add padding
    const r2 = applyStyleChange(src, graph, 'core/card', 'self', 'padding', '16px');
    src = r2.newSource; graph = r2.newGraph;

    // Add hover
    const r3 = applyStyleChange(src, graph, 'core/card', 'self:hover', 'transform', 'scale(1.05)');
    src = r3.newSource; graph = r3.newGraph;

    // All 3 should be in the graph
    expect(getStyleValue(graph, 'core/card', 'self', 'color')).toBe('red');
    expect(getStyleValue(graph, 'core/card', 'self', 'padding')).toBe('16px');
    expect(getStyleValue(graph, 'core/card', 'self:hover', 'transform')).toBe('scale(1.05)');

    // Should be one --- style block with all 3
    const styleBlockCount = (src.match(/--- style/g) || []).length;
    expect(styleBlockCount).toBe(1);

    // Round-trip
    const reparsed = parseSourceStyleGraph(src);
    expect(getStyleValue(reparsed, 'core/card', 'self', 'color')).toBe('red');
    expect(getStyleValue(reparsed, 'core/card', 'self', 'padding')).toBe('16px');
    expect(getStyleValue(reparsed, 'core/card', 'self:hover', 'transform')).toBe('scale(1.05)');
  });

  it('handles property values containing colons', () => {
    const src = '--- use: core\n\n--- core/text\n\nHello';
    const graph = emptyStyleGraph();

    const { newGraph } = applyStyleChange(
      src, graph, 'core/text', 'self', 'box-shadow', '0 2px 8px rgba(0,0,0,0.15)',
    );
    expect(getStyleValue(newGraph, 'core/text', 'self', 'box-shadow')).toBe('0 2px 8px rgba(0,0,0,0.15)');
  });

  it('style changes for different blocks create separate rules', () => {
    let src = [
      '--- use: core',
      '',
      '--- core/heading',
      'level: 2',
      'text: Title',
      '',
      '--- core/text',
      '',
      'Hello',
    ].join('\n');

    let graph = emptyStyleGraph();

    const r1 = applyStyleChange(src, graph, 'core/heading', 'self', 'color', 'blue');
    src = r1.newSource; graph = r1.newGraph;

    const r2 = applyStyleChange(src, graph, 'core/text', 'self', 'color', 'red');
    src = r2.newSource; graph = r2.newGraph;

    expect(getStyleValue(graph, 'core/heading', 'self', 'color')).toBe('blue');
    expect(getStyleValue(graph, 'core/text', 'self', 'color')).toBe('red');

    // Round-trip
    const reparsed = parseSourceStyleGraph(src);
    expect(getStyleValue(reparsed, 'core/heading', 'self', 'color')).toBe('blue');
    expect(getStyleValue(reparsed, 'core/text', 'self', 'color')).toBe('red');
  });
});
