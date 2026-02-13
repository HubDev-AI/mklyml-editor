import { useEffect, useRef } from 'react';
import { useEditorStore, registerUndoHandlers } from './editor-store';
import { UndoManager } from './undo-manager';

let manager: UndoManager | null = null;
let skipRecording = false;

function syncState(): void {
  if (!manager) {
    useEditorStore.setState({
      canUndo: false,
      canRedo: false,
      undoInfo: { position: 0, total: 0, storageBytes: 0 },
    });
    return;
  }
  useEditorStore.setState({
    canUndo: manager.canUndo,
    canRedo: manager.canRedo,
    undoInfo: manager.getInfo(),
  });
}

// Register handlers so store.undo()/redo()/etc. delegate here
registerUndoHandlers({
  undo(): boolean {
    if (!manager) return false;
    const result = manager.undo();
    if (result === null) return false;
    skipRecording = true;
    manager.syncLastSource(result);
    useEditorStore.setState({ source: result });
    skipRecording = false;
    syncState();
    return true;
  },
  redo(): boolean {
    if (!manager) return false;
    const result = manager.redo();
    if (result === null) return false;
    skipRecording = true;
    manager.syncLastSource(result);
    useEditorStore.setState({ source: result });
    skipRecording = false;
    syncState();
    return true;
  },
  flush(): void {
    manager?.flush();
    syncState();
  },
  clear(): void {
    manager?.clear();
    syncState();
  },
});

export interface UndoInitOptions {
  persistHistory?: boolean;
}

export function useUndoInit(documentId: string, options?: UndoInitOptions): void {
  const isNormalized = useEditorStore((s) => s.isNormalized);
  const initializedRef = useRef(false);
  const docIdRef = useRef(documentId);
  const persistHistory = options?.persistHistory ?? false;

  // Initialize manager after normalization
  useEffect(() => {
    if (!isNormalized) return;
    if (initializedRef.current && docIdRef.current === documentId) return;

    if (initializedRef.current) {
      manager?.flush();
    }

    docIdRef.current = documentId;
    initializedRef.current = true;

    manager?.destroy();
    const src = useEditorStore.getState().source;
    manager = new UndoManager(documentId, src, { persistHistory });
    manager.onCheckpoint = syncState;
    useEditorStore.setState({ documentId });
    syncState();
  }, [isNormalized, documentId, persistHistory]);

  // Subscribe to source changes — record into undo manager
  useEffect(() => {
    return useEditorStore.subscribe((state, prev) => {
      if (state.source !== prev.source && !skipRecording && manager) {
        manager.recordChange(state.source);
        syncState();
      }
    });
  }, []);

  // Flush on beforeunload and unmount
  useEffect(() => {
    const handler = () => manager?.flush();
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      manager?.flush();
    };
  }, []);
}
