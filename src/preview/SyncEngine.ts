import { reverseToMkly } from './reverse-helpers';

export interface SyncResult {
  source?: string;
  error?: string;
}

export class SyncEngine {
  private reverseTimer: ReturnType<typeof setTimeout> | undefined;

  reverseConvert(html: string): SyncResult {
    try {
      const source = reverseToMkly(html);
      return { source };
    } catch (e) {
      return { error: `Reverse conversion failed: ${String(e)}` };
    }
  }

  debouncedReverse(html: string, callback: (result: SyncResult) => void, debounceMs = 400) {
    clearTimeout(this.reverseTimer);
    this.reverseTimer = setTimeout(() => {
      callback(this.reverseConvert(html));
    }, debounceMs);
  }

  destroy() {
    clearTimeout(this.reverseTimer);
  }
}
