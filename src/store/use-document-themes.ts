import { useMemo } from 'react';
import { useEditorStore } from './editor-store';

export function useDocumentThemes(): string[] {
  const source = useEditorStore((s) => s.source);

  return useMemo(() => {
    const themes: string[] = [];
    for (const line of source.split('\n')) {
      const match = line.match(/^---\s+theme:\s*(.+)$/);
      if (match) {
        const name = match[1].trim();
        if (name) themes.push(name);
      }
    }
    return themes;
  }, [source]);
}
