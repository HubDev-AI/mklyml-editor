import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CORE_BLOCKS,
  DEFAULT_SELF_SECTORS,
  HOVER_SECTOR,
  TARGET_SECTORS,
  resolveStyleSectors,
  type BlockDefinition,
} from '../../mkly/src/index.ts';
import { NEWSLETTER_BLOCKS } from '../../mkly-kits/newsletter/src/index.ts';
import { DOCS_BLOCKS } from '../../mkly-kits/docs/src/index.ts';

type ScopeKind = 'self' | 'self:hover' | 'target';

interface ScopeRow {
  blockType: string;
  scope: string;
  kind: ScopeKind;
  props: string[];
  unsupportedHints: string[];
  source: 'hints' | 'tag-profile' | 'fallback';
}

interface ProfileDef {
  name: string;
  props: string[];
}

const SELF_PROPS = uniq(DEFAULT_SELF_SECTORS.flatMap((sector) => sector.properties.map((p) => p.name)));
const TARGET_PROPS = uniq(TARGET_SECTORS.flatMap((sector) => sector.properties.map((p) => p.name)));
const HOVER_PROPS = uniq(HOVER_SECTOR.properties.map((p) => p.name));

const ALL_BLOCKS: Array<{ kit: string; blocks: BlockDefinition[] }> = [
  { kit: 'core', blocks: CORE_BLOCKS },
  { kit: 'newsletter', blocks: NEWSLETTER_BLOCKS },
  { kit: 'docs', blocks: DOCS_BLOCKS },
];

const TAG_PROFILE_MAP: Array<{ tag: string; profile: string; reason: string }> = [
  { tag: 'p', profile: 'textFlow', reason: 'Most inline copy edits happen on paragraphs.' },
  { tag: 'li', profile: 'textFlow', reason: 'List items are text-heavy and need typography + spacing only.' },
  { tag: 'blockquote', profile: 'textFlow', reason: 'Quote text should keep typography-focused controls.' },
  { tag: 'span', profile: 'inlineText', reason: 'Inline elements should avoid layout/sizing clutter.' },
  { tag: 'strong', profile: 'inlineText', reason: 'Inline emphasis should expose typography only.' },
  { tag: 'em', profile: 'inlineText', reason: 'Inline emphasis should expose typography only.' },
  { tag: 'h1-h6', profile: 'headingText', reason: 'Headings need typography + spacing + optional background accents.' },
  { tag: 'a', profile: 'linkText', reason: 'Links need color/typography/spacing, not generic box controls.' },
  { tag: 'img', profile: 'mediaImage', reason: 'Images need sizing/radius/shadow/object-fit controls.' },
  { tag: 'code', profile: 'inlineCode', reason: 'Code spans need mono font, color, background, padding, radius.' },
  { tag: 'pre', profile: 'codeBlock', reason: 'Code blocks need overflow + spacing + border/background controls.' },
  { tag: 'hr', profile: 'dividerLine', reason: 'Dividers need width/height/color/margin/opacity only.' },
];

const TAG_PROFILES: ProfileDef[] = [
  {
    name: 'textFlow',
    props: ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'text-align', 'margin', 'padding', 'background', 'border-radius', 'opacity'],
  },
  {
    name: 'inlineText',
    props: ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'background'],
  },
  {
    name: 'headingText',
    props: ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'text-align', 'margin', 'padding', 'background', 'border-radius', 'border-width', 'border-style', 'border-color', 'opacity'],
  },
  {
    name: 'linkText',
    props: ['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'padding', 'margin', 'background', 'border-radius', 'border-width', 'border-style', 'border-color', 'opacity'],
  },
  {
    name: 'mediaImage',
    props: ['width', 'max-width', 'height', 'margin', 'padding', 'border-radius', 'border-width', 'border-style', 'border-color', 'opacity', 'box-shadow', 'aspect-ratio', 'object-fit'],
  },
  {
    name: 'inlineCode',
    props: ['color', 'font-family', 'font-size', 'font-weight', 'background', 'padding', 'border-radius', 'opacity'],
  },
  {
    name: 'codeBlock',
    props: ['color', 'font-family', 'font-size', 'line-height', 'background', 'padding', 'margin', 'border-radius', 'border-width', 'border-style', 'border-color', 'overflow', 'opacity', 'box-shadow'],
  },
  {
    name: 'dividerLine',
    props: ['width', 'max-width', 'height', 'background', 'margin', 'opacity'],
  },
];

const GLOBAL_CONTROLS = [
  { key: 'text', cssVar: '--mkly-text', type: 'color', note: 'Global text color for document body and inherited text.' },
  { key: 'muted', cssVar: '--mkly-muted', type: 'color', note: 'Secondary text color for metadata and subtle copy.' },
  { key: 'bg', cssVar: '--mkly-bg', type: 'color', note: 'Document background color token.' },
  { key: 'bgSubtle', cssVar: '--mkly-bg-subtle', type: 'color', note: 'Soft background surfaces (cards/sections/code).' },
  { key: 'border', cssVar: '--mkly-border', type: 'color', note: 'Default border color token.' },
  { key: 'accent', cssVar: '--mkly-accent', type: 'color', note: 'Primary accent token used by links/buttons/badges.' },
  { key: 'accentHover', cssVar: '--mkly-accent-hover', type: 'color', note: 'Hover-state accent token.' },
  { key: 'textAlign', cssVar: '--mkly-text-align', type: 'select', note: 'Global default text alignment token.' },
  { key: 'fontSize', cssVar: '--mkly-font-size', type: 'length', note: 'Global base font size token.' },
  { key: 'lineHeight', cssVar: '--mkly-line-height', type: 'number', note: 'Global base line-height token.' },
  { key: 'fontBody', cssVar: '--mkly-font-body', type: 'font', note: 'Default body font family.' },
  { key: 'fontHeading', cssVar: '--mkly-font-heading', type: 'font', note: 'Heading font family.' },
  { key: 'fontMono', cssVar: '--mkly-font-mono', type: 'font', note: 'Code/monospace font family.' },
  { key: 'radius', cssVar: '--mkly-radius', type: 'length', note: 'Default corner radius token.' },
  { key: 'spacing', cssVar: '--mkly-spacing', type: 'length', note: 'Base spacing token for kits/themes.' },
  { key: 'gapScale', cssVar: '--mkly-gap-scale', type: 'range', note: 'Already present: global spacing multiplier between blocks.' },
  { key: 'lineHeightScale', cssVar: '--mkly-line-height-scale', type: 'range', note: 'Already present: global body line-height multiplier.' },
];

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

function getRawProps(kind: ScopeKind): string[] {
  if (kind === 'self') return SELF_PROPS;
  if (kind === 'self:hover') return HOVER_PROPS;
  return TARGET_PROPS;
}

function resolveScope(
  blockType: string,
  kind: ScopeKind,
  scope: string,
  styleHints?: Record<string, string[]>,
): ScopeRow {
  const raw = getRawProps(kind);
  const resolved = resolveStyleSectors({
    target: scope,
    styleHints,
  });
  const source = resolved.source === 'default'
    ? 'fallback'
    : resolved.source === 'tag-profile'
      ? 'tag-profile'
      : 'hints';
  const unsupportedHints = resolved.unsupportedHintProps;
  const props = uniq(resolved.sectors.flatMap((sector) => sector.properties.map((prop) => prop.name)))
    .filter((prop) => raw.includes(prop));

  return {
    blockType,
    scope,
    kind,
    props,
    unsupportedHints,
    source,
  };
}

function collectRows(): ScopeRow[] {
  const rows: ScopeRow[] = [];
  for (const { kit, blocks } of ALL_BLOCKS) {
    for (const block of blocks) {
      const blockType = `${kit}/${block.name}`;
      rows.push(resolveScope(blockType, 'self', 'self', block.styleHints));
      rows.push(resolveScope(blockType, 'self:hover', 'self:hover', block.styleHints));

      const targets = block.targets ? Object.keys(block.targets) : [];
      for (const target of targets) {
        rows.push(resolveScope(blockType, 'target', target, block.styleHints));
      }
    }
  }
  return rows;
}

function renderHeader(rows: ScopeRow[]): string {
  const blockCount = uniq(rows.map((row) => row.blockType)).length;
  const targetCount = rows.filter((row) => row.kind === 'target').length;
  const unsupported = rows.filter((row) => row.unsupportedHints.length > 0);
  const hoverRows = rows.filter((row) => row.kind === 'self:hover');
  const hoverPatterns = new Map<string, number>();
  for (const row of hoverRows) {
    const key = row.props.join(', ') || '(none)';
    hoverPatterns.set(key, (hoverPatterns.get(key) ?? 0) + 1);
  }

  const unsupportedLines = unsupported.length > 0
    ? unsupported
      .map((row) => `- \`${row.blockType}\` \`${row.scope}\`: ${row.unsupportedHints.map((prop) => `\`${prop}\``).join(', ')}`)
      .join('\n')
    : '- None';

  const hoverPatternLines = [...hoverPatterns.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pattern, count]) => `- ${count} blocks: ${pattern}`)
    .join('\n');

  return `# Style Surface Matrix (Phase 1 Audit)

Generated by \`scripts/generate-style-surface-matrix.ts\`.

## Scope

- Blocks audited: **${blockCount}**
- Target scopes audited: **${targetCount}**
- Total scope rows (self + hover + targets): **${rows.length}**

## Current Behavior Notes

- Style controls in popup and right pane are rendered by the same component: \`src/inspector/StyleEditor.tsx\`.
- Scope resolution rule:
  - \`self\` uses \`DEFAULT_SELF_SECTORS\`.
  - \`self:hover\` uses \`HOVER_SECTOR\` filtered by \`styleHints['self:hover'] ?? styleHints['self']\`.
  - target scopes use \`TARGET_SECTORS\` filtered by \`styleHints[target] ?? styleHints['self']\`.
  - tag targets (\`>p\`, \`>li\`, etc.) use \`styleHints['>']\` only when present; otherwise they fall back to unfiltered target sectors.

## Mismatches Found (Hints vs Supported Controls)

${unsupportedLines}

## Hover Effective-Surface Distribution

${hoverPatternLines}

## Approved Plan (with Global Controls)

1. Stabilize source of truth in core:
   - Add a resolver API that returns effective controls for \`self\`, \`hover\`, named targets, and tag targets.
   - Remove pane-local filtering differences and route both popup/right-pane through that resolver.
2. Normalize property catalog:
   - Expand schema to include currently-hinted but unsupported properties (\`grid-template-columns\`, \`align-items\`, \`aspect-ratio\`, \`object-fit\`, \`overflow\` target usage).
   - Add deterministic ordering and optional advanced/basic visibility tiers.
3. Add **Global** section in right pane (no block selected):
   - Expose meaningful document-level tokens (table below) from \`--- style\`.
   - Keep existing \`gapScale\` and \`lineHeightScale\` there and make them part of one global controls group.
4. Add keyboard-first input UX:
   - Numeric fields support arrow increment/decrement with unit-aware stepping.
   - Font selectors support arrow cycling without opening the browser dropdown.
5. Ship contract tests:
   - Same target => same controls in popup and right pane.
   - Tag-target profile mapping is deterministic.
   - Global controls round-trip correctly in \`--- style\`.

## Global Right-Pane Controls (Proposed)

Context: shown when no block/element is selected, together with Theme/Preset controls.

| Key | CSS Variable | Control Type | Purpose |
|---|---|---|---|
${GLOBAL_CONTROLS.map((item) => `| \`${item.key}\` | \`${item.cssVar}\` | ${item.type} | ${item.note} |`).join('\n')}

## HTML Tag Profiles (Proposed)

### Tag to Profile Mapping

| Tag | Profile | Why |
|---|---|---|
${TAG_PROFILE_MAP.map((item) => `| \`${item.tag}\` | \`${item.profile}\` | ${item.reason} |`).join('\n')}

### Profile Property Sets

| Profile | Properties |
|---|---|
${TAG_PROFILES.map((profile) => `| \`${profile.name}\` | ${profile.props.map((prop) => `\`${prop}\``).join(', ')} |`).join('\n')}
`;
}

function renderMatrix(rows: ScopeRow[]): string {
  const sorted = [...rows].sort((a, b) => {
    if (a.blockType === b.blockType) {
      const rank = (row: ScopeRow) => row.kind === 'self' ? 0 : row.kind === 'self:hover' ? 1 : 2;
      const kindDelta = rank(a) - rank(b);
      if (kindDelta !== 0) return kindDelta;
      return a.scope.localeCompare(b.scope);
    }
    return a.blockType.localeCompare(b.blockType);
  });

  const lines = sorted.map((row) => {
    const props = row.props.length > 0 ? row.props.map((prop) => `\`${prop}\``).join(', ') : '(none)';
    const unsupported = row.unsupportedHints.length > 0
      ? row.unsupportedHints.map((prop) => `\`${prop}\``).join(', ')
      : '';
    return `| \`${row.blockType}\` | \`${row.scope}\` | ${row.props.length} | ${row.source} | ${props} | ${unsupported} |`;
  });

  return `\n## Current Editable Matrix\n\n| Block | Scope | Count | Source | Editable Properties | Unsupported Hint Keys |\n|---|---|---:|---|---|---|\n${lines.join('\n')}\n`;
}

function renderReferences(): string {
  return `
## External UX References

- Webflow style panel: context-based controls grouped by layout/typography/spacing and shown per selected element.
  - https://help.webflow.com/hc/en-us/articles/33961321037139-Style-panel-overview
- Framer property controls: conditional visibility for controls based on context.
  - https://www.framer.com/developers/property-controls
- WordPress Gutenberg block supports: explicit per-block style capability contract.
  - https://developer.wordpress.org/block-editor/reference-guides/block-api/block-supports/
- Figma properties panel: selection-contextual control surface instead of exposing all options.
  - https://help.figma.com/hc/en-us/articles/360040514413-Properties-panel
- MDN numeric step behavior for inputs (arrow increment/decrement expectations).
  - https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/step
- WAI ARIA combobox keyboard pattern (for keyboard-first font selection).
  - https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
`;
}

function main(): void {
  const rows = collectRows();
  const content = `${renderHeader(rows)}${renderMatrix(rows)}${renderReferences()}\n`;
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(scriptDir, '../docs/style-surface-matrix.md');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main();
