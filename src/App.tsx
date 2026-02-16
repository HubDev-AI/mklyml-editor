import { useTheme } from './theme/use-theme';
import { useCompile } from './store/use-compile';
import { EditorShell } from './layout/EditorShell';
import { Agentation } from 'agentation';

export function App() {
  useTheme();
  const { completionData } = useCompile();

  return (
    <>
      <EditorShell completionData={completionData} documentId="_standalone" />
      {import.meta.env.DEV && <Agentation />}
    </>
  );
}
