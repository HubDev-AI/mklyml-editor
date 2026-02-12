import { reverseToMkly, ensurePreamble } from './reverse-helpers';

export interface SyncResult {
  source?: string;
  error?: string;
}

export interface ReverseOptions {
  preservePreambleFrom?: string;
}

export class SyncEngine {
  private reverseTimer: ReturnType<typeof setTimeout> | undefined;

  reverseConvert(html: string, opts?: ReverseOptions): SyncResult {
    try {
      let source = reverseToMkly(html);
      if (opts?.preservePreambleFrom) {
        source = ensurePreamble(source, opts.preservePreambleFrom);
      }
      return { source };
    } catch (e) {
      return { error: `Reverse conversion failed: ${String(e)}` };
    }
  }

  debouncedReverse(html: string, callback: (result: SyncResult) => void, debounceMs = 400, opts?: ReverseOptions) {
    clearTimeout(this.reverseTimer);
    this.reverseTimer = setTimeout(() => {
      callback(this.reverseConvert(html, opts));
    }, debounceMs);
  }

  destroy() {
    clearTimeout(this.reverseTimer);
  }
}
