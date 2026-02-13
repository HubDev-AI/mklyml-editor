/**
 * Property regex: matches mkly property lines like `key: value` or `@key: value`.
 * Includes `:` in the key character class so targeted pseudo-selectors like
 * `@.self:hover/transform` are captured as a single key (the separator is always `: `).
 */
export const PROPERTY_RE = /^(@?[\w./:+-]+):\s(.*)$/;
export const PROPERTY_KEY_RE = /^(@?[\w./:+-]+):\s/;

export interface PropertyChangeResult {
  newSource: string;
}

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
