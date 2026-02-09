import { htmlToMkly, CORE_KIT } from '@milkly/mkly';
import { NEWSLETTER_KIT } from '@mkly-kits/newsletter';

export interface SyncResult {
  html?: string;
  source?: string;
  error?: string;
}

export class SyncEngine {
  private reverseTimer: ReturnType<typeof setTimeout> | undefined;

  reverseConvert(html: string): SyncResult {
    try {
      // Strip source map attributes before reverse conversion (preserve data-mkly-styles for style round-trip)
      const cleanHtml = html.replace(/\s+data-mkly-(?!styles)[\w-]+="[^"]*"/g, '');
      const source = htmlToMkly(cleanHtml, {
        kits: { core: CORE_KIT, newsletter: NEWSLETTER_KIT },
      });
      return { source };
    } catch (e) {
      return { error: `Reverse conversion failed: ${String(e)}` };
    }
  }

  debouncedReverse(html: string, callback: (result: SyncResult) => void) {
    clearTimeout(this.reverseTimer);
    this.reverseTimer = setTimeout(() => {
      callback(this.reverseConvert(html));
    }, 400);
  }

  destroy() {
    clearTimeout(this.reverseTimer);
  }
}
