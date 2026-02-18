import type { StyleGraph } from '@mklyml/core';

const COMMENT_RE = /^\s*\/\//;
const PROP_RE = /^([\w-]+)\s*:\s*(.+)$/;
const BLOCK_SELECTOR_RE = /^[\w-]+(?:\/[\w-]+)+$/;
const SUB_ELEMENT_RE = /^\.([\w][\w-]*)$/;
const PSEUDO_RE = /^(::?\w[\w-]*)$/;
const SUB_PSEUDO_RE = /^\.([\w][\w-]*)(::?\w[\w-]*)$/;
const DESCENDANT_RE = /^>(.+)$/;
const LABEL_SELECTOR_RE = /^([\w-]+(?:\/[\w-]+)+):([\w-]+)$/;

function toKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function cssPropertyName(key: string): string {
  if (key.includes('-')) return key;
  return toKebab(key);
}

function getIndent(line: string): number {
  let count = 0;
  for (const ch of line) {
    if (ch === ' ') count++;
    else if (ch === '\t') count += 2;
    else break;
  }
  return count;
}

function decomposeSelector(selector: string): { blockType: string; target: string; label?: string } {
  const dotIdx = selector.indexOf('.');
  const colonIdx = selector.indexOf(':');

  if (dotIdx !== -1) {
    const block = selector.slice(0, dotIdx);
    const sub = selector.slice(dotIdx + 1);
    const labelMatch = block.match(LABEL_SELECTOR_RE);
    if (labelMatch) {
      return { blockType: labelMatch[1], target: sub === 'self' ? 'self' : sub, label: labelMatch[2] };
    }
    return { blockType: block, target: sub === 'self' ? 'self' : sub };
  }

  if (colonIdx !== -1) {
    const block = selector.slice(0, colonIdx);
    const rest = selector.slice(colonIdx + 1);
    // blockType:label form
    if (/^[\w-]+$/.test(rest) && block.includes('/')) {
      return { blockType: block, target: 'self', label: rest };
    }
    // self pseudo
    return { blockType: block, target: `self${selector.slice(colonIdx)}` };
  }

  return { blockType: selector, target: 'self' };
}

export function parseStyleGraphCompat(source: string): StyleGraph {
  if (!source.trim()) return { variables: [], rules: [] };

  const lines = source.split('\n');
  const variables: StyleGraph['variables'] = [];
  const rules: StyleGraph['rules'] = [];

  let currentBlock: string | null = null;
  let currentTarget = 'self';
  let currentLabel: string | undefined;
  let currentProps: Record<string, string> = {};
  let isRawContext = false;

  function flushRule() {
    if (currentBlock && Object.keys(currentProps).length > 0) {
      const rule: StyleGraph['rules'][number] = {
        blockType: currentBlock,
        target: currentTarget,
        properties: { ...currentProps },
      };
      if (currentLabel) rule.label = currentLabel;
      rules.push(rule);
    }
    currentProps = {};
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || COMMENT_RE.test(trimmed)) continue;

    const indent = getIndent(line);
    if (indent === 0) {
      flushRule();
      currentTarget = 'self';
      isRawContext = false;

      const varMatch = trimmed.match(/^([\w-]+)\s*:\s+(.+)$/);
      if (varMatch) {
        variables.push({ name: varMatch[1], value: varMatch[2].trim() });
        currentBlock = null;
        currentLabel = undefined;
        continue;
      }

      const labelMatch = trimmed.match(LABEL_SELECTOR_RE);
      if (labelMatch) {
        currentBlock = labelMatch[1];
        currentLabel = labelMatch[2];
        currentTarget = 'self';
        continue;
      }

      if (BLOCK_SELECTOR_RE.test(trimmed)) {
        currentBlock = trimmed;
        currentLabel = undefined;
        currentTarget = 'self';
        continue;
      }

      if (/^\w/.test(trimmed)) {
        const { blockType, target, label } = decomposeSelector(trimmed);
        if (blockType) {
          currentBlock = blockType;
          currentTarget = target;
          currentLabel = label;
          continue;
        }
      }

      // Unknown top-level selector is emitted as raw CSS.
      currentBlock = '__raw';
      currentTarget = trimmed;
      currentLabel = undefined;
      isRawContext = true;
      continue;
    }

    if (!currentBlock) {
      const varPropMatch = trimmed.match(PROP_RE);
      if (varPropMatch) {
        variables.push({ name: varPropMatch[1], value: varPropMatch[2].trim() });
      }
      continue;
    }

    if (isRawContext) {
      const rawPropMatch = trimmed.match(PROP_RE);
      if (rawPropMatch) {
        currentProps[cssPropertyName(rawPropMatch[1])] = rawPropMatch[2].trim();
      }
      continue;
    }

    const subPseudoMatch = trimmed.match(SUB_PSEUDO_RE);
    if (subPseudoMatch) {
      flushRule();
      currentTarget = `${subPseudoMatch[1]}${subPseudoMatch[2]}`;
      continue;
    }

    const subMatch = trimmed.match(SUB_ELEMENT_RE);
    if (subMatch) {
      flushRule();
      currentTarget = subMatch[1] === 'self' ? 'self' : subMatch[1];
      continue;
    }

    const pseudoMatch = trimmed.match(PSEUDO_RE);
    if (pseudoMatch) {
      flushRule();
      currentTarget = `self${pseudoMatch[1]}`;
      continue;
    }

    const descendantMatch = trimmed.match(DESCENDANT_RE);
    if (descendantMatch) {
      flushRule();
      currentTarget = `>${descendantMatch[1].trim()}`;
      continue;
    }

    const propMatch = trimmed.match(PROP_RE);
    if (propMatch) {
      currentProps[cssPropertyName(propMatch[1])] = propMatch[2].trim();
    }
  }

  flushRule();
  return { variables, rules };
}

function parseTarget(target: string): { sub: string | null; pseudo: string | null } {
  if (target === 'self') return { sub: null, pseudo: null };
  if (target.startsWith('self:')) {
    return { sub: null, pseudo: target.slice(4) };
  }
  const colonIdx = target.indexOf(':');
  if (colonIdx !== -1) {
    return { sub: target.slice(0, colonIdx), pseudo: target.slice(colonIdx) };
  }
  return { sub: target, pseudo: null };
}

export function serializeStyleGraphCompat(graph: StyleGraph): string {
  const lines: string[] = [];

  for (const v of graph.variables) {
    lines.push(`${v.name}: ${v.value}`);
  }

  const rawRules = graph.rules.filter((r) => r.blockType === '__raw');
  const blockRules = graph.rules.filter((r) => r.blockType !== '__raw');
  const grouped = new Map<string, StyleGraph['rules']>();

  for (const rule of blockRules) {
    const key = rule.label ? `${rule.blockType}:${rule.label}` : rule.blockType;
    const existing = grouped.get(key);
    if (existing) existing.push(rule);
    else grouped.set(key, [rule]);
  }

  for (const [selectorKey, rules] of grouped) {
    if (lines.length > 0) lines.push('');
    const selfRule = rules.find((r) => r.target === 'self');
    const otherRules = rules.filter((r) => r.target !== 'self');

    lines.push(selectorKey);

    if (selfRule) {
      for (const [prop, value] of Object.entries(selfRule.properties)) {
        lines.push(`  ${prop}: ${value}`);
      }
    }

    for (const rule of otherRules) {
      if (rule.target.startsWith('>')) {
        lines.push(`  ${rule.target}`);
        for (const [prop, value] of Object.entries(rule.properties)) {
          lines.push(`    ${prop}: ${value}`);
        }
        continue;
      }

      const { sub, pseudo } = parseTarget(rule.target);
      if (pseudo && !sub) {
        lines.push(`  ${pseudo}`);
      } else if (sub && !pseudo) {
        lines.push(`  .${sub}`);
      } else if (sub && pseudo) {
        lines.push(`  .${sub}${pseudo}`);
      }

      for (const [prop, value] of Object.entries(rule.properties)) {
        lines.push(`    ${prop}: ${value}`);
      }
    }
  }

  for (const rule of rawRules) {
    if (lines.length > 0) lines.push('');
    lines.push(rule.target);
    for (const [prop, value] of Object.entries(rule.properties)) {
      lines.push(`  ${prop}: ${value}`);
    }
  }

  return lines.join('\n');
}
