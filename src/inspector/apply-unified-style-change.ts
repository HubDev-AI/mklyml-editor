import type { CompletionData } from '@mklyml/core';
import { adjustLineForStylePatch, applyStyleChange } from '../store/block-properties';
import { resolveBlockLine } from '../store/selection-orchestrator';
import { useEditorStore } from '../store/editor-store';
import {
  findSourceLine,
  generateStyleClass,
  injectClassAnnotation,
  injectHtmlClassAttribute,
  generateBlockLabel,
  injectBlockLabel,
} from '../preview/target-detect';
import { STYLE_SELECTED_ATTR } from '../preview/iframe-highlight';

function clampLine(line: number, source: string): number {
  const total = source.split('\n').length;
  return Math.max(1, Math.min(line, total));
}

interface LiveSelectionSnapshot {
  blockLine: number;
  targetLine?: number;
  targetIndex?: number;
}

function buildLiveSelectionSnapshot(selectedEl: Element, target: string): LiveSelectionSnapshot | null {
  const blockEl = selectedEl.closest<HTMLElement>('[data-mkly-id][data-mkly-line]');
  if (!blockEl?.dataset.mklyLine) return null;

  const blockLine = Number(blockEl.dataset.mklyLine);
  const snapshot: LiveSelectionSnapshot = { blockLine };

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

function findLiveStyleSelection(selectionId: string | undefined, target: string): LiveSelectionSnapshot | null {
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

interface ApplyUnifiedStyleChangeInput {
  completionData: CompletionData;
  blockType: string;
  target: string;
  prop: string;
  value: string;
  label?: string;
}

export function applyUnifiedStyleChange(input: ApplyUnifiedStyleChangeInput): void {
  const { completionData, blockType, target, prop, value, label } = input;
  const currentState = useEditorStore.getState();
  let workingSource = currentState.source;
  const currentGraph = currentState.styleGraph;
  const popupData = currentState.stylePopup;
  const selectionData = currentState.styleSelection ?? popupData;
  const stylePickActive = currentState.stylePickMode && !!selectionData;
  let blockLine = selectionData?.sourceLine ?? currentState.cursorLine;
  let workingTarget = target;
  let workingLabel = label;
  let workingTargetLine = selectionData?.targetLine;
  const nextSelection = selectionData ? { ...selectionData } : null;
  const nextPopup = popupData ? { ...popupData } : null;

  if (selectionData) {
    const liveSelection = findLiveStyleSelection(selectionData.selectionId, selectionData.target);
    if (!liveSelection) {
      console.warn('[mkly-style] Missing style selection marker for selectionId, retargeting popup to block self.');
      useEditorStore.setState((state) => {
        if (!state.styleSelection && !state.stylePopup) return state;
        const nextBlockLine = state.activeBlockLine
          ?? state.styleSelection?.sourceLine
          ?? state.stylePopup?.sourceLine;
        if (nextBlockLine === undefined) return state;
        const nextSelection = {
          blockType: state.selection.blockType
            ?? state.styleSelection?.blockType
            ?? state.stylePopup?.blockType
            ?? blockType,
          target: 'self',
          targetTag: undefined,
          label: undefined,
          sourceLine: nextBlockLine,
          targetLine: undefined,
          targetIndex: undefined,
          selectionId: state.selectionId
            ?? state.styleSelection?.selectionId
            ?? state.stylePopup?.selectionId,
        };
        return {
          styleSelection: nextSelection,
          stylePopup: state.stylePopup
            ? { ...state.stylePopup, ...nextSelection }
            : state.stylePopup,
        };
      });
      return;
    }
    blockLine = liveSelection.blockLine;
    workingTargetLine = liveSelection.targetLine;
    if (nextSelection) {
      nextSelection.sourceLine = liveSelection.blockLine;
      if (liveSelection.targetIndex !== undefined) {
        nextSelection.targetIndex = liveSelection.targetIndex;
      }
    }
    if (nextPopup) {
      nextPopup.sourceLine = liveSelection.blockLine;
      if (liveSelection.targetIndex !== undefined) {
        nextPopup.targetIndex = liveSelection.targetIndex;
      }
    }
  }

  // Plain tag target (">li", ">p") without class — inject class on first style change.
  if (stylePickActive && /^>[a-z]/.test(workingTarget)) {
    if (workingTargetLine === undefined) {
      console.warn('[mkly-style] Missing target line for tag selector, aborting style update.');
      return;
    }
    const rawTag = workingTarget.slice(1).replace(/:nth-of-type\(\d+\)$/g, '');
    const className = generateStyleClass(workingSource);
    const isVerbatim = completionData.contentModes.get(blockType) === 'verbatim';
    const injected = isVerbatim
      ? injectHtmlClassAttribute(workingSource, workingTargetLine, className)
      : injectClassAnnotation(workingSource, workingTargetLine, className);
    if (injected) {
      workingSource = injected;
      workingTarget = `>.${className}`;
      if (nextSelection) {
        nextSelection.target = workingTarget;
        nextSelection.targetLine = workingTargetLine;
        nextSelection.targetTag = rawTag;
      }
      if (nextPopup) {
        nextPopup.target = workingTarget;
        nextPopup.targetLine = workingTargetLine;
        nextPopup.targetTag = rawTag;
      }
    }
  }

  // Auto-label block instance only for non-class targets.
  if (stylePickActive && !workingLabel && selectionData && !workingTarget.startsWith('>.')) {
    const newLabel = generateBlockLabel(workingSource);
    const labeled = injectBlockLabel(workingSource, blockLine, newLabel);
    if (labeled) {
      workingSource = labeled;
      workingLabel = newLabel;
      if (nextSelection) nextSelection.label = newLabel;
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

  useEditorStore.setState((state) => {
    const { blockLine: nextBlockLine, blockType: nextBlockType } = resolveBlockLine(nextCursorLine, newSource);
    const selectionToKeep = nextSelection ?? state.styleSelection;
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
      styleSelection: selectionToKeep
        ? {
            ...selectionToKeep,
            sourceLine: adjustedBlockLine,
            targetLine: selectionToKeep.targetLine !== undefined
              ? clampLine(adjustLineForStylePatch(selectionToKeep.targetLine, lineDelta, lineShiftFrom), newSource)
              : adjustedTargetLine,
          }
        : selectionToKeep,
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
}
