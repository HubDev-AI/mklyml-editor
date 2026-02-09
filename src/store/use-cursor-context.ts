import { useMemo, useRef } from 'react';
import { useEditorStore } from './editor-store';

export interface CursorBlock {
  type: string;
  startLine: number;
  endLine: number;
  properties: Record<string, string>;
  isSpecial?: boolean;
  label?: string;
}

function cursorBlocksEqual(a: CursorBlock | null, b: CursorBlock | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type || a.startLine !== b.startLine || a.endLine !== b.endLine || a.isSpecial !== b.isSpecial || a.label !== b.label) return false;
  const aKeys = Object.keys(a.properties);
  const bKeys = Object.keys(b.properties);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a.properties[k] !== b.properties[k]) return false;
  }
  return true;
}

export function useCursorContext(): CursorBlock | null {
  const source = useEditorStore((s) => s.source);
  const cursorLine = useEditorStore((s) => s.cursorLine);
  const prevRef = useRef<CursorBlock | null>(null);

  return useMemo(() => {
    const lines = source.split('\n');
    let blockType: string | null = null;
    let blockStart = -1;
    let blockEnd = lines.length;

    let isSpecial = false;
    let blockLabel: string | undefined;

    for (let i = Math.min(cursorLine - 1, lines.length - 1); i >= 0; i--) {
      const line = lines[i].trim();
      const match = line.match(/^---\s+([\w]+(?:\/[\w]+)?)(?::\s*(.+))?(?:\s+"([^"]*)")?/);
      if (match) {
        const type = match[1];
        if (type === 'style') {
          prevRef.current = null;
          return null;
        }
        if (type === 'use' || type === 'meta' || type === 'theme') {
          isSpecial = true;
          blockLabel = match[2]?.trim();
        }
        blockType = type;
        blockStart = i + 1;
        break;
      }
    }

    if (!blockType || blockStart === -1) {
      prevRef.current = null;
      return null;
    }

    for (let i = cursorLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^---\s+[\w/]/)) {
        blockEnd = i;
        break;
      }
    }

    const properties: Record<string, string> = {};
    for (let i = blockStart; i < blockEnd; i++) {
      const line = lines[i];
      const propMatch = line.match(/^(@?[\w./-]+):\s*(.*)$/);
      if (propMatch) {
        properties[propMatch[1]] = propMatch[2];
      }
    }

    const next: CursorBlock = {
      type: blockType,
      startLine: blockStart + 1,
      endLine: blockEnd + 1,
      properties,
      isSpecial,
      label: blockLabel,
    };

    if (cursorBlocksEqual(prevRef.current, next)) {
      return prevRef.current;
    }

    prevRef.current = next;
    return next;
  }, [source, cursorLine]);
}
