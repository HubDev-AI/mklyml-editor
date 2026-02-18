import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StyleEditor } from './StyleEditor';
import { EditorErrorBoundary } from '../layout/EditorErrorBoundary';
import { useEditorStore } from '../store/editor-store';
import { applyStyleChange } from '../store/block-properties';
import { resolveBlockLine } from '../store/selection-orchestrator';
import { generateStyleClass, injectClassAnnotation, injectHtmlClassAttribute, generateBlockLabel, injectBlockLabel } from '../preview/target-detect';
import { getBlockDisplayName } from '@mklyml/core';
import { getBlockIcon, getBlockIconColor } from '../icons';
import { KitBadge } from '../ui/kit-badge';
import type { CompletionData } from '@mklyml/core';

interface StylePopupProps {
  completionData: CompletionData;
}

const POPUP_WIDTH = 320;
const POPUP_MAX_HEIGHT = 480;

/** Format a descendant target for display: ">p" → "<p>", ">.s1" → ".s1", ">p:nth-of-type(2)" → "<p> #2" */
function formatTagTarget(target: string): string {
  const raw = target.slice(1); // remove ">"
  // Class target: ".s1" → ".s1"
  if (raw.startsWith('.')) return raw;
  const nthMatch = raw.match(/^(\w+):nth-of-type\((\d+)\)$/);
  if (nthMatch) return `<${nthMatch[1]}> #${nthMatch[2]}`;
  return `<${raw}>`;
}

export function StylePopup({ completionData }: StylePopupProps) {
  const popup = useEditorStore((s) => s.stylePopup);
  const closeStylePopup = useEditorStore((s) => s.closeStylePopup);
  const styleGraph = useEditorStore((s) => s.styleGraph);
  const computedStyles = useEditorStore((s) => s.computedStyles);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  // Drag: use a ref for position to avoid stale closures in event handlers
  const posRef = useRef({ left: 0, top: 0 });
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  function updatePos(p: { left: number; top: number }) {
    posRef.current = p;
    setPos(p);
  }

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

    updatePos({ left, top });
  }, [popup]);

  // Drag handlers on window — refs avoid stale closure issues
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      updatePos({
        left: Math.max(0, Math.min(e.clientX - dragRef.current.offsetX, window.innerWidth - POPUP_WIDTH)),
        top: Math.max(0, Math.min(e.clientY - dragRef.current.offsetY, window.innerHeight - 100)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    // Capture offset between cursor and popup corner — uses ref for fresh value
    dragRef.current = {
      offsetX: e.clientX - posRef.current.left,
      offsetY: e.clientY - posRef.current.top,
    };
    e.preventDefault();
  }, []);

  // Dismiss on click outside
  useEffect(() => {
    if (!popup) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeStylePopup();
      }
    };
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
    let workingSource = useEditorStore.getState().source;
    const currentGraph = useEditorStore.getState().styleGraph;
    const popupData = useEditorStore.getState().stylePopup;
    const blockLine = popupData?.sourceLine ?? useEditorStore.getState().cursorLine;
    let workingTarget = target;
    let workingLabel = label;

    // Plain tag target (">li", ">p") without class — inject class on first style change.
    // For verbatim blocks (core/html), inject class="sN" into the HTML tag directly.
    // For other blocks, inject {.sN} mkly annotation.
    if (/^>[a-z]/.test(workingTarget) && popupData?.targetLine !== undefined) {
      const className = generateStyleClass(workingSource);
      const isVerbatim = completionData.contentModes.get(blockType) === 'verbatim';
      const injected = isVerbatim
        ? injectHtmlClassAttribute(workingSource, popupData.targetLine, className)
        : injectClassAnnotation(workingSource, popupData.targetLine, className);
      if (injected) {
        workingSource = injected;
        workingTarget = `>.${className}`;
        // Update popup so subsequent changes reuse this class
        useEditorStore.getState().openStylePopup({ ...popupData, target: workingTarget, targetLine: undefined });
      }
    }

    // No label yet — auto-assign a block label so the style only applies to this
    // specific block instance, not all blocks of the same type. This applies to ALL
    // targets in style pick mode (self, BEM, tag), ensuring per-instance scoping.
    if (!workingLabel && popupData) {
      const newLabel = generateBlockLabel(workingSource);
      const labeled = injectBlockLabel(workingSource, popupData.sourceLine, newLabel);
      if (labeled) {
        workingSource = labeled;
        workingLabel = newLabel;
        // Update popup so subsequent changes reuse this label
        useEditorStore.getState().openStylePopup({ ...popupData, label: newLabel });
      }
    }

    const { newSource, newGraph, lineDelta } = applyStyleChange(
      workingSource,
      currentGraph,
      blockType,
      workingTarget,
      prop,
      value,
      workingLabel,
    );

    const adjustedLine = blockLine + lineDelta;

    // Apply source + focus atomically so selection/target state does not flicker
    // between source rewrite and cursor remap.
    useEditorStore.setState((state) => {
      const { blockLine: nextBlockLine, blockType: nextBlockType } = resolveBlockLine(adjustedLine, newSource);
      return {
        source: newSource,
        styleGraph: newGraph,
        cursorLine: adjustedLine,
        activeBlockLine: nextBlockLine,
        selection: {
          blockLine: nextBlockLine,
          blockType: nextBlockType,
          propertyKey: state.selection.propertyKey,
          contentRange: null,
        },
        focusOrigin: 'inspector',
        focusVersion: state.focusVersion + 1,
        focusIntent: 'edit-property' as const,
        stylePopup: state.stylePopup && lineDelta !== 0
          ? { ...state.stylePopup, sourceLine: adjustedLine }
          : state.stylePopup,
      };
    });
  }, [completionData]);

  if (!popup) return null;

  const blockDocs = completionData.docs.get(popup.blockType);
  const displayName = getBlockDisplayName(popup.blockType, blockDocs);
  const blockTargets = completionData.targets.get(popup.blockType);
  const blockStyleHints = completionData.styleHints.get(popup.blockType);
  const kitName = completionData.blockKits.get(popup.blockType);
  const Icon = getBlockIcon(popup.blockType, completionData);
  const iconColor = getBlockIconColor(popup.blockType, completionData);

  // Tag targets (">p", ">p:nth-of-type(2)") are descendant selectors — always valid.
  const isTagTarget = popup.target.startsWith('>');
  const isKnownTarget = popup.target === 'self' || popup.target === 'self:hover'
    || !!blockTargets?.[popup.target] || isTagTarget;

  const targetLabel = popup.target === 'self'
    ? 'Self'
    : isTagTarget
      ? formatTagTarget(popup.target)
      : blockTargets?.[popup.target]?.label
        ?? popup.target;

  const effectiveTab = isKnownTarget ? popup.target : 'self';

  return createPortal(
    <EditorErrorBoundary name="Style popup">
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
        {/* Header — sticky + draggable, with icon + kit badge like BlockHeader */}
        <div
          onMouseDown={onHeaderMouseDown}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid var(--ed-border)',
            cursor: 'grab',
            userSelect: 'none',
            background: 'var(--ed-glass-bg, rgba(255,255,255,0.85))',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px 12px 0 0',
          }}
        >
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 5,
            background: iconColor.bg,
            color: iconColor.color,
            flexShrink: 0,
          }}>
            <Icon size={12} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ed-text)' }}>
                {displayName}
              </span>
              {kitName && <KitBadge kit={kitName} />}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ed-text-muted)' }}>
              {popup.label && <span>{popup.label} &rsaquo; </span>}
              {targetLabel}
            </div>
          </div>
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
              flexShrink: 0,
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
          initialTab={effectiveTab}
          defaultExpanded
        />
      </div>
    </EditorErrorBoundary>,
    document.body,
  );
}
