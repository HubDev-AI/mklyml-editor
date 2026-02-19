import { useCallback } from 'react';
import { BlockHeader } from './BlockHeader';
import { PropertyForm } from './PropertyForm';
import { StyleEditor } from './StyleEditor';
import { BlockDocsPanel } from './BlockDocsPanel';
import { KitInfoPanel } from './KitInfoPanel';
import { MetaInspector } from './MetaInspector';
import { NoSelection } from './NoSelection';
import { ThemeInfo } from './ThemeInfo';
import { PresetInfo } from './PresetInfo';
import { GlobalStyleInfo } from './GlobalStyleInfo';
import { applyUnifiedStyleChange } from './apply-unified-style-change';
import { useEditorStore } from '../store/editor-store';
import { useDocumentThemes } from '../store/use-document-themes';
import { useDocumentPresets } from '../store/use-document-presets';
import { applyPropertyChange } from '../store/block-properties';
import { resolveBlockLine } from '../store/selection-orchestrator';
import type { CursorBlock } from '../store/use-cursor-context';
import type { CompletionData } from '@mklyml/core';

interface PropertyInspectorProps {
  cursorBlock: CursorBlock | null;
  completionData: CompletionData;
}

export function PropertyInspector({ cursorBlock, completionData }: PropertyInspectorProps) {
  const source = useEditorStore((s) => s.source);
  const setSource = useEditorStore((s) => s.setSource);
  const activeThemes = useDocumentThemes();
  const activePresets = useDocumentPresets();
  const computedStyles = useEditorStore((s) => s.computedStyles);
  const styleGraph = useEditorStore((s) => s.styleGraph);
  const stylePickMode = useEditorStore((s) => s.stylePickMode);
  const styleSelection = useEditorStore((s) => s.styleSelection);
  const activeBlockLine = useEditorStore((s) => s.activeBlockLine);
  const selectionId = useEditorStore((s) => s.selectionId);
  const focusBlock = useEditorStore((s) => s.focusBlock);

  const handlePropertyChange = useCallback((key: string, value: string) => {
    if (!cursorBlock) return;

    const currentCursor = useEditorStore.getState().cursorLine;
    focusBlock(currentCursor, 'inspector', 'edit-property');

    const currentSource = useEditorStore.getState().source;
    const { newSource } = applyPropertyChange(
      currentSource,
      cursorBlock.startLine,
      cursorBlock.endLine,
      key,
      value,
    );
    setSource(newSource);
  }, [cursorBlock, setSource, focusBlock]);

  const handleStyleChange = useCallback((blockType: string, target: string, prop: string, value: string, label?: string) => {
    applyUnifiedStyleChange({ completionData, blockType, target, prop, value, label });
  }, [completionData]);

  if (!cursorBlock) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <NoSelection />
        <ThemeInfo activeThemes={activeThemes} completionData={completionData} />
        <PresetInfo activePresets={activePresets} completionData={completionData} />
        <GlobalStyleInfo />
      </div>
    );
  }

  // Special block: --- use: kitName
  if (cursorBlock.isSpecial && cursorBlock.type === 'use') {
    const kitInfo = completionData.kitInfo.get(cursorBlock.label ?? '');
    const kitHasPresets = (kitInfo?.presetNames.length ?? 0) > 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
        <KitInfoPanel
          kitName={cursorBlock.label ?? ''}
          kitInfo={kitInfo}
          completionData={completionData}
        />
        <ThemeInfo activeThemes={activeThemes} completionData={completionData} />
        {kitHasPresets && <PresetInfo activePresets={activePresets} completionData={completionData} />}
        <GlobalStyleInfo />
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
        <PresetInfo activePresets={activePresets} completionData={completionData} />
        <GlobalStyleInfo />
      </div>
    );
  }

  // Special block: --- preset: name
  if (cursorBlock.isSpecial && cursorBlock.type === 'preset') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
        <ThemeInfo activeThemes={activeThemes} completionData={completionData} />
        <PresetInfo activePresets={activePresets} completionData={completionData} />
        <GlobalStyleInfo />
      </div>
    );
  }

  // Regular content block
  const blockDocs = completionData.docs.get(cursorBlock.type);
  const kitName = completionData.blockKits.get(cursorBlock.type);
  const blockTargets = completionData.targets.get(cursorBlock.type);
  const blockStyleHints = completionData.styleHints.get(cursorBlock.type);
  const selectionBlockLine = styleSelection
    ? resolveBlockLine(styleSelection.sourceLine, source).blockLine
    : null;
  const selectionTargetsCurrentBlock = selectionBlockLine !== null
    && activeBlockLine !== null
    && selectionBlockLine === activeBlockLine;
  const selectionMatchesActiveId = styleSelection?.selectionId !== undefined
    && selectionId !== null
    && styleSelection.selectionId === selectionId;
  const syncedStyleSelection = stylePickMode
    && styleSelection
    && (selectionTargetsCurrentBlock || selectionMatchesActiveId)
    ? styleSelection
    : null;
  const isTagTarget = syncedStyleSelection?.target.startsWith('>') ?? false;
  const isKnownTarget = syncedStyleSelection
    ? (
        syncedStyleSelection.target === 'self'
        || syncedStyleSelection.target === 'self:hover'
        || !!blockTargets?.[syncedStyleSelection.target]
        || isTagTarget
      )
    : false;
  const inspectorInitialTab = isKnownTarget ? syncedStyleSelection?.target : undefined;

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
        blockType={cursorBlock.type}
        label={syncedStyleSelection?.label ?? cursorBlock.label}
        styleGraph={styleGraph}
        computedStyles={computedStyles}
        targets={blockTargets}
        styleHints={blockStyleHints}
        targetTag={syncedStyleSelection?.targetTag}
        onStyleChange={handleStyleChange}
        initialTab={inspectorInitialTab}
        context="inspector"
      />
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
