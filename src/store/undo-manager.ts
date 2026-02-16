import { diff_match_patch } from 'diff-match-patch';

interface UndoPatch {
  fwd: string;
  rev: string;
  ts: number;
}

interface UndoState {
  version: 1;
  base: string;
  patches: UndoPatch[];
  cursor: number;
}

interface UndoManagerConfig {
  documentId: string;
  maxEntries: number;
  debounceMs: number;
  maxStorageBytes: number;
  persistHistory: boolean;
}

export interface UndoInfo {
  position: number;
  total: number;
  storageBytes: number;
}

const DEFAULT_CONFIG: Omit<UndoManagerConfig, 'documentId'> = {
  maxEntries: 20,
  debounceMs: 800,
  maxStorageBytes: 500_000,
  persistHistory: false,
};

const dmp = new diff_match_patch();

function storageKey(documentId: string): string {
  return `mkly-undo:${documentId}`;
}

export class UndoManager {
  private state: UndoState;
  private config: UndoManagerConfig;
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSource: string;
  onCheckpoint: (() => void) | null = null;

  constructor(documentId: string, initialSource: string, config?: Partial<Omit<UndoManagerConfig, 'documentId'>>) {
    this.config = { documentId, ...DEFAULT_CONFIG, ...config };
    if (this.config.persistHistory) {
      this.state = this.load() ?? {
        version: 1,
        base: initialSource,
        patches: [],
        cursor: 0,
      };
    } else {
      localStorage.removeItem(storageKey(documentId));
      this.state = {
        version: 1,
        base: initialSource,
        patches: [],
        cursor: 0,
      };
    }
    this.lastSource = this.currentSource();
  }

  private load(): UndoState | null {
    try {
      const raw = localStorage.getItem(storageKey(this.config.documentId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || typeof parsed.base !== 'string') return null;
      return parsed as UndoState;
    } catch {
      localStorage.removeItem(storageKey(this.config.documentId));
      return null;
    }
  }

  private save(): void {
    try {
      const json = JSON.stringify(this.state);
      if (json.length > this.config.maxStorageBytes) {
        this.trimHalf();
        const trimmed = JSON.stringify(this.state);
        if (trimmed.length > this.config.maxStorageBytes) {
          this.trimHalf();
        }
      }
      localStorage.setItem(storageKey(this.config.documentId), JSON.stringify(this.state));
    } catch {
      this.trimHalf();
      try {
        localStorage.setItem(storageKey(this.config.documentId), JSON.stringify(this.state));
      } catch {
        this.state = { version: 1, base: this.lastSource, patches: [], cursor: 0 };
        try {
          localStorage.setItem(storageKey(this.config.documentId), JSON.stringify(this.state));
        } catch {
          // Give up on persistence
        }
      }
    }
  }

  private trimHalf(): void {
    const { patches, cursor, base } = this.state;
    if (patches.length <= 1) return;

    const keepFrom = Math.floor(patches.length / 2);
    const newBase = this.reconstructAt(keepFrom, base, patches);
    this.state.base = newBase;
    this.state.patches = patches.slice(keepFrom);
    this.state.cursor = Math.max(0, cursor - keepFrom);
  }

  private reconstructAt(index: number, base: string, patches: UndoPatch[]): string {
    let text = base;
    for (let i = 0; i < index; i++) {
      text = this.applyPatch(text, patches[i].fwd);
    }
    return text;
  }

  private currentSource(): string {
    try {
      return this.reconstructAt(this.state.cursor, this.state.base, this.state.patches);
    } catch {
      return this.state.base;
    }
  }

  private applyPatch(text: string, patchText: string): string {
    const patches = dmp.patch_fromText(patchText);
    const [result, success] = dmp.patch_apply(patches, text);
    if (success.some(s => !s)) {
      throw new Error('Patch apply failed');
    }
    return result;
  }

  private createCheckpoint(newSource: string): void {
    const currentSrc = this.currentSource();
    if (newSource === currentSrc) return;

    // Truncate any redo entries after current cursor
    this.state.patches = this.state.patches.slice(0, this.state.cursor);

    const fwdPatches = dmp.patch_make(currentSrc, newSource);
    const revPatches = dmp.patch_make(newSource, currentSrc);

    this.state.patches.push({
      fwd: dmp.patch_toText(fwdPatches),
      rev: dmp.patch_toText(revPatches),
      ts: Date.now(),
    });
    this.state.cursor = this.state.patches.length;

    // Trim if over max
    if (this.state.patches.length > this.config.maxEntries) {
      this.trimHalf();
    }

    this.lastSource = newSource;
    this.save();
  }

  recordChange(source: string): void {
    if (source === this.lastSource) return;
    this.pending = source;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.commitPending();
      this.onCheckpoint?.();
    }, this.config.debounceMs);
  }

  private commitPending(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending !== null) {
      const src = this.pending;
      this.pending = null;
      this.createCheckpoint(src);
    }
  }

  flush(): void {
    this.commitPending();
  }

  undo(): string | null {
    this.flush();
    if (this.state.cursor <= 0) return null;

    try {
      const patch = this.state.patches[this.state.cursor - 1];
      const currentSrc = this.currentSource();
      const result = this.applyPatch(currentSrc, patch.rev);
      this.state.cursor--;
      this.lastSource = result;
      this.save();
      return result;
    } catch {
      // Reconstruct from base on failure
      this.state.cursor = Math.max(0, this.state.cursor - 1);
      const result = this.currentSource();
      this.lastSource = result;
      this.save();
      return result;
    }
  }

  redo(): string | null {
    this.flush();
    if (this.state.cursor >= this.state.patches.length) return null;

    try {
      const patch = this.state.patches[this.state.cursor];
      const currentSrc = this.currentSource();
      const result = this.applyPatch(currentSrc, patch.fwd);
      this.state.cursor++;
      this.lastSource = result;
      this.save();
      return result;
    } catch {
      this.state.cursor = Math.min(this.state.patches.length, this.state.cursor + 1);
      const result = this.currentSource();
      this.lastSource = result;
      this.save();
      return result;
    }
  }

  get canUndo(): boolean {
    return this.state.cursor > 0 || this.pending !== null;
  }

  get canRedo(): boolean {
    return this.state.cursor < this.state.patches.length;
  }

  getInfo(): UndoInfo {
    const json = JSON.stringify(this.state);
    return {
      position: this.state.cursor,
      total: this.state.patches.length,
      storageBytes: json.length,
    };
  }

  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    this.state = { version: 1, base: this.lastSource, patches: [], cursor: 0 };
    localStorage.removeItem(storageKey(this.config.documentId));
  }

  destroy(): void {
    this.flush();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Sync lastSource when external code sets the source (undo/redo apply) */
  syncLastSource(source: string): void {
    this.lastSource = source;
  }
}

/** Static utilities for external access (e.g., parent app) */
export function clearDocumentHistory(documentId: string): void {
  localStorage.removeItem(storageKey(documentId));
}

export function getDocumentHistoryInfo(documentId: string): UndoInfo | null {
  try {
    const raw = localStorage.getItem(storageKey(documentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UndoState;
    if (parsed?.version !== 1) return null;
    return {
      position: parsed.cursor,
      total: parsed.patches.length,
      storageBytes: raw.length,
    };
  } catch {
    return null;
  }
}
