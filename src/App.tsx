import { useEffect } from 'react';
import { useTheme } from './theme/use-theme';
import { useCompile } from './store/use-compile';
import { EditorShell } from './layout/EditorShell';
import { useEditorStore, EXAMPLE_NEWSLETTER } from './store/editor-store';
import { Agentation } from 'agentation';

export function App() {
  useTheme();
  const { completionData } = useCompile();

  // Load example newsletter on first mount if editor is empty (skip in E2E)
  useEffect(() => {
    const isE2E = new URLSearchParams(window.location.search).has('e2e');
    if (!isE2E && !useEditorStore.getState().source) {
      useEditorStore.getState().setSource(EXAMPLE_NEWSLETTER);
    }
  }, []);

  return (
    <>
      <EditorShell completionData={completionData} documentId="_standalone" />
      {import.meta.env.DEV && <Agentation />}
    </>
  );
}
