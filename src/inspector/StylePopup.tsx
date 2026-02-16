import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StyleEditor } from './StyleEditor';
import { useEditorStore } from '../store/editor-store';
import { applyStyleChange } from '../store/block-properties';
import { getBlockDisplayName } from '@mklyml/core';
import type { CompletionData } from '@mklyml/core';

interface StylePopupProps {
  completionData: CompletionData;
}

const POPUP_WIDTH = 320;
const POPUP_MAX_HEIGHT = 480;

export function StylePopup({ completionData }: StylePopupProps) {
  const popup = useEditorStore((s) => s.stylePopup);
  const closeStylePopup = useEditorStore((s) => s.closeStylePopup);
  const styleGraph = useEditorStore((s) => s.styleGraph);
  const computedStyles = useEditorStore((s) => s.computedStyles);
  const setSource = useEditorStore((s) => s.setSource);
  const setStyleGraph = useEditorStore((s) => s.setStyleGraph);
  const focusBlock = useEditorStore((s) => s.focusBlock);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  // Compute position when popup changes
  useEffect(() => {
    if (!popup) return;
    const { anchorRect } = popup;

    let left = anchorRect.x + anchorRect.width + 8;
    if (left + POPUP_WIDTH > window.innerWidth) {
      left = anchorRect.x - POPUP_WIDTH - 8;
    }
    left = Math.max(4, Math.min(left, window.innerWidth - POPUP_WIDTH - 4));

    let top = anchorRect.y;
    top = Math.max(4, Math.min(top, window.innerHeight - POPUP_MAX_HEIGHT - 4));

    setPos({ left, top });
  }, [popup]);

  // Dismiss on click outside
  useEffect(() => {
    if (!popup) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeStylePopup();
      }
    };
    // Delay to avoid the opening click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [popup, closeStylePopup]);

  // Dismiss on Escape
  useEffect(() => {
    if (!popup) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeStylePopup();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [popup, closeStylePopup]);

  const handleStyleChange = useCallback((blockType: string, target: string, prop: string, value: string, label?: string) => {
    const currentSource = useEditorStore.getState().source;
    const currentGraph = useEditorStore.getState().styleGraph;
    const currentCursor = useEditorStore.getState().cursorLine;

    const { newSource, newGraph, lineDelta } = applyStyleChange(
      currentSource,
      currentGraph,
      blockType,
      target,
      prop,
      value,
      label,
    );

    const adjustedCursor = currentCursor + lineDelta;
    setStyleGraph(newGraph);
    setSource(newSource);
    focusBlock(adjustedCursor, 'inspector', 'edit-property');
  }, [setSource, setStyleGraph, focusBlock]);

  if (!popup) return null;

  const blockDocs = completionData.docs.get(popup.blockType);
  const displayName = getBlockDisplayName(popup.blockType, blockDocs);
  const blockTargets = completionData.targets.get(popup.blockType);
  const blockStyleHints = completionData.styleHints.get(popup.blockType);
  const targetLabel = popup.target === 'self'
    ? 'Self'
    : blockTargets?.[popup.target]?.label ?? popup.target;

  return createPortal(
    <div
      ref={ref}
      className="liquid-glass-overlay animate-cream-rise"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        width: POPUP_WIDTH,
        maxHeight: POPUP_MAX_HEIGHT,
        overflowY: 'auto',
        zIndex: 9998,
        borderRadius: 12,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--ed-border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ed-text)' }}>
          {displayName}
          {popup.label && <span style={{ fontWeight: 400, color: 'var(--ed-text-muted)' }}> : {popup.label}</span>}
          <span style={{ color: 'var(--ed-text-muted)', fontWeight: 400 }}> &rsaquo; {targetLabel}</span>
        </span>
        <button
          onClick={closeStylePopup}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--ed-text-muted)',
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: 16,
            lineHeight: 1,
          }}
          title="Close"
        >
          &times;
        </button>
      </div>

      {/* StyleEditor */}
      <StyleEditor
        blockType={popup.blockType}
        label={popup.label}
        styleGraph={styleGraph}
        computedStyles={computedStyles}
        targets={blockTargets}
        styleHints={blockStyleHints}
        onStyleChange={handleStyleChange}
        initialTab={popup.target}
        defaultExpanded
      />
    </div>,
    document.body,
  );
}
