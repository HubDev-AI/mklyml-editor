import type { MklyIconProps } from './icon-types';
import type { CompletionData } from '@milkly/mkly';

const defaults = { size: 16 };

function I({ size = defaults.size, children, ...props }: MklyIconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Core block icons (15)
// ---------------------------------------------------------------------------
export const IconHeading = (p: MklyIconProps) => <I {...p}><text x="2" y="12" fill="currentColor" stroke="none" fontSize="12" fontWeight="700" fontFamily="sans-serif">H</text></I>;
export const IconText = (p: MklyIconProps) => <I {...p}><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="12" y2="8"/><line x1="2" y1="12" x2="10" y2="12"/></I>;
export const IconImage = (p: MklyIconProps) => <I {...p}><rect x="2" y="3" width="12" height="10" rx="2"/><circle cx="5.5" cy="6.5" r="1" fill="currentColor" stroke="none"/><path d="M2 11l3-3 2 2 3-3 4 4"/></I>;
export const IconButton = (p: MklyIconProps) => <I {...p}><rect x="2" y="5" width="12" height="6" rx="3"/><line x1="6" y1="8" x2="10" y2="8"/></I>;
export const IconDivider = (p: MklyIconProps) => <I {...p}><line x1="2" y1="8" x2="14" y2="8"/></I>;
export const IconSpacer = (p: MklyIconProps) => <I {...p}><line x1="8" y1="2" x2="8" y2="6"/><line x1="6" y1="4" x2="10" y2="4"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="6" y1="12" x2="10" y2="12"/></I>;
export const IconCode = (p: MklyIconProps) => <I {...p}><polyline points="5,4 2,8 5,12"/><polyline points="11,4 14,8 11,12"/><line x1="9" y1="3" x2="7" y2="13"/></I>;
export const IconQuote = (p: MklyIconProps) => <I {...p}><path d="M3 5h3c0 3-1 5-3 6"/><path d="M10 5h3c0 3-1 5-3 6"/></I>;
export const IconHero = (p: MklyIconProps) => <I {...p}><rect x="1" y="2" width="14" height="12" rx="2"/><line x1="4" y1="7" x2="12" y2="7"/><line x1="5" y1="10" x2="11" y2="10"/></I>;
export const IconSection = (p: MklyIconProps) => <I {...p}><path d="M4 2v12"/><path d="M12 2v12"/><line x1="4" y1="2" x2="6" y2="2"/><line x1="4" y1="14" x2="6" y2="14"/><line x1="10" y1="2" x2="12" y2="2"/><line x1="10" y1="14" x2="12" y2="14"/></I>;
export const IconCard = (p: MklyIconProps) => <I {...p}><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="5" y1="10" x2="11" y2="10"/></I>;
export const IconList = (p: MklyIconProps) => <I {...p}><circle cx="3" cy="4" r="1" fill="currentColor" stroke="none"/><line x1="6" y1="4" x2="14" y2="4"/><circle cx="3" cy="8" r="1" fill="currentColor" stroke="none"/><line x1="6" y1="8" x2="14" y2="8"/><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><line x1="6" y1="12" x2="14" y2="12"/></I>;
export const IconHeader = (p: MklyIconProps) => <I {...p}><rect x="1" y="2" width="14" height="5" rx="1.5"/><line x1="4" y1="4.5" x2="8" y2="4.5"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="2" y1="13" x2="10" y2="13"/></I>;
export const IconFooter = (p: MklyIconProps) => <I {...p}><line x1="2" y1="3" x2="14" y2="3"/><line x1="2" y1="6" x2="10" y2="6"/><rect x="1" y="9" width="14" height="5" rx="1.5"/><line x1="4" y1="11.5" x2="12" y2="11.5"/></I>;
export const IconCta = (p: MklyIconProps) => <I {...p}><circle cx="8" cy="8" r="6"/><polyline points="7,6 10,8 7,10"/></I>;

// ---------------------------------------------------------------------------
// Newsletter block icons (14)
// ---------------------------------------------------------------------------
export const IconIntro = (p: MklyIconProps) => <I {...p}><path d="M2 4c2 0 3 1 3 3s-1 3-3 3"/><line x1="7" y1="5" x2="14" y2="5"/><line x1="7" y1="8" x2="12" y2="8"/><line x1="7" y1="11" x2="10" y2="11"/></I>;
export const IconFeatured = (p: MklyIconProps) => <I {...p}><polygon points="8,1.5 9.8,5.5 14,6 10.8,9 11.8,14 8,11.5 4.2,14 5.2,9 2,6 6.2,5.5" fill="none"/></I>;
export const IconCategory = (p: MklyIconProps) => <I {...p}><path d="M2 3h5v5H2z"/><line x1="9" y1="4" x2="14" y2="4"/><line x1="9" y1="7" x2="12" y2="7"/><path d="M2 10h5v4H2z"/><line x1="9" y1="11" x2="14" y2="11"/></I>;
export const IconItem = (p: MklyIconProps) => <I {...p}><rect x="2" y="3" width="12" height="10" rx="1.5"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="9" y2="9"/></I>;
export const IconQuickHits = (p: MklyIconProps) => <I {...p}><path d="M8 1v5l2-2"/><path d="M8 6l-2-2"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="2" y1="13" x2="14" y2="13"/></I>;
export const IconTools = (p: MklyIconProps) => <I {...p}><path d="M10.5 2.5l3 3-7.5 7.5-3-3z"/><path d="M3 13l3-3"/></I>;
export const IconTipOfTheDay = (p: MklyIconProps) => <I {...p}><path d="M5 10V8.5C5 6.5 6 5 8 4c2 1 3 2.5 3 4.5V10"/><rect x="5" y="10" width="6" height="2" rx="1"/><line x1="7" y1="12" x2="7" y2="14"/><line x1="9" y1="12" x2="9" y2="14"/><path d="M6 2L8 1l2 1"/></I>;
export const IconCommunity = (p: MklyIconProps) => <I {...p}><circle cx="6" cy="5" r="2"/><circle cx="11" cy="5" r="2"/><path d="M2 13c0-3 2-4 4-4s4 1 4 4"/><path d="M9 13c0-3 1-4 2-4s3 1 3 4"/></I>;
export const IconPersonalNote = (p: MklyIconProps) => <I {...p}><path d="M12 2l2 2-8 8H4v-2z"/><line x1="10" y1="4" x2="12" y2="6"/></I>;
export const IconPoll = (p: MklyIconProps) => <I {...p}><rect x="2" y="9" width="3" height="5" rx="0.5"/><rect x="6.5" y="5" width="3" height="9" rx="0.5"/><rect x="11" y="2" width="3" height="12" rx="0.5"/></I>;
export const IconRecommendations = (p: MklyIconProps) => <I {...p}><path d="M4 8l2 2 6-6"/><rect x="2" y="2" width="12" height="12" rx="2"/></I>;
export const IconSponsor = (p: MklyIconProps) => <I {...p}><path d="M2 4l3-2h6l3 2v2l-6 8-6-8z"/></I>;
export const IconOutro = (p: MklyIconProps) => <I {...p}><path d="M2 8c1 0 2-.5 3-2s2-2 3 0 2 2 3 0 2-2 3-2"/><line x1="2" y1="12" x2="14" y2="12"/></I>;
export const IconCustom = (p: MklyIconProps) => <I {...p}><path d="M6.5 2L2 6v4l4.5 4h3L14 10V6L9.5 2z"/><circle cx="8" cy="8" r="2"/></I>;

// ---------------------------------------------------------------------------
// UI chrome icons (6)
// ---------------------------------------------------------------------------
export const IconSun = (p: MklyIconProps) => <I {...p}><circle cx="8" cy="8" r="3"/><line x1="8" y1="1.5" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="14.5"/><line x1="1.5" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="14.5" y2="8"/><line x1="3.3" y1="3.3" x2="4.4" y2="4.4"/><line x1="11.6" y1="11.6" x2="12.7" y2="12.7"/><line x1="3.3" y1="12.7" x2="4.4" y2="11.6"/><line x1="11.6" y1="4.4" x2="12.7" y2="3.3"/></I>;
export const IconMoon = (p: MklyIconProps) => <I {...p}><path d="M13.5 9A5.5 5.5 0 0 1 7 2.5 6 6 0 1 0 13.5 9Z"/></I>;
export const IconWeb = (p: MklyIconProps) => <I {...p}><circle cx="8" cy="8" r="6"/><ellipse cx="8" cy="8" rx="3" ry="6"/><line x1="2" y1="8" x2="14" y2="8"/></I>;
export const IconEmail = (p: MklyIconProps) => <I {...p}><rect x="2" y="3" width="12" height="10" rx="1.5"/><polyline points="2,4 8,9 14,4"/></I>;
export const IconPlus = (p: MklyIconProps) => <I {...p}><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></I>;
export const IconSearch = (p: MklyIconProps) => <I {...p}><circle cx="7" cy="7" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></I>;
export const IconWordWrap = (p: MklyIconProps) => <I {...p}><line x1="2" y1="4" x2="14" y2="4"/><path d="M2 8h10a2 2 0 0 1 0 4H10"/><polyline points="11,14 10,12 11,10"/><line x1="2" y1="12" x2="6" y2="12"/></I>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export const BLOCK_ICONS: Record<string, (p: MklyIconProps) => React.JSX.Element> = {
  // Core
  heading: IconHeading, text: IconText, image: IconImage, button: IconButton,
  divider: IconDivider, spacer: IconSpacer, code: IconCode, quote: IconQuote,
  hero: IconHero, section: IconSection, card: IconCard, list: IconList,
  header: IconHeader, footer: IconFooter, cta: IconCta,
  // Newsletter
  intro: IconIntro, featured: IconFeatured, category: IconCategory, item: IconItem,
  quickHits: IconQuickHits, tools: IconTools, tipOfTheDay: IconTipOfTheDay,
  community: IconCommunity, personalNote: IconPersonalNote, poll: IconPoll,
  recommendations: IconRecommendations, sponsor: IconSponsor, outro: IconOutro,
  custom: IconCustom,
};

/**
 * Look up icon component for a block. Uses the `icon` field from BlockDocs
 * (provided by kits) when available, falls back to short name match.
 */
export function getBlockIcon(blockType: string, data?: CompletionData): (p: MklyIconProps) => React.JSX.Element {
  const docs = data?.docs.get(blockType);
  const iconName = docs?.icon ?? (blockType.includes('/') ? blockType.split('/')[1] : blockType);
  return BLOCK_ICONS[iconName] ?? IconCustom;
}

// ---------------------------------------------------------------------------
// Block icon colors — derived from kit-provided BlockDocs.color
// ---------------------------------------------------------------------------
const DEFAULT_ICON_COLOR = { color: 'var(--ed-accent)', bg: 'rgba(226, 114, 91, 0.12)' };

/** Convert a hex color to an rgba bg tint at 12% opacity */
function hexToBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

/**
 * Get icon color for a block. Reads `color` from BlockDocs (provided by kits).
 * Falls back to the default accent color for unknown blocks.
 */
export function getBlockIconColor(blockType: string, data?: CompletionData): { color: string; bg: string } {
  const docs = data?.docs.get(blockType);
  if (docs?.color) {
    return { color: docs.color, bg: hexToBg(docs.color) };
  }
  return DEFAULT_ICON_COLOR;
}
