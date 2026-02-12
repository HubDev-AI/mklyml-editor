const TEXT_EDITABLE = new Set([
  'mkly-core-text', 'mkly-core-heading', 'mkly-core-html',
  'mkly-newsletter-intro', 'mkly-newsletter-personalNote',
  'mkly-newsletter-outro', 'mkly-newsletter-quickHits',
  'mkly-newsletter-recommendations', 'mkly-newsletter-community',
  'mkly-newsletter-tipOfTheDay', 'mkly-newsletter-custom',
  'mkly-core-footer', 'mkly-core-list',
]);

const MIXED_EDITABLE = new Set([
  'mkly-core-quote', 'mkly-core-hero', 'mkly-core-card',
  'mkly-newsletter-featured', 'mkly-newsletter-item',
  'mkly-newsletter-sponsor', 'mkly-core-cta',
]);

// Blocks where only specific child elements are editable (containers, property-driven text)
const PARTIAL_EDITABLE: Record<string, string[]> = {
  'mkly-core-section': ['__title'],
  'mkly-core-header': ['__title'],
  'mkly-newsletter-category': ['__title'],
  'mkly-newsletter-tools': ['__title'],
  'mkly-newsletter-poll': ['__question', '__option'],
};

const NON_EDITABLE = new Set([
  'mkly-core-image', 'mkly-core-button', 'mkly-core-divider',
  'mkly-core-spacer',
]);

function getBlockClass(el: Element): string | undefined {
  const classes = el.className.split(/\s+/);
  return classes.find(c => c.startsWith('mkly-') && !c.includes('__') && !c.includes('--'));
}

export function makeBlocksEditable(doc: Document): void {
  const allBlocks = doc.querySelectorAll('[class*="mkly-"]');
  for (const el of allBlocks) {
    const blockClass = getBlockClass(el);
    if (!blockClass) continue;

    if (el.querySelector('[class*="mkly-"]') && !TEXT_EDITABLE.has(blockClass) && !MIXED_EDITABLE.has(blockClass) && !PARTIAL_EDITABLE[blockClass]) {
      continue;
    }

    if (TEXT_EDITABLE.has(blockClass)) {
      (el as HTMLElement).setAttribute('contenteditable', 'true');
      (el as HTMLElement).setAttribute('data-mkly-editable', blockClass);
    } else if (MIXED_EDITABLE.has(blockClass)) {
      (el as HTMLElement).setAttribute('contenteditable', 'true');
      (el as HTMLElement).setAttribute('data-mkly-editable', blockClass);
      const imgs = el.querySelectorAll('img');
      for (const img of imgs) {
        (img as HTMLElement).setAttribute('contenteditable', 'false');
      }
      const links = el.querySelectorAll('a');
      for (const link of links) {
        (link as HTMLElement).setAttribute('contenteditable', 'false');
      }
    } else if (PARTIAL_EDITABLE[blockClass]) {
      const suffixes = PARTIAL_EDITABLE[blockClass];
      for (const suffix of suffixes) {
        const children = el.querySelectorAll(`.${blockClass}${suffix}`);
        for (const child of children) {
          (child as HTMLElement).setAttribute('contenteditable', 'true');
          (child as HTMLElement).setAttribute('data-mkly-editable', `${blockClass}${suffix}`);
        }
      }
    } else if (NON_EDITABLE.has(blockClass)) {
      (el as HTMLElement).setAttribute('contenteditable', 'false');
      (el as HTMLElement).style.opacity = '0.7';
    }
  }
}

export const EDIT_MODE_CSS = `
[data-mkly-editable]:focus {
  outline: 2px solid rgba(59, 130, 246, 0.5);
  outline-offset: 2px;
  border-radius: 4px;
}
[data-mkly-editable]:hover {
  outline: 1px solid rgba(59, 130, 246, 0.25);
  outline-offset: 2px;
  border-radius: 4px;
}
[contenteditable="false"] {
  opacity: 0.7;
  cursor: default;
  user-select: none;
}
`;
