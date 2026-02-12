import { useCallback } from 'react';
import { BlockHeader } from './BlockHeader';
import { PropertyForm } from './PropertyForm';
import { StyleEditor } from './StyleEditor';
import { TargetStyleEditor } from './TargetStyleEditor';
import { BlockDocsPanel } from './BlockDocsPanel';
import { KitInfoPanel } from './KitInfoPanel';
import { MetaInspector } from './MetaInspector';
import { NoSelection } from './NoSelection';
import { ThemeInfo } from './ThemeInfo';
import { useEditorStore } from '../store/editor-store';
import { useDocumentThemes } from '../store/use-document-themes';
import type { CursorBlock } from '../store/use-cursor-context';
import type { CompletionData } from '@milkly/mkly';

interface PropertyInspectorProps {
  cursorBlock: CursorBlock | null;
  completionData: CompletionData;
}

export function PropertyInspector({ cursorBlock, completionData }: PropertyInspectorProps) {
  const setSource = useEditorStore((s) => s.setSource);
  const activeThemes = useDocumentThemes();

  const focusBlock = useEditorStore((s) => s.focusBlock);
  const cursorLine = useEditorStore((s) => s.cursorLine);

  const handlePropertyChange = useCallback((key: string, value: string) => {
    if (!cursorBlock) return;

    // Signal edit-property intent before modifying source to suppress cross-pane scrolls
    focusBlock(cursorLine, 'inspector', 'edit-property');

    const currentSource = useEditorStore.getState().source;
    const lines = currentSource.split('\n');
    let found = false;

    for (let i = cursorBlock.startLine - 1; i < cursorBlock.endLine - 1 && i < lines.length; i++) {
      const match = lines[i].match(/^(@?[\w./-]+):\s*/);
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
      const insertAt = cursorBlock.startLine - 1;
      lines.splice(insertAt, 0, `${key}: ${value}`);
    }

    setSource(lines.join('\n'));
  }, [cursorBlock, setSource, focusBlock, cursorLine]);

  if (!cursorBlock) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <NoSelection />
        <ThemeInfo activeThemes={activeThemes} completionData={completionData} />
      </div>
    );
  }

  // Special block: --- use: kitName
  if (cursorBlock.isSpecial && cursorBlock.type === 'use') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
        <KitInfoPanel
          kitName={cursorBlock.label ?? ''}
          kitInfo={completionData.kitInfo.get(cursorBlock.label ?? '')}
          completionData={completionData}
        />
        <ThemeInfo activeThemes={activeThemes} completionData={completionData} />
      </div>
    );
  }

  // Special block: --- meta
  if (cursorBlock.isSpecial && cursorBlock.type === 'meta') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
        <MetaInspector
          properties={cursorBlock.properties}
          startLine={cursorBlock.startLine}
          endLine={cursorBlock.endLine}
          completionData={completionData}
        />
      </div>
    );
  }

  // Special block: --- theme: name
  if (cursorBlock.isSpecial && cursorBlock.type === 'theme') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
        <ThemeInfo activeThemes={activeThemes} completionData={completionData} />
      </div>
    );
  }

  // Regular content block
  const blockDocs = completionData.docs.get(cursorBlock.type);
  const kitName = completionData.blockKits.get(cursorBlock.type);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'auto',
    }}>
      <BlockHeader
        type={cursorBlock.type}
        startLine={cursorBlock.startLine}
        endLine={cursorBlock.endLine}
        kitName={kitName}
        completionData={completionData}
      />
      <PropertyForm
        blockType={cursorBlock.type}
        properties={cursorBlock.properties}
        completionData={completionData}
        onPropertyChange={handlePropertyChange}
      />
      <StyleEditor
        properties={cursorBlock.properties}
        onPropertyChange={handlePropertyChange}
      />
      {completionData.targets.get(cursorBlock.type) && (
        <TargetStyleEditor
          targets={completionData.targets.get(cursorBlock.type)!}
          properties={cursorBlock.properties}
          onPropertyChange={handlePropertyChange}
        />
      )}
      {blockDocs && (
        <BlockDocsPanel
          blockType={cursorBlock.type}
          docs={blockDocs}
          kitName={kitName}
        />
      )}
    </div>
  );
}
