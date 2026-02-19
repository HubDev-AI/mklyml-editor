declare module '@mklyml/kits/newsletter' {
  import type { MklyKit } from '@mklyml/core';

  export const NEWSLETTER_KIT: MklyKit;
}

declare module '@mklyml/plugins/email' {
  import type { MklyPlugin } from '@mklyml/core';

  export function emailPlugin(options?: { trackingPrefix?: string }): MklyPlugin;
}
