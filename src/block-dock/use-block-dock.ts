import { useState, useCallback, useMemo } from 'react';
import type { CompletionData, BlockDocs } from '@milkly/mkly';

export interface BlockDockEntry {
  name: string;
  description: string;
  kit?: string;
  docs?: BlockDocs;
}

export function useBlockDock(completionData: CompletionData) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allBlocks = useMemo((): BlockDockEntry[] => {
    const specials: BlockDockEntry[] = [
      { name: 'style', description: 'Style block' },
      { name: 'meta', description: 'Document metadata' },
      { name: 'use', description: 'Kit declaration' },
    ];

    const kitBlocks = completionData.blocks.map((b) => ({
      name: b.label,
      description: b.description,
      kit: completionData.blockKits.get(b.label),
      docs: completionData.docs.get(b.label),
    }));

    return [...specials, ...kitBlocks];
  }, [completionData]);

  const filtered = useMemo(() => {
    if (!query) return allBlocks;
    const q = query.toLowerCase();
    return allBlocks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q),
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
