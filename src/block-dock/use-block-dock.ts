import { useState, useCallback, useMemo } from 'react';
import { getBlockDisplayName, type CompletionData, type BlockDocs } from '@milkly/mkly';
import { useEditorStore } from '../store/editor-store';

export interface BlockDockEntry {
  name: string;
  description: string;
  kit?: string;
  docs?: BlockDocs;
}

function parseImportedKits(source: string): Set<string> {
  const kits = new Set<string>();
  for (const line of source.split('\n')) {
    const match = line.match(/^---\s+use:\s*(.+)/);
    if (match) kits.add(match[1].trim());
  }
  return kits;
}

export function useBlockDock(completionData: CompletionData) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const source = useEditorStore((s) => s.source);

  const importedKits = useMemo(() => parseImportedKits(source), [source]);

  const allBlocks = useMemo((): BlockDockEntry[] => {
    const specials: BlockDockEntry[] = [
      { name: 'style', description: 'Style block' },
      { name: 'meta', description: 'Document metadata' },
      { name: 'use', description: 'Kit declaration' },
    ];

    const kitBlocks = completionData.blocks
      .filter((b) => {
        const kit = completionData.blockKits.get(b.label);
        return !kit || importedKits.has(kit);
      })
      .map((b) => ({
        name: b.label,
        description: b.description,
        kit: completionData.blockKits.get(b.label),
        docs: completionData.docs.get(b.label),
      }));

    return [...specials, ...kitBlocks];
  }, [completionData, importedKits]);

  const filtered = useMemo(() => {
    if (!query) return allBlocks;
    const q = query.toLowerCase();
    return allBlocks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        getBlockDisplayName(b.name, b.docs).toLowerCase().includes(q),
    );
  }, [allBlocks, query]);

  const moveSelection = useCallback(
    (direction: 'up' | 'down') => {
      setSelectedIndex((prev) => {
        if (direction === 'up') return Math.max(0, prev - 1);
        return Math.min(filtered.length - 1, prev + 1);
      });
    },
    [filtered.length],
  );

  const resetSearch = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
  }, []);

  return {
    query,
    setQuery: (q: string) => {
      setQuery(q);
      setSelectedIndex(0);
    },
    filtered,
    selectedIndex,
    setSelectedIndex,
    moveSelection,
    resetSearch,
    selectedBlock: filtered[selectedIndex] ?? null,
  };
}
