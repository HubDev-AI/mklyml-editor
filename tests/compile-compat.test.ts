import { describe, expect, it } from 'bun:test';
import { applyCompileCompat } from '../src/store/compile-compat';
import { parseStyleGraphCompat, serializeStyleGraphCompat } from '../src/store/style-graph-compat';

describe('style graph compat', () => {
  it('parses and serializes descendant targets without corruption', () => {
    const src = [
      'newsletter/tipOfTheDay:s1',
      '  >.s2',
      '    color: #e2725b',
    ].join('\n');

    const parsed = parseStyleGraphCompat(src);
    expect(parsed.rules).toHaveLength(1);
    expect(parsed.rules[0].target).toBe('>.s2');
    expect(parsed.rules[0].label).toBe('s1');

    const serialized = serializeStyleGraphCompat(parsed);
    expect(serialized).toContain('  >.s2');
    expect(serialized).not.toContain('.>.s2');
  });
});

describe('compile compat html patch', () => {
  it('adds line classes and strips trailing {.sN} markers in rendered html', () => {
    const source = [
      '--- core/text',
      '- Item one {.s1}',
      '- Item two',
      '',
      '--- style',
      'core/text',
      '  >.s1',
      '    color: #f00',
    ].join('\n');

    const html = [
      '<html><head></head><body>',
      '<div class="mkly-core-text" data-mkly-line="1">',
      '<ul>',
      '<li data-mkly-line="2">Item one {.s1}</li>',
      '<li data-mkly-line="3">Item two</li>',
      '</ul>',
      '</div>',
      '</body></html>',
    ].join('');

    const graph = parseStyleGraphCompat('core/text\n  >.s1\n    color: #f00');
    const patched = applyCompileCompat(source, html, graph);

    expect(patched).toContain('<li data-mkly-line="2" class="s1">Item one</li>');
    expect(patched).not.toContain('Item one {.s1}');
    expect(patched).toContain('.mkly-core-text .s1');
  });

  it('scopes descendant css to labeled block selectors', () => {
    const graph = parseStyleGraphCompat('newsletter/tipOfTheDay:s1\n  >.s2\n    color: #e2725b');
    const patched = applyCompileCompat('', '<html><head></head><body></body></html>', graph);
    expect(patched).toContain('.mkly-newsletter-tipOfTheDay--s1 .s2');
  });
});
