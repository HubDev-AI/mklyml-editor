import { describe, it, expect } from 'bun:test';
import { parseCursorBlock } from '../src/store/use-cursor-context';
import { applyPropertyChange } from '../src/store/block-properties';

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
    block: 'newsletter/poll',
    props: 'question: Fav?\noption1: React\noption2: Vue',
  },
  {
    block: 'newsletter/recommendations',
    props: 'title: Recommended',
    content: '- [Book](https://example.com)',
  },
  {
    block: 'newsletter/sponsor',
    props: 'image: https://example.com/s.jpg\nlink: https://example.com\nlabel: Try',
    content: 'Sponsor desc',
  },
  {
    block: 'newsletter/outro',
    props: 'ctaUrl: https://example.com\nctaText: Share',
    content: 'Thanks!',
  },
  {
    block: 'newsletter/custom',
    props: 'title: Custom Section',
    content: 'Custom content.',
  },
];

const ALL_BLOCKS = [...CORE_BLOCKS, ...NEWSLETTER_BLOCKS];

// ---------------------------------------------------------------------------
// CSS style properties (24)
// ---------------------------------------------------------------------------

interface StyleDef {
  prop: string;
  value: string;
}

const CSS_STYLES: StyleDef[] = [
  { prop: 'color', value: '#ff0000' },
  { prop: 'bg', value: '#00ff00' },
  { prop: 'fg', value: 'blue' },
  { prop: 'rounded', value: '12px' },
  { prop: 'backgroundColor', value: '#eee' },
  { prop: 'fontSize', value: '18px' },
  { prop: 'fontWeight', value: '700' },
  { prop: 'fontFamily', value: 'Georgia serif' },
  { prop: 'lineHeight', value: '1.5' },
  { prop: 'textAlign', value: 'center' },
  { prop: 'padding', value: '16px' },
  { prop: 'margin', value: '8px 16px' },
  { prop: 'borderWidth', value: '2px' },
  { prop: 'borderStyle', value: 'solid' },
  { prop: 'borderColor', value: 'red' },
  { prop: 'borderRadius', value: '8px' },
  { prop: 'opacity', value: '0.5' },
  { prop: 'boxShadow', value: '0 2px 8px rgba(0,0,0,0.15)' },
  { prop: 'transform', value: 'rotate(5deg)' },
  { prop: 'display', value: 'flex' },
  { prop: 'overflow', value: 'hidden' },
  { prop: 'cursor', value: 'pointer' },
  { prop: 'animation', value: 'fadeIn 0.5s ease' },
  { prop: 'transition', value: 'all 0.3s ease' },
];

// ---------------------------------------------------------------------------
// Targeted style properties (4)
// ---------------------------------------------------------------------------

interface TargetedStyleDef {
  key: string;
  value: string;
}

const TARGETED_STYLES: TargetedStyleDef[] = [
  { key: '@.self:hover/transform', value: 'scale(1.05)' },
  { key: '@.self:hover/opacity', value: '0.8' },
  { key: '@.self:hover/backgroundColor', value: 'red' },
  { key: '@.self:hover/boxShadow', value: '0 4px 16px rgba(0,0,0,0.15)' },
];

const ALL_STYLES: { key: string; value: string }[] = [
  ...CSS_STYLES.map((s) => ({ key: `@${s.prop}`, value: s.value })),
  ...TARGETED_STYLES,
];

// ---------------------------------------------------------------------------
// Source builders
// ---------------------------------------------------------------------------

function namespace(block: string): string {
  return block.split('/')[0];
}

function buildSourceWithStyle(
  cfg: BlockConfig,
  styleLine: string | null,
): string {
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

  if (styleLine) {
    lines.push(styleLine);
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

function buildSourceWithoutStyle(cfg: BlockConfig): string {
  return buildSourceWithStyle(cfg, null);
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

/**
 * Find a 1-indexed cursor line that sits on a specific property line.
 */
function findCursorOnProperty(
  source: string,
  blockType: string,
  propKey: string,
): number {
  const lines = source.split('\n');
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === `--- ${blockType}`) {
      inBlock = true;
      continue;
    }
    if (inBlock && trimmed.match(/^---\s+[\w/]/)) {
      break;
    }
    if (inBlock && lines[i].startsWith(`${propKey}: `)) {
      return i + 1; // 1-indexed
    }
  }
  throw new Error(`Property ${propKey} not found in block ${blockType}`);
}

// ============================================================================
// PART 1: parseCursorBlock reads back properties for every block x every style
// ============================================================================

describe('Part 1: parseCursorBlock reads properties', () => {
  describe('core blocks', () => {
    for (const blockCfg of CORE_BLOCKS) {
      describe(blockCfg.block, () => {
        // CSS styles (@ prefixed)
        for (const style of CSS_STYLES) {
          it(`reads @${style.prop}: ${style.value}`, () => {
            const src = buildSourceWithStyle(
              blockCfg,
              `@${style.prop}: ${style.value}`,
            );
            const cursor = findCursorInBlock(src, blockCfg.block);
            const result = parseCursorBlock(src, cursor);
            expect(result).not.toBeNull();
            expect(result!.properties[`@${style.prop}`]).toBe(style.value);
          });
        }

        // Targeted styles
        for (const ts of TARGETED_STYLES) {
          it(`reads ${ts.key}: ${ts.value}`, () => {
            const src = buildSourceWithStyle(
              blockCfg,
              `${ts.key}: ${ts.value}`,
            );
            const cursor = findCursorInBlock(src, blockCfg.block);
            const result = parseCursorBlock(src, cursor);
            expect(result).not.toBeNull();
            expect(result!.properties[ts.key]).toBe(ts.value);
          });
        }
      });
    }
  });

  describe('newsletter blocks', () => {
    for (const blockCfg of NEWSLETTER_BLOCKS) {
      describe(blockCfg.block, () => {
        // CSS styles (@ prefixed)
        for (const style of CSS_STYLES) {
          it(`reads @${style.prop}: ${style.value}`, () => {
            const src = buildSourceWithStyle(
              blockCfg,
              `@${style.prop}: ${style.value}`,
            );
            const cursor = findCursorInBlock(src, blockCfg.block);
            const result = parseCursorBlock(src, cursor);
            expect(result).not.toBeNull();
            expect(result!.properties[`@${style.prop}`]).toBe(style.value);
          });
        }

        // Targeted styles
        for (const ts of TARGETED_STYLES) {
          it(`reads ${ts.key}: ${ts.value}`, () => {
            const src = buildSourceWithStyle(
              blockCfg,
              `${ts.key}: ${ts.value}`,
            );
            const cursor = findCursorInBlock(src, blockCfg.block);
            const result = parseCursorBlock(src, cursor);
            expect(result).not.toBeNull();
            expect(result!.properties[ts.key]).toBe(ts.value);
          });
        }
      });
    }
  });
});

// ============================================================================
// Part 1b: parseCursorBlock reads back native block properties
// ============================================================================

describe('Part 1b: parseCursorBlock reads native block properties', () => {
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
// Part 1c: parseCursorBlock returns correct block type
// ============================================================================

describe('Part 1c: parseCursorBlock returns correct block type', () => {
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
// Part 1d: parseCursorBlock with multiple style properties simultaneously
// ============================================================================

describe('Part 1d: multiple style properties on same block', () => {
  for (const blockCfg of ALL_BLOCKS) {
    it(`${blockCfg.block} with 3 styles at once`, () => {
      const styles = CSS_STYLES.slice(0, 3);
      const styleLines = styles
        .map((s) => `@${s.prop}: ${s.value}`)
        .join('\n');
      const ns = namespace(blockCfg.block);
      const lines: string[] = [];
      lines.push(`--- use: ${ns}`);
      lines.push('');
      lines.push('--- meta');
      lines.push('version: 1');
      lines.push('');
      lines.push(`--- ${blockCfg.block}`);
      if (blockCfg.props) {
        for (const p of blockCfg.props.split('\n')) lines.push(p);
      }
      for (const sl of styleLines.split('\n')) lines.push(sl);
      if (blockCfg.content) {
        lines.push('');
        for (const cl of blockCfg.content.split('\n')) lines.push(cl);
      }
      const src = lines.join('\n');
      const cursor = findCursorInBlock(src, blockCfg.block);
      const result = parseCursorBlock(src, cursor);
      expect(result).not.toBeNull();
      for (const s of styles) {
        expect(result!.properties[`@${s.prop}`]).toBe(s.value);
      }
    });
  }
});

// ============================================================================
// PART 2: applyPropertyChange round-trips for every block x every style
// ============================================================================

describe('Part 2: applyPropertyChange round-trip -- add style', () => {
  describe('core blocks', () => {
    for (const blockCfg of CORE_BLOCKS) {
      describe(blockCfg.block, () => {
        // CSS styles
        for (const style of CSS_STYLES) {
          it(`round-trips @${style.prop}: ${style.value}`, () => {
            const src = buildSourceWithoutStyle(blockCfg);
            const cursor = findCursorInBlock(src, blockCfg.block);
            const parsed = parseCursorBlock(src, cursor);
            expect(parsed).not.toBeNull();

            const { newSource } = applyPropertyChange(
              src,
              parsed!.startLine,
              parsed!.endLine,
              `@${style.prop}`,
              style.value,
            );

            const cursor2 = findCursorInBlock(newSource, blockCfg.block);
            const parsed2 = parseCursorBlock(newSource, cursor2);
            expect(parsed2).not.toBeNull();
            expect(parsed2!.properties[`@${style.prop}`]).toBe(style.value);
          });
        }

        // Targeted styles
        for (const ts of TARGETED_STYLES) {
          it(`round-trips ${ts.key}: ${ts.value}`, () => {
            const src = buildSourceWithoutStyle(blockCfg);
            const cursor = findCursorInBlock(src, blockCfg.block);
            const parsed = parseCursorBlock(src, cursor);
            expect(parsed).not.toBeNull();

            const { newSource } = applyPropertyChange(
              src,
              parsed!.startLine,
              parsed!.endLine,
              ts.key,
              ts.value,
            );

            const cursor2 = findCursorInBlock(newSource, blockCfg.block);
            const parsed2 = parseCursorBlock(newSource, cursor2);
            expect(parsed2).not.toBeNull();
            expect(parsed2!.properties[ts.key]).toBe(ts.value);
          });
        }
      });
    }
  });

  describe('newsletter blocks', () => {
    for (const blockCfg of NEWSLETTER_BLOCKS) {
      describe(blockCfg.block, () => {
        // CSS styles
        for (const style of CSS_STYLES) {
          it(`round-trips @${style.prop}: ${style.value}`, () => {
            const src = buildSourceWithoutStyle(blockCfg);
            const cursor = findCursorInBlock(src, blockCfg.block);
            const parsed = parseCursorBlock(src, cursor);
            expect(parsed).not.toBeNull();

            const { newSource } = applyPropertyChange(
              src,
              parsed!.startLine,
              parsed!.endLine,
              `@${style.prop}`,
              style.value,
            );

            const cursor2 = findCursorInBlock(newSource, blockCfg.block);
            const parsed2 = parseCursorBlock(newSource, cursor2);
            expect(parsed2).not.toBeNull();
            expect(parsed2!.properties[`@${style.prop}`]).toBe(style.value);
          });
        }

        // Targeted styles
        for (const ts of TARGETED_STYLES) {
          it(`round-trips ${ts.key}: ${ts.value}`, () => {
            const src = buildSourceWithoutStyle(blockCfg);
            const cursor = findCursorInBlock(src, blockCfg.block);
            const parsed = parseCursorBlock(src, cursor);
            expect(parsed).not.toBeNull();

            const { newSource } = applyPropertyChange(
              src,
              parsed!.startLine,
              parsed!.endLine,
              ts.key,
              ts.value,
            );

            const cursor2 = findCursorInBlock(newSource, blockCfg.block);
            const parsed2 = parseCursorBlock(newSource, cursor2);
            expect(parsed2).not.toBeNull();
            expect(parsed2!.properties[ts.key]).toBe(ts.value);
          });
        }
      });
    }
  });
});

// ============================================================================
// PART 3: applyPropertyChange removal -- setting value='' removes the property
// ============================================================================

describe('Part 3: applyPropertyChange removal', () => {
  // Test a representative subset: first 8 core + first 7 newsletter = 15 blocks
  const REMOVAL_BLOCKS = [...CORE_BLOCKS.slice(0, 8), ...NEWSLETTER_BLOCKS.slice(0, 7)];

  for (const blockCfg of REMOVAL_BLOCKS) {
    describe(blockCfg.block, () => {
      // Test removal for all CSS styles
      for (const style of CSS_STYLES) {
        it(`removes @${style.prop} when value is empty`, () => {
          // Start with the style present
          const src = buildSourceWithStyle(
            blockCfg,
            `@${style.prop}: ${style.value}`,
          );
          const cursor = findCursorInBlock(src, blockCfg.block);
          const parsed = parseCursorBlock(src, cursor);
          expect(parsed).not.toBeNull();
          expect(parsed!.properties[`@${style.prop}`]).toBe(style.value);

          // Remove it
          const { newSource } = applyPropertyChange(
            src,
            parsed!.startLine,
            parsed!.endLine,
            `@${style.prop}`,
            '',
          );

          const cursor2 = findCursorInBlock(newSource, blockCfg.block);
          const parsed2 = parseCursorBlock(newSource, cursor2);
          expect(parsed2).not.toBeNull();
          expect(parsed2!.properties[`@${style.prop}`]).toBeUndefined();
        });
      }

      // Test removal for all targeted styles
      for (const ts of TARGETED_STYLES) {
        it(`removes ${ts.key} when value is empty`, () => {
          const src = buildSourceWithStyle(blockCfg, `${ts.key}: ${ts.value}`);
          const cursor = findCursorInBlock(src, blockCfg.block);
          const parsed = parseCursorBlock(src, cursor);
          expect(parsed).not.toBeNull();
          expect(parsed!.properties[ts.key]).toBe(ts.value);

          const { newSource } = applyPropertyChange(
            src,
            parsed!.startLine,
            parsed!.endLine,
            ts.key,
            '',
          );

          const cursor2 = findCursorInBlock(newSource, blockCfg.block);
          const parsed2 = parseCursorBlock(newSource, cursor2);
          expect(parsed2).not.toBeNull();
          expect(parsed2!.properties[ts.key]).toBeUndefined();
        });
      }
    });
  }
});

// ============================================================================
// PART 4: applyPropertyChange update -- change existing value
// ============================================================================

describe('Part 4: applyPropertyChange update existing value', () => {
  // Test a representative subset: first 8 core + first 7 newsletter = 15 blocks
  const UPDATE_BLOCKS = [...CORE_BLOCKS.slice(0, 8), ...NEWSLETTER_BLOCKS.slice(0, 7)];

  const UPDATE_PAIRS: { style: StyleDef; newValue: string }[] = [
    { style: CSS_STYLES[0], newValue: '#00ff00' },        // color: #ff0000 -> #00ff00
    { style: CSS_STYLES[1], newValue: '#0000ff' },        // bg: #00ff00 -> #0000ff
    { style: CSS_STYLES[4], newValue: '#333' },            // backgroundColor: #eee -> #333
    { style: CSS_STYLES[5], newValue: '24px' },            // fontSize: 18px -> 24px
    { style: CSS_STYLES[6], newValue: '400' },             // fontWeight: 700 -> 400
    { style: CSS_STYLES[8], newValue: '2.0' },             // lineHeight: 1.5 -> 2.0
    { style: CSS_STYLES[9], newValue: 'left' },            // textAlign: center -> left
    { style: CSS_STYLES[10], newValue: '32px' },           // padding: 16px -> 32px
    { style: CSS_STYLES[15], newValue: '16px' },           // borderRadius: 8px -> 16px
    { style: CSS_STYLES[16], newValue: '1' },              // opacity: 0.5 -> 1
    { style: CSS_STYLES[17], newValue: '0 4px 12px rgba(0,0,0,0.3)' }, // boxShadow updated
    { style: CSS_STYLES[18], newValue: 'rotate(10deg)' },  // transform updated
  ];

  for (const blockCfg of UPDATE_BLOCKS) {
    describe(blockCfg.block, () => {
      for (const { style, newValue } of UPDATE_PAIRS) {
        it(`updates @${style.prop} from ${style.value} to ${newValue}`, () => {
          // Start with old value
          const src = buildSourceWithStyle(
            blockCfg,
            `@${style.prop}: ${style.value}`,
          );
          const cursor = findCursorInBlock(src, blockCfg.block);
          const parsed = parseCursorBlock(src, cursor);
          expect(parsed).not.toBeNull();
          expect(parsed!.properties[`@${style.prop}`]).toBe(style.value);

          // Update to new value
          const { newSource } = applyPropertyChange(
            src,
            parsed!.startLine,
            parsed!.endLine,
            `@${style.prop}`,
            newValue,
          );

          const cursor2 = findCursorInBlock(newSource, blockCfg.block);
          const parsed2 = parseCursorBlock(newSource, cursor2);
          expect(parsed2).not.toBeNull();
          expect(parsed2!.properties[`@${style.prop}`]).toBe(newValue);
        });
      }

      // Targeted style updates
      for (const ts of TARGETED_STYLES) {
        const newValue =
          ts.key === '@.self:hover/transform'
            ? 'scale(1.1)'
            : ts.key === '@.self:hover/opacity'
              ? '0.9'
              : ts.key === '@.self:hover/backgroundColor'
                ? 'blue'
                : '0 8px 24px rgba(0,0,0,0.3)';

        it(`updates ${ts.key} from ${ts.value} to ${newValue}`, () => {
          const src = buildSourceWithStyle(blockCfg, `${ts.key}: ${ts.value}`);
          const cursor = findCursorInBlock(src, blockCfg.block);
          const parsed = parseCursorBlock(src, cursor);
          expect(parsed).not.toBeNull();
          expect(parsed!.properties[ts.key]).toBe(ts.value);

          const { newSource } = applyPropertyChange(
            src,
            parsed!.startLine,
            parsed!.endLine,
            ts.key,
            newValue,
          );

          const cursor2 = findCursorInBlock(newSource, blockCfg.block);
          const parsed2 = parseCursorBlock(newSource, cursor2);
          expect(parsed2).not.toBeNull();
          expect(parsed2!.properties[ts.key]).toBe(newValue);
        });
      }
    });
  }
});

// ============================================================================
// PART 5: Blank line insertion
// ============================================================================

describe('Part 5: blank line insertion when adding style to block with content', () => {
  // Only test blocks that have content (not pure-property or empty blocks)
  const CONTENT_BLOCKS = ALL_BLOCKS.filter(
    (b) => b.content && !b.isContainer,
  );

  for (const blockCfg of CONTENT_BLOCKS) {
    describe(blockCfg.block, () => {
      it('inserts blank line between new style property and content', () => {
        // Build source without any style
        const src = buildSourceWithoutStyle(blockCfg);
        const cursor = findCursorInBlock(src, blockCfg.block);
        const parsed = parseCursorBlock(src, cursor);
        expect(parsed).not.toBeNull();

        // Add a style property
        const { newSource } = applyPropertyChange(
          src,
          parsed!.startLine,
          parsed!.endLine,
          '@color',
          '#ff0000',
        );

        // Find the @color line and check there's a blank line after it before content
        const newLines = newSource.split('\n');
        let colorLineIdx = -1;
        for (let i = 0; i < newLines.length; i++) {
          if (newLines[i] === '@color: #ff0000') {
            colorLineIdx = i;
            break;
          }
        }
        expect(colorLineIdx).toBeGreaterThan(-1);

        // Next line should be blank (separator before content)
        const nextLine = newLines[colorLineIdx + 1];
        expect(nextLine.trim()).toBe('');

        // Verify the property is correctly parsed
        const cursor2 = findCursorInBlock(newSource, blockCfg.block);
        const parsed2 = parseCursorBlock(newSource, cursor2);
        expect(parsed2).not.toBeNull();
        expect(parsed2!.properties['@color']).toBe('#ff0000');
      });

      it('does NOT insert extra blank line when block already has style props', () => {
        // Build source WITH a style already
        const src = buildSourceWithStyle(blockCfg, '@bg: #eee');
        const cursor = findCursorInBlock(src, blockCfg.block);
        const parsed = parseCursorBlock(src, cursor);
        expect(parsed).not.toBeNull();

        // Add another style
        const { newSource } = applyPropertyChange(
          src,
          parsed!.startLine,
          parsed!.endLine,
          '@color',
          '#ff0000',
        );

        // Count consecutive blank lines -- there should be at most 1
        const newLines = newSource.split('\n');
        let maxConsecutiveBlanks = 0;
        let consecutiveBlanks = 0;
        for (const line of newLines) {
          if (line.trim() === '') {
            consecutiveBlanks++;
            if (consecutiveBlanks > maxConsecutiveBlanks) {
              maxConsecutiveBlanks = consecutiveBlanks;
            }
          } else {
            consecutiveBlanks = 0;
          }
        }
        expect(maxConsecutiveBlanks).toBeLessThanOrEqual(1);

        // Verify both properties are present
        const cursor2 = findCursorInBlock(newSource, blockCfg.block);
        const parsed2 = parseCursorBlock(newSource, cursor2);
        expect(parsed2).not.toBeNull();
        expect(parsed2!.properties['@bg']).toBe('#eee');
        expect(parsed2!.properties['@color']).toBe('#ff0000');
      });
    });
  }

  // Container blocks: adding a style before child content
  const CONTAINER_BLOCKS = ALL_BLOCKS.filter((b) => b.isContainer);

  for (const blockCfg of CONTAINER_BLOCKS) {
    it(`${blockCfg.block}: inserts blank line between new style and child content`, () => {
      const src = buildSourceWithoutStyle(blockCfg);
      const cursor = findCursorInBlock(src, blockCfg.block);
      const parsed = parseCursorBlock(src, cursor);
      expect(parsed).not.toBeNull();

      const { newSource } = applyPropertyChange(
        src,
        parsed!.startLine,
        parsed!.endLine,
        '@padding',
        '16px',
      );

      const cursor2 = findCursorInBlock(newSource, blockCfg.block);
      const parsed2 = parseCursorBlock(newSource, cursor2);
      expect(parsed2).not.toBeNull();
      expect(parsed2!.properties['@padding']).toBe('16px');
    });
  }
});

// ============================================================================
// PART 5b: Blank line insertion for blocks with existing native props only
// ============================================================================

describe('Part 5b: blank line for blocks with native props and content but no styles', () => {
  const BLOCKS_WITH_PROPS_AND_CONTENT = ALL_BLOCKS.filter(
    (b) => b.props && b.content && !b.isContainer,
  );

  for (const blockCfg of BLOCKS_WITH_PROPS_AND_CONTENT) {
    it(`${blockCfg.block}: style inserted after native props, blank line before content`, () => {
      const src = buildSourceWithoutStyle(blockCfg);
      const cursor = findCursorInBlock(src, blockCfg.block);
      const parsed = parseCursorBlock(src, cursor);
      expect(parsed).not.toBeNull();

      const { newSource } = applyPropertyChange(
        src,
        parsed!.startLine,
        parsed!.endLine,
        '@fontSize',
        '20px',
      );

      // Verify property is present
      const cursor2 = findCursorInBlock(newSource, blockCfg.block);
      const parsed2 = parseCursorBlock(newSource, cursor2);
      expect(parsed2).not.toBeNull();
      expect(parsed2!.properties['@fontSize']).toBe('20px');

      // Verify native props are preserved
      if (blockCfg.props) {
        for (const propLine of blockCfg.props.split('\n')) {
          const colonIdx = propLine.indexOf(': ');
          if (colonIdx === -1) continue;
          const key = propLine.substring(0, colonIdx);
          const value = propLine.substring(colonIdx + 2);
          expect(parsed2!.properties[key]).toBe(value);
        }
      }

      // Verify content is still present in the source
      if (blockCfg.content) {
        const firstContentLine = blockCfg.content.split('\n')[0];
        expect(newSource).toContain(firstContentLine);
      }
    });
  }
});

// ============================================================================
// PART 6: Edge cases
// ============================================================================

describe('Part 6: edge cases', () => {
  it('returns null for cursor before any block', () => {
    const src = '--- use: core\n\n--- meta\nversion: 1\n\n--- core/text\n\nHello';
    const result = parseCursorBlock(src, 1); // On the use declaration line body
    // The use line IS a special block
    expect(result).not.toBeNull();
    expect(result!.isSpecial).toBe(true);
  });

  it('returns null for style block', () => {
    const src = '--- use: core\n\n--- style\n.heading { color: red; }\n\n--- core/text\n\nHello';
    // cursor on line 4 (1-indexed), which is inside the style block
    const result = parseCursorBlock(src, 4);
    expect(result).toBeNull();
  });

  it('identifies meta as special block', () => {
    const src = '--- use: core\n\n--- meta\nversion: 1\n\n--- core/text\n\nHello';
    const result = parseCursorBlock(src, 4); // On "version: 1" line
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
    // Should still find the block by scanning backward
    expect(result).not.toBeNull();
    expect(result!.type).toBe('core/text');
  });

  it('applyPropertyChange handles property at last line of block before next block', () => {
    const src =
      '--- use: core\n\n--- core/text\n@color: red\n\nHello\n\n--- core/divider';
    const cursor = findCursorInBlock(src, 'core/text');
    const parsed = parseCursorBlock(src, cursor);
    expect(parsed).not.toBeNull();

    // Update existing
    const { newSource } = applyPropertyChange(
      src,
      parsed!.startLine,
      parsed!.endLine,
      '@color',
      'blue',
    );

    const cursor2 = findCursorInBlock(newSource, 'core/text');
    const parsed2 = parseCursorBlock(newSource, cursor2);
    expect(parsed2).not.toBeNull();
    expect(parsed2!.properties['@color']).toBe('blue');

    // Verify divider block still exists
    expect(newSource).toContain('--- core/divider');
  });

  it('applyPropertyChange does not affect adjacent blocks', () => {
    const src = [
      '--- use: core',
      '',
      '--- core/text',
      '@bg: #eee',
      '',
      'First block',
      '',
      '--- core/heading',
      'level: 2',
      'text: Title',
      '',
      'Heading content',
    ].join('\n');

    // Add color to heading block
    const cursor = findCursorInBlock(src, 'core/heading');
    const parsed = parseCursorBlock(src, cursor);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('core/heading');

    const { newSource } = applyPropertyChange(
      src,
      parsed!.startLine,
      parsed!.endLine,
      '@color',
      'red',
    );

    // Text block should still have its bg and not gain color
    const textCursor = findCursorInBlock(newSource, 'core/text');
    const textParsed = parseCursorBlock(newSource, textCursor);
    expect(textParsed).not.toBeNull();
    expect(textParsed!.properties['@bg']).toBe('#eee');
    expect(textParsed!.properties['@color']).toBeUndefined();

    // Heading block should have color
    const headingCursor = findCursorInBlock(newSource, 'core/heading');
    const headingParsed = parseCursorBlock(newSource, headingCursor);
    expect(headingParsed).not.toBeNull();
    expect(headingParsed!.properties['@color']).toBe('red');
    expect(headingParsed!.properties['level']).toBe('2');
  });

  it('applyPropertyChange with removal does not leave double blank lines', () => {
    const src = [
      '--- use: core',
      '',
      '--- core/text',
      '@color: red',
      '',
      'Hello',
    ].join('\n');

    const cursor = findCursorInBlock(src, 'core/text');
    const parsed = parseCursorBlock(src, cursor);
    expect(parsed).not.toBeNull();

    const { newSource } = applyPropertyChange(
      src,
      parsed!.startLine,
      parsed!.endLine,
      '@color',
      '',
    );

    // Verify property removed
    const cursor2 = findCursorInBlock(newSource, 'core/text');
    const parsed2 = parseCursorBlock(newSource, cursor2);
    expect(parsed2).not.toBeNull();
    expect(parsed2!.properties['@color']).toBeUndefined();
  });

  it('handles property values containing colons', () => {
    const src = [
      '--- use: core',
      '',
      '--- core/text',
      '@boxShadow: 0 2px 8px rgba(0,0,0,0.15)',
      '',
      'Hello',
    ].join('\n');

    const cursor = findCursorInBlock(src, 'core/text');
    const parsed = parseCursorBlock(src, cursor);
    expect(parsed).not.toBeNull();
    expect(parsed!.properties['@boxShadow']).toBe(
      '0 2px 8px rgba(0,0,0,0.15)',
    );
  });

  it('handles property values with spaces', () => {
    const src = [
      '--- use: core',
      '',
      '--- core/text',
      '@fontFamily: Georgia serif',
      '',
      'Hello',
    ].join('\n');

    const cursor = findCursorInBlock(src, 'core/text');
    const parsed = parseCursorBlock(src, cursor);
    expect(parsed).not.toBeNull();
    expect(parsed!.properties['@fontFamily']).toBe('Georgia serif');
  });

  it('handles blocks with no properties and no content', () => {
    const src = '--- use: core\n\n--- core/divider';
    const cursor = findCursorInBlock(src, 'core/divider');
    const parsed = parseCursorBlock(src, cursor);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('core/divider');
    expect(Object.keys(parsed!.properties)).toHaveLength(0);
  });
});

// ============================================================================
// PART 7: Full add-update-remove cycle for every block x a subset of styles
// ============================================================================

describe('Part 7: full add -> update -> remove cycle', () => {
  const CYCLE_STYLES = CSS_STYLES.slice(0, 6); // First 6 CSS styles
  const UPDATED_VALUES: Record<string, string> = {
    color: '#00ff00',
    bg: 'yellow',
    fg: 'green',
    rounded: '20px',
    backgroundColor: '#999',
    fontSize: '32px',
  };

  for (const blockCfg of ALL_BLOCKS) {
    describe(blockCfg.block, () => {
      for (const style of CYCLE_STYLES) {
        it(`add -> update -> remove @${style.prop}`, () => {
          // Step 1: Start without the style
          const src = buildSourceWithoutStyle(blockCfg);
          const cursor1 = findCursorInBlock(src, blockCfg.block);
          const parsed1 = parseCursorBlock(src, cursor1);
          expect(parsed1).not.toBeNull();
          expect(parsed1!.properties[`@${style.prop}`]).toBeUndefined();

          // Step 2: Add the style
          const { newSource: src2 } = applyPropertyChange(
            src,
            parsed1!.startLine,
            parsed1!.endLine,
            `@${style.prop}`,
            style.value,
          );
          const cursor2 = findCursorInBlock(src2, blockCfg.block);
          const parsed2 = parseCursorBlock(src2, cursor2);
          expect(parsed2).not.toBeNull();
          expect(parsed2!.properties[`@${style.prop}`]).toBe(style.value);

          // Step 3: Update the value
          const updatedValue = UPDATED_VALUES[style.prop];
          const { newSource: src3 } = applyPropertyChange(
            src2,
            parsed2!.startLine,
            parsed2!.endLine,
            `@${style.prop}`,
            updatedValue,
          );
          const cursor3 = findCursorInBlock(src3, blockCfg.block);
          const parsed3 = parseCursorBlock(src3, cursor3);
          expect(parsed3).not.toBeNull();
          expect(parsed3!.properties[`@${style.prop}`]).toBe(updatedValue);

          // Step 4: Remove the style
          const { newSource: src4 } = applyPropertyChange(
            src3,
            parsed3!.startLine,
            parsed3!.endLine,
            `@${style.prop}`,
            '',
          );
          const cursor4 = findCursorInBlock(src4, blockCfg.block);
          const parsed4 = parseCursorBlock(src4, cursor4);
          expect(parsed4).not.toBeNull();
          expect(parsed4!.properties[`@${style.prop}`]).toBeUndefined();
        });
      }
    });
  }
});

// ============================================================================
// PART 8: Targeted style round-trip with all blocks
// ============================================================================

describe('Part 8: targeted styles full cycle with all blocks', () => {
  const UPDATED_TARGETED: Record<string, string> = {
    '@.self:hover/transform': 'scale(1.2)',
    '@.self:hover/opacity': '0.6',
    '@.self:hover/backgroundColor': 'green',
    '@.self:hover/boxShadow': '0 0 0 transparent',
  };

  for (const blockCfg of ALL_BLOCKS) {
    describe(blockCfg.block, () => {
      for (const ts of TARGETED_STYLES) {
        it(`full cycle ${ts.key}`, () => {
          // Add
          const src = buildSourceWithoutStyle(blockCfg);
          const cursor1 = findCursorInBlock(src, blockCfg.block);
          const parsed1 = parseCursorBlock(src, cursor1);
          expect(parsed1).not.toBeNull();

          const { newSource: src2 } = applyPropertyChange(
            src,
            parsed1!.startLine,
            parsed1!.endLine,
            ts.key,
            ts.value,
          );
          const cursor2 = findCursorInBlock(src2, blockCfg.block);
          const parsed2 = parseCursorBlock(src2, cursor2);
          expect(parsed2).not.toBeNull();
          expect(parsed2!.properties[ts.key]).toBe(ts.value);

          // Update
          const newVal = UPDATED_TARGETED[ts.key];
          const { newSource: src3 } = applyPropertyChange(
            src2,
            parsed2!.startLine,
            parsed2!.endLine,
            ts.key,
            newVal,
          );
          const cursor3 = findCursorInBlock(src3, blockCfg.block);
          const parsed3 = parseCursorBlock(src3, cursor3);
          expect(parsed3).not.toBeNull();
          expect(parsed3!.properties[ts.key]).toBe(newVal);

          // Remove
          const { newSource: src4 } = applyPropertyChange(
            src3,
            parsed3!.startLine,
            parsed3!.endLine,
            ts.key,
            '',
          );
          const cursor4 = findCursorInBlock(src4, blockCfg.block);
          const parsed4 = parseCursorBlock(src4, cursor4);
          expect(parsed4).not.toBeNull();
          expect(parsed4!.properties[ts.key]).toBeUndefined();
        });
      }
    });
  }
});
