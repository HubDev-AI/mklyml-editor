import { MklyIconProps } from './icon-types';
import { CompletionData } from '../../../mkly/src/index.ts';
export declare const IconHeading: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconText: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconImage: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconButton: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconDivider: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconSpacer: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconCode: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconQuote: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconHero: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconSection: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconCard: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconList: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconHeader: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconFooter: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconCta: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconIntro: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconFeatured: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconCategory: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconItem: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconQuickHits: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconTools: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconTipOfTheDay: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconCommunity: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconPersonalNote: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconPoll: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconRecommendations: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconSponsor: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconOutro: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconCustom: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconTheme: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconPreset: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconSun: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconMoon: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconWeb: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconEmail: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconPlus: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconSearch: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconWordWrap: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconUndo: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const IconRedo: (p: MklyIconProps) => import("react/jsx-runtime").JSX.Element;
export declare const BLOCK_ICONS: Record<string, (p: MklyIconProps) => React.JSX.Element>;
/**
 * Look up icon component for a block. Uses the `icon` field from BlockDocs
 * (provided by kits) when available, falls back to short name match.
 */
export declare function getBlockIcon(blockType: string, data?: CompletionData): (p: MklyIconProps) => React.JSX.Element;
/**
 * Get icon color for a block. Reads `color` from BlockDocs (provided by kits).
 * Falls back to the default accent color for unknown blocks.
 */
export declare function getBlockIconColor(blockType: string, data?: CompletionData): {
    color: string;
    bg: string;
};
