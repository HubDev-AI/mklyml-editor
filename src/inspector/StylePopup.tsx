import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StyleEditor } from './StyleEditor';
import { EditorErrorBoundary } from '../layout/EditorErrorBoundary';
import { useEditorStore } from '../store/editor-store';
import { adjustLineForStylePatch, applyStyleChange } from '../store/block-properties';
import { resolveBlockLine } from '../store/selection-orchestrator';
import { findSourceLine, generateStyleClass, injectClassAnnotation, injectHtmlClassAttribute, generateBlockLabel, injectBlockLabel } from '../preview/target-detect';
import { getBlockDisplayName } from '@mklyml/core';
import { getBlockIcon, getBlockIconColor } from '../icons';
import { KitBadge } from '../ui/kit-badge';
import type { CompletionData } from '@mklyml/core';
import { STYLE_SELECTED_ATTR } from '../preview/iframe-highlight';

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

function clampLine(line: number, source: string): number {
  const total = source.split('\n').length;
  return Math.max(1, Math.min(line, total));
}

function buildLiveSelectionSnapshot(
  selectedEl: Element,
  target: string,
): {
  blockLine: number;
  targetLine?: number;
  targetIndex?: number;
} | null {
  const blockEl = selectedEl.closest<HTMLElement>('[data-mkly-id][data-mkly-line]');
  if (!blockEl?.dataset.mklyLine) return null;

  const blockLine = Number(blockEl.dataset.mklyLine);
  const snapshot: { blockLine: number; targetLine?: number; targetIndex?: number } = { blockLine };

  const lineFromTarget = findSourceLine(selectedEl, blockEl);
  if (lineFromTarget) {
    snapshot.targetLine = lineFromTarget.lineNum;
  }

  if (/^>[a-z]/.test(target)) {
    const tag = target.slice(1);
    const all = blockEl.querySelectorAll(tag);
    for (let i = 0; i < all.length; i++) {
      if (all[i] === selectedEl || all[i].contains(selectedEl)) {
        snapshot.targetIndex = i;
        break;
      }
    }
  }

  return snapshot;
}

function findLiveStyleSelection(selectionId: string | undefined, target: string): {
  blockLine: number;
  targetLine?: number;
  targetIndex?: number;
} | null {
  if (!selectionId) return null;
  const iframes = document.querySelectorAll('iframe');
  for (const iframeEl of iframes) {
    const doc = (iframeEl as HTMLIFrameElement).contentDocument;
    if (!doc) continue;

    for (const candidate of doc.querySelectorAll(`[${STYLE_SELECTED_ATTR}]`)) {
      if (candidate.getAttribute(STYLE_SELECTED_ATTR) === selectionId) {
        const snapshot = buildLiveSelectionSnapshot(candidate, target);
        if (snapshot) return snapshot;
      }
    }
  }
  return null;
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
    let blockLine = popupData?.sourceLine ?? useEditorStore.getState().cursorLine;
    let workingTarget = target;
    let workingLabel = label;
    let workingTargetLine = popupData?.targetLine;
    const nextPopup = popupData ? { ...popupData } : null;

    if (popupData) {
      const liveSelection = findLiveStyleSelection(popupData.selectionId, popupData.target);
      if (!liveSelection) {
        console.warn('[mkly-style] Missing style selection marker for popup selectionId, retargeting popup to block self.');
        useEditorStore.setState((state) => {
          if (!state.stylePopup) return state;
          const nextBlockLine = state.activeBlockLine ?? state.stylePopup.sourceLine;
          return {
            stylePopup: {
              ...state.stylePopup,
              sourceLine: nextBlockLine,
              blockType: state.selection.blockType ?? state.stylePopup.blockType,
              target: 'self',
              label: undefined,
              targetLine: undefined,
              targetIndex: undefined,
              selectionId: state.selectionId ?? state.stylePopup.selectionId,
            },
          };
        });
        return;
      }
      blockLine = liveSelection.blockLine;
      workingTargetLine = liveSelection.targetLine;
      if (nextPopup) {
        nextPopup.sourceLine = liveSelection.blockLine;
        if (liveSelection.targetIndex !== undefined) {
          nextPopup.targetIndex = liveSelection.targetIndex;
        }
      }
    }

    // Plain tag target (">li", ">p") without class — inject class on first style change.
    // For verbatim blocks (core/html), inject class="sN" into the HTML tag directly.
    // For other blocks, inject {.sN} mkly annotation.
    if (/^>[a-z]/.test(workingTarget)) {
      if (workingTargetLine === undefined) {
        console.warn('[mkly-style] Missing target line for tag selector, aborting style update.');
        return;
      }
      const className = generateStyleClass(workingSource);
      const isVerbatim = completionData.contentModes.get(blockType) === 'verbatim';
      const injected = isVerbatim
        ? injectHtmlClassAttribute(workingSource, workingTargetLine, className)
        : injectClassAnnotation(workingSource, workingTargetLine, className);
      if (injected) {
        workingSource = injected;
        workingTarget = `>.${className}`;
        // Persist class target in popup state for subsequent edits.
        if (nextPopup) {
          nextPopup.target = workingTarget;
          nextPopup.targetLine = workingTargetLine;
        }
      }
    }

    // No label yet — auto-assign a block label so style applies to this instance.
    // Skip class targets (>.sN): the injected class is already unique and scoped.
    // This avoids noisy double-tagging like block ": s1" + content "{.s1}".
    if (!workingLabel && popupData && !workingTarget.startsWith('>.')) {
      const newLabel = generateBlockLabel(workingSource);
      const labeled = injectBlockLabel(workingSource, blockLine, newLabel);
      if (labeled) {
        workingSource = labeled;
        workingLabel = newLabel;
        // Persist generated label in popup state for subsequent edits.
        if (nextPopup) nextPopup.label = newLabel;
      }
    }

    const { newSource, newGraph, lineDelta, lineShiftFrom } = applyStyleChange(
      workingSource,
      currentGraph,
      blockType,
      workingTarget,
      prop,
      value,
      workingLabel,
    );

    const adjustedBlockLine = clampLine(
      adjustLineForStylePatch(blockLine, lineDelta, lineShiftFrom),
      newSource,
    );
    const adjustedTargetLine = workingTargetLine !== undefined
      ? clampLine(adjustLineForStylePatch(workingTargetLine, lineDelta, lineShiftFrom), newSource)
      : undefined;
    const nextCursorLine = adjustedTargetLine ?? adjustedBlockLine;

    // Apply source + focus atomically so selection/target state does not flicker
    // between source rewrite and cursor remap.
    useEditorStore.setState((state) => {
      const { blockLine: nextBlockLine, blockType: nextBlockType } = resolveBlockLine(nextCursorLine, newSource);
      const popupToKeep = nextPopup ?? state.stylePopup;
      return {
        source: newSource,
        styleGraph: newGraph,
        cursorLine: nextCursorLine,
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
        stylePopup: popupToKeep
          ? {
              ...popupToKeep,
              sourceLine: adjustedBlockLine,
              targetLine: popupToKeep.targetLine !== undefined
                ? clampLine(adjustLineForStylePatch(popupToKeep.targetLine, lineDelta, lineShiftFrom), newSource)
                : adjustedTargetLine,
            }
          : popupToKeep,
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
