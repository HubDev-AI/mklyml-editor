import { useMemo } from 'react';
import { useEditorStore } from './editor-store';

export function useDocumentPresets(): string[] {
  const source = useEditorStore((s) => s.source);

  return useMemo(() => {
    const presets: string[] = [];
    for (const line of source.split('\n')) {
      const match = line.match(/^---\s+preset:\s*(.+)$/);
      if (match) {
        const name = match[1].trim();
        if (name) presets.push(name);
      }
    }
    return presets;
  }, [source]);
}
