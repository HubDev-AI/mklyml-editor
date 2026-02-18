import {
  mergeRule,
  removeRule,
  serializeStyleGraph,
  parseStyleGraph,
  emptyStyleGraph,
  getStyleValue,
} from '@mklyml/core';
import type { StyleGraph } from '@mklyml/core';

/**
 * Property regex: matches mkly property lines like `key: value`.
 */
export const PROPERTY_RE = /^([\w./:+-]+):\s(.*)$/;
export const PROPERTY_KEY_RE = /^([\w./:+-]+):\s/;

export interface PropertyChangeResult {
  newSource: string;
}

/**
 * Apply a non-style property change to a block in the source.
 * Handles block properties like title, url, level, etc.
 */
export function applyPropertyChange(
  source: string,
  blockStartLine: number,
  blockEndLine: number,
  key: string,
  value: string,
): PropertyChangeResult {
  const lines = source.split('\n');
  const blockStart = blockStartLine - 1;
  const blockEnd = blockEndLine - 1;
  let found = false;

  for (let i = blockStart; i < blockEnd && i < lines.length; i++) {
    const match = lines[i].match(PROPERTY_KEY_RE);
    if (match && match[1] === key) {
      if (value === '') {
        lines.splice(i, 1);
      } else {
        lines[i] = `${key}: ${value}`;
      }
      found = true;
      break;
    }
  }

  if (!found && value !== '') {
    let insertAt = blockStart;
    for (let i = blockStart; i < blockEnd && i < lines.length; i++) {
      if (lines[i].match(PROPERTY_KEY_RE)) {
        insertAt = i + 1;
      } else {
        break;
      }
    }
    lines.splice(insertAt, 0, `${key}: ${value}`);
    const nextIdx = insertAt + 1;
    if (nextIdx < lines.length && lines[nextIdx].trim() !== '' && !lines[nextIdx].match(PROPERTY_KEY_RE)) {
      lines.splice(nextIdx, 0, '');
    }
  }

  return { newSource: lines.join('\n') };
}

/**
 * Apply a style change via the StyleGraph.
 * Mutates the StyleGraph, serializes it, and patches the --- style block in the source.
 * Auto-inserts a --- style block if none exists.
 */
export function applyStyleChange(
  source: string,
  styleGraph: StyleGraph | null,
  blockType: string,
  target: string,
  prop: string,
  value: string,
  label?: string,
): PropertyChangeResult & { newGraph: StyleGraph; lineDelta: number; lineShiftFrom: number } {
  let graph = styleGraph ?? emptyStyleGraph();

  // Auto-inject border-style: solid when border-width is set without an existing border-style.
  // CSS defaults border-style to 'none', making borders invisible even with width/color set.
  if (prop === 'border-width' && value !== '') {
    const existingStyle = getStyleValue(graph, blockType, target, 'border-style', label);
    if (!existingStyle || existingStyle === 'none') {
      graph = mergeRule(graph, blockType, target, 'border-style', 'solid', label);
    }
  }

  // Mutate the graph
  const newGraph = value === ''
    ? removeRule(graph, blockType, target, prop, label)
    : mergeRule(graph, blockType, target, prop, value, label);

  // Serialize to mkly style syntax
  const serialized = serializeStyleGraph(newGraph);

  // Patch the --- style block in source
  const { result: newSource, lineDelta, lineShiftFrom } = patchStyleBlock(source, serialized);

  return { newSource, newGraph, lineDelta, lineShiftFrom };
}

/**
 * Adjust a source line after patchStyleBlock.
 * Only lines at/after `lineShiftFrom` are affected by lineDelta.
 */
export function adjustLineForStylePatch(line: number, lineDelta: number, lineShiftFrom: number): number {
  return line >= lineShiftFrom ? line + lineDelta : line;
}

/**
 * Find and replace the --- style block content in source.
 * If no --- style block exists, insert one after preamble directives.
 * Returns the new source and the number of lines added/removed (lineDelta).
 */
function patchStyleBlock(source: string, newContent: string): { result: string; lineDelta: number; lineShiftFrom: number } {
  const lines = source.split('\n');
  const oldLineCount = lines.length;

  // Find existing --- style block
  let styleStart = -1;
  let styleEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '--- style') {
      styleStart = i;
      // Find the end: next --- block or end of file
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().match(/^---\s+[\w/]/)) {
          styleEnd = j;
          break;
        }
      }
      if (styleEnd === -1) styleEnd = lines.length;
      break;
    }
  }

  if (styleStart !== -1) {
    // Replace existing style block content (keep the --- style header)
    const before = lines.slice(0, styleStart + 1);
    const after = lines.slice(styleEnd);

    // Add blank line between content and next block if needed
    const needsTrailingBlank = after.length > 0 && after[0].trim() !== '';
    const contentLines = newContent ? ['', ...newContent.split('\n'), ''] : [''];

    const resultLines = [...before, ...contentLines, ...(needsTrailingBlank ? [''] : []), ...after];
    return {
      result: resultLines.join('\n'),
      lineDelta: resultLines.length - oldLineCount,
      lineShiftFrom: styleEnd + 1, // 1-based line number of first line after old style block
    };
  }

  // No --- style block found — insert after preamble (canonical order: style comes after meta)
  let insertAfter = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.match(/^---\s+(use|define-theme|define-preset|theme|preset)\b/)) {
      insertAfter = i;
    } else if (trimmed.match(/^---\s+meta\b/)) {
      // Meta is a block — skip past its properties
      insertAfter = i;
      for (let j = i + 1; j < lines.length; j++) {
        const jTrimmed = lines[j].trim();
        if (jTrimmed === '' || jTrimmed.startsWith('---')) break;
        insertAfter = j;
      }
    } else if (trimmed.match(/^---\s+[\w/]/) && insertAfter !== -1) {
      break;
    }
  }

  const styleBlock = newContent
    ? `\n--- style\n${newContent}\n`
    : '\n--- style\n';

  if (insertAfter !== -1) {
    const before = lines.slice(0, insertAfter + 1);
    const after = lines.slice(insertAfter + 1);
    const result = [...before, styleBlock, ...after].join('\n');
    return {
      result,
      lineDelta: result.split('\n').length - oldLineCount,
      lineShiftFrom: insertAfter + 2, // insertion is after insertAfter (0-based)
    };
  }

  // No preamble found — insert at the very beginning
  const result = styleBlock + '\n' + source;
  return { result, lineDelta: result.split('\n').length - oldLineCount, lineShiftFrom: 1 };
}

/**
 * Parse just the user-layer StyleGraph from the source text.
 * Useful for reading current style state without a full compile.
 */
export function parseSourceStyleGraph(source: string): StyleGraph {
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '--- style') {
      const contentLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().match(/^---\s+[\w/]/)) break;
        contentLines.push(lines[j]);
      }
      return parseStyleGraph(contentLines.join('\n'));
    }
  }

  return emptyStyleGraph();
}
