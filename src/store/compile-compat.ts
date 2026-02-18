import type { StyleGraph } from '@mklyml/core';

const LINE_CLASS_RE = /\s\{((?:\.[A-Za-z0-9_-]+\s*)+)\}\s*$/;
const TRAILING_LINE_CLASS_RE = /\s\{(?:\.[A-Za-z0-9_-]+\s*)+\}\s*$/;

const STYLE_ALIASES: Record<string, string> = {
  bg: 'background',
  fg: 'color',
  rounded: 'border-radius',
};

const VARIABLE_TO_CSS: Record<string, string> = {
  accent: '--mkly-accent',
  accentHover: '--mkly-accent-hover',
  bg: '--mkly-bg',
  text: '--mkly-text',
  muted: '--mkly-muted',
  border: '--mkly-border',
  fontBody: '--mkly-font-body',
  fontHeading: '--mkly-font-heading',
  fontMono: '--mkly-font-mono',
  radius: '--mkly-radius',
  spacing: '--mkly-spacing',
  bgSubtle: '--mkly-bg-subtle',
  gapScale: '--mkly-gap-scale',
};

function toKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function cssProperty(key: string): string {
  return STYLE_ALIASES[key] ?? (key.includes('-') ? key : toKebab(key));
}

function resolveVariableName(key: string): string {
  return VARIABLE_TO_CSS[key] ?? `--mkly-${toKebab(key)}`;
}

function resolveValue(value: string): string {
  return value
    .replace(/\$(\w+)/g, (_, name) => `var(${resolveVariableName(name)})`)
    .replace(/<\//gi, '<\\/');
}

function blockTypeToCssClass(blockType: string): string {
  return `mkly-${blockType.replace('/', '-')}`;
}

function resolveDescendantSelector(blockType: string, target: string, label?: string): string | null {
  if (!target.startsWith('>')) return null;
  const base = blockTypeToCssClass(blockType);
  const labelSuffix = label ? `--${label}` : '';
  const descendant = target.slice(1).trim();
  if (!descendant) return `.${base}${labelSuffix}`;
  return `.${base}${labelSuffix} ${descendant}`;
}

function extractLineClassMap(source: string): Map<number, string[]> {
  const map = new Map<number, string[]>();
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_CLASS_RE);
    if (!m) continue;
    const classes = m[1]
      .trim()
      .split(/\s+/)
      .map((part) => part.replace(/^\./, ''))
      .filter(Boolean);
    if (classes.length > 0) {
      map.set(i + 1, classes);
    }
  }
  return map;
}

function mergeClassAttribute(attrs: string, classesToAdd: string[]): string {
  const classMatch = attrs.match(/\bclass="([^"]*)"/);
  if (!classMatch) return `${attrs} class="${classesToAdd.join(' ')}"`;

  const existing = classMatch[1].split(/\s+/).filter(Boolean);
  for (const className of classesToAdd) {
    if (!existing.includes(className)) existing.push(className);
  }
  return attrs.replace(classMatch[0], `class="${existing.join(' ')}"`);
}

function applyLineClassesToHtml(html: string, source: string): string {
  const classMap = extractLineClassMap(source);
  if (classMap.size === 0) return html;

  let patched = html;
  for (const [line, classes] of classMap) {
    const openRe = new RegExp(`<([a-zA-Z][\\w:-]*)([^>]*\\sdata-mkly-line="${line}"[^>]*)>`, 'g');
    patched = patched.replace(openRe, (_full, tag: string, attrs: string) => {
      const nextAttrs = mergeClassAttribute(attrs, classes);
      return `<${tag}${nextAttrs}>`;
    });

    const lineElementRe = new RegExp(
      `(<([a-zA-Z][\\w:-]*)([^>]*\\sdata-mkly-line="${line}"[^>]*)>)([\\s\\S]*?)(<\\/\\2>)`,
      'g',
    );
    patched = patched.replace(lineElementRe, (_full, openTag: string, _tag: string, _attrs: string, inner: string, closeTag: string) => {
      const nextInner = inner.replace(TRAILING_LINE_CLASS_RE, '');
      return `${openTag}${nextInner}${closeTag}`;
    });
  }

  return patched;
}

function buildDescendantCss(graph: StyleGraph): string {
  const cssLines: string[] = [];
  for (const rule of graph.rules) {
    const selector = resolveDescendantSelector(rule.blockType, rule.target, rule.label);
    if (!selector) continue;

    const props = Object.entries(rule.properties)
      .map(([key, value]) => `  ${cssProperty(key)}: ${resolveValue(value)};`)
      .join('\n');
    if (!props) continue;

    cssLines.push(`${selector} {\n${props}\n}`);
  }
  return cssLines.join('\n');
}

function injectCompatCss(html: string, css: string): string {
  if (!css.trim()) return html;
  const tag = `<style data-mkly-compat="descendant-targets">\n${css}\n</style>`;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${tag}</head>`);
  }
  const bodyOpen = html.match(/<body[^>]*>/i)?.[0];
  if (bodyOpen) {
    return html.replace(bodyOpen, `${bodyOpen}${tag}`);
  }
  return `${tag}${html}`;
}

export function applyCompileCompat(source: string, html: string, styleGraph: StyleGraph): string {
  const withLineClasses = applyLineClassesToHtml(html, source);
  const descendantCss = buildDescendantCss(styleGraph);
  return injectCompatCss(withLineClasses, descendantCss);
}
