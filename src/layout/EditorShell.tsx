import { useCallback, useRef } from 'react';
import { MklyEditor } from '../editor/MklyEditor';
import { GlassToolbar } from '../toolbar/GlassToolbar';
import { StatusBar } from '../status/StatusBar';
import { PreviewPane } from '../preview/PreviewPane';
import { BlockDock } from '../block-dock/BlockDock';
import { BlockSidebar } from '../block-dock/BlockSidebar';
import { PropertyInspector } from '../inspector/PropertyInspector';
import { StylePopup } from '../inspector/StylePopup';
import { ResizeHandle } from './ResizeHandle';
import { EditorErrorBoundary } from './EditorErrorBoundary';
import { useEditorStore } from '../store/editor-store';
import { useCursorContext } from '../store/use-cursor-context';
import { useUndoInit } from '../store/use-undo';
import type { CompletionData } from '@mklyml/core';

interface EditorShellProps {
  completionData: CompletionData;
  documentId?: string;
  persistHistory?: boolean;
}

export function EditorShell({ completionData, documentId, persistHistory }: EditorShellProps) {
  useUndoInit(documentId ?? '_default', { persistHistory });
  const panelSizes = useEditorStore((s) => s.panelSizes);
  const setPanelSizes = useEditorStore((s) => s.setPanelSizes);
  const inspectorCollapsed = useEditorStore((s) => s.inspectorCollapsed);
  const sidebarCollapsed = useEditorStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useEditorStore((s) => s.sidebarWidth);
  const setSidebarWidth = useEditorStore((s) => s.setSidebarWidth);
  const setSource = useEditorStore((s) => s.setSource);
  const containerRef = useRef<HTMLDivElement>(null);

  const cursorBlock = useCursorContext();

  const handleInsertBlock = useCallback((blockName: string) => {
    const { source, cursorLine, focusBlock } = useEditorStore.getState();
    const lines = source.split('\n');
    const insertLine = cursorLine - 1;
    const template = `\n--- ${blockName}\n`;
    lines.splice(insertLine + 1, 0, template);
    const newBlockLine = cursorLine + 2;
    setSource(lines.join('\n'));
    focusBlock(newBlockLine, 'block-dock');
  }, [setSource]);

  const handleResize = useCallback((index: 0 | 1, delta: number) => {
    const container = containerRef.current;
    if (!container) return;
    const totalWidth = container.offsetWidth;
    const deltaPercent = (delta / totalWidth) * 100;

    setPanelSizes((prev) => {
      const next: [number, number, number] = [...prev];
      next[index] += deltaPercent;
      next[index + 1] -= deltaPercent;

      if (next[index] < 15) next[index] = 15;
      if (next[index + 1] < 15) next[index + 1] = 15;

      const total = next[0] + next[1] + next[2];
      return next.map((v) => (v / total) * 100) as [number, number, number];
    });
  }, [setPanelSizes]);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(useEditorStore.getState().sidebarWidth + delta);
  }, [setSidebarWidth]);

  const inspectorWidth = inspectorCollapsed ? 0 : panelSizes[2];
  const editorWidth = inspectorCollapsed
    ? panelSizes[0] + panelSizes[2] / 2
    : panelSizes[0];
  const previewWidth = inspectorCollapsed
    ? panelSizes[1] + panelSizes[2] / 2
    : panelSizes[1];

  return (
    <>
      <GlassToolbar />
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {!sidebarCollapsed && (
          <>
            <div
              style={{
                width: sidebarWidth,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              <BlockSidebar completionData={completionData} />
            </div>
            <ResizeHandle onResize={handleSidebarResize} />
          </>
        )}

        <div
          style={{
            width: `${editorWidth}%`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <EditorErrorBoundary name="Code editor">
            <MklyEditor completionData={completionData} />
          </EditorErrorBoundary>
        </div>

        <ResizeHandle onResize={(d) => handleResize(0, d)} />

        <div
          style={{
            width: `${previewWidth}%`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <EditorErrorBoundary name="Preview">
            <PreviewPane />
          </EditorErrorBoundary>
        </div>

        {!inspectorCollapsed && (
          <>
            <ResizeHandle onResize={(d) => handleResize(1, d)} />
            <div
              style={{
                width: `${inspectorWidth}%`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minWidth: 0,
                background: 'var(--ed-surface-alt)',
                borderLeft: '1px solid var(--ed-border)',
              }}
            >
              <EditorErrorBoundary name="Inspector">
                <PropertyInspector cursorBlock={cursorBlock} completionData={completionData} />
              </EditorErrorBoundary>
            </div>
          </>
        )}
      </div>
      <StatusBar />
      <BlockDock
        completionData={completionData}
        onInsert={handleInsertBlock}
      />
      <StylePopup completionData={completionData} />
    </>
  );
}
