import { create } from 'zustand';
import type { ParseError, CompileError, SourceMapEntry } from '@milkly/mkly';
import { resolveBlockLine } from './selection-orchestrator';

type OutputMode = 'web' | 'email';
type ViewMode = 'preview' | 'edit' | 'html';
type Theme = 'light' | 'dark';
type FocusOrigin = 'mkly' | 'html' | 'edit' | 'preview' | 'inspector' | 'block-dock' | null;
type FocusIntent = 'navigate' | 'edit-property' | 'recompile';

interface SelectionState {
  blockLine: number | null;
  blockType: string | null;
  propertyKey: string | null;
  contentRange: [number, number] | null;
}

interface EditorState {
  source: string;
  html: string;
  errors: Array<ParseError | CompileError>;
  outputMode: OutputMode;
  viewMode: ViewMode;
  theme: Theme;
  panelSizes: [number, number, number];
  inspectorCollapsed: boolean;
  cursorLine: number;
  blockDockOpen: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  activeBlockLine: number | null;

  // Rich selection state for cross-pane coordination
  selection: SelectionState;

  // Data-driven focus: which tab last set cursorLine.
  // Each tab reacts to activeBlockLine but skips scroll/highlight
  // when focusOrigin matches itself (to avoid feedback loops).
  focusOrigin: FocusOrigin;

  // Monotonic counter incremented on every focusBlock() call.
  // Tabs use this to detect "new focus event" vs "same focus reacting".
  focusVersion: number;

  // Intent of the current focus event — controls scroll behavior.
  // 'navigate': user clicked/moved to a new block → scroll to it
  // 'edit-property': property inspector edit → suppress all scrolls
  // 'recompile': source changed → preserve scroll positions
  focusIntent: FocusIntent;

  // When true, all cross-pane scrolling is suppressed (e.g. during iframe rewrite)
  scrollLock: boolean;

  // Source map from latest compilation (for line-level sync)
  sourceMap: SourceMapEntry[] | null;

  // Independent word wrap toggles per code editor
  mklyWordWrap: boolean;
  htmlWordWrap: boolean;

  // Round-trip normalization: source is compiled → reverse parsed on first load
  // to ensure stability under html→mkly round-trips
  isNormalized: boolean;
  normalizationWarnings: Array<ParseError>;

  setSource: (source: string) => void;
  setHtml: (html: string) => void;
  setErrors: (errors: Array<ParseError | CompileError>) => void;
  setOutputMode: (mode: OutputMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: Theme) => void;
  setPanelSizes: (sizes: [number, number, number] | ((prev: [number, number, number]) => [number, number, number])) => void;
  setInspectorCollapsed: (collapsed: boolean) => void;
  setCursorLine: (line: number) => void;
  setBlockDockOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setActiveBlockLine: (line: number | null) => void;
  setScrollLock: (locked: boolean) => void;
  setSourceMap: (sourceMap: SourceMapEntry[] | null) => void;
  setMklyWordWrap: (wrap: boolean) => void;
  setHtmlWordWrap: (wrap: boolean) => void;
  setIsNormalized: (normalized: boolean) => void;
  setNormalizationWarnings: (warnings: Array<ParseError>) => void;
  setSelection: (state: Partial<SelectionState>, origin: FocusOrigin) => void;

  // Single entry point: any tab calls this to say "user is at this mkly line"
  focusBlock: (line: number, origin: FocusOrigin, intent?: FocusIntent) => void;
}

const EXAMPLE = `// A sample newsletter — edit this!
// Kits are activated with --- use
// Styles use indentation-based syntax (v2)

--- use: core
--- use: newsletter
--- theme: core/dark

--- style
// Try changing these!
accent: #e2725b
fontBody: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif
radius: 8px

core/heading
  letterSpacing: -0.5px

--- meta
version: 1
title: Weekly Digest
subject: What happened this week

--- core/header
logo: https://milkly.app/logo.png
title: The Weekly Digest

--- core/hero
image: https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200
alt: Weekly digest hero
@bg: #0e111c
@borderRadius: 12px

# This Week in Tech

Your curated roundup of what matters.

--- newsletter/intro

Welcome back! Here's everything you need to know this week, from AI breakthroughs to design tools that'll make your workflow smoother.

--- core/section
title: Features

--- core/card
image: https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400
link: https://example.com/ai

## AI-Friendly Markup

mkly generates **55-60% fewer tokens** than HTML. LLMs produce it reliably thanks to its flat, predictable structure.

--- core/card
link: https://example.com/readable

## Human-Readable

Looks like a config file. Zero learning curve. Edit content without touching HTML or CSS.

--- /core/section

--- newsletter/category
title: Quick Reads

--- newsletter/item
source: The Verge
link: https://example.com/story-1

New browser APIs are making the web faster than ever. Here's what developers need to know about the latest performance improvements.

--- newsletter/item
source: Wired
image: https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=200
link: https://example.com/story-2

The rise of local-first software — why developers are moving away from cloud-only architectures.

--- /newsletter/category

--- newsletter/quickHits

- **TypeScript 6.0** is out with faster type checking
- **Bun 1.3** adds native SQLite support
- **React 20** announced at React Conf

--- newsletter/tipOfTheDay
title: Pro Tip

Use \`mkly\` variables to theme your output without changing content. Pass \`{ variables: { colorAccent: '#e2725b' } }\` to customize colors across all blocks.

--- core/quote
author: A happy developer

mkly changed the way I build content. No more wrestling with HTML tables for email.

--- newsletter/community
author: Sarah Chen

Just shipped our newsletter migration to mkly — went from 200 lines of HTML per issue to about 40 lines of mkly. The AI can now generate entire editions reliably.

--- newsletter/poll
question: What should we cover next week?
option1: Web Components deep dive
option2: Rust for web developers
option3: Design systems in 2026

--- newsletter/sponsor
image: https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400
link: https://example.com/sponsor
label: Try Acme Cloud
@.img/margin: 0 auto 8px

Acme Cloud gives you **10x faster deployments** with zero config. Used by teams at Stripe, Vercel, and Linear.

--- core/cta
url: https://example.com/subscribe
buttonText: Subscribe for More

Enjoyed this issue? Share it with a friend.

--- newsletter/personalNote

Hey! I've been experimenting with mkly for our internal docs too — turns out it works great beyond newsletters. Let me know what you think about this week's picks.

--- newsletter/outro
ctaUrl: https://example.com/archive
ctaText: View Archive

Thanks for reading! See you next week.

--- core/footer

[Unsubscribe](https://example.com/unsub) | [View in browser](https://example.com/web) | Built with **mkly**
`;

export const useEditorStore = create<EditorState>((set) => ({
  source: EXAMPLE,
  html: '',
  errors: [],
  outputMode: 'web',
  viewMode: 'preview',
  theme: 'dark',
  panelSizes: [40, 40, 20],
  inspectorCollapsed: false,
  cursorLine: 1,
  blockDockOpen: false,
  sidebarCollapsed: false,
  sidebarWidth: 260,
  activeBlockLine: null,
  selection: { blockLine: null, blockType: null, propertyKey: null, contentRange: null },
  focusOrigin: null,
  focusVersion: 0,
  focusIntent: 'navigate',
  scrollLock: false,
  sourceMap: null,
  mklyWordWrap: true,
  htmlWordWrap: true,
  isNormalized: false,
  normalizationWarnings: [],

  setSource: (source) => set({ source }),
  setHtml: (html) => set({ html }),
  setErrors: (errors) => set({ errors }),
  setOutputMode: (mode) => set({ outputMode: mode }),
  setViewMode: (mode) => set((state) => ({
    viewMode: mode,
    focusOrigin: null,
    focusVersion: state.activeBlockLine !== null
      ? state.focusVersion + 1 : state.focusVersion,
    focusIntent: 'navigate' as const,
  })),
  setTheme: (theme) => set({ theme }),
  setPanelSizes: (sizes) => set((state) => ({
    panelSizes: typeof sizes === 'function' ? sizes(state.panelSizes) : sizes,
  })),
  setInspectorCollapsed: (collapsed) => set({ inspectorCollapsed: collapsed }),
  setCursorLine: (line) => set({ cursorLine: line }),
  setBlockDockOpen: (open) => set({ blockDockOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(400, width)) }),
  setActiveBlockLine: (line) => set({ activeBlockLine: line }),
  setScrollLock: (locked) => set({ scrollLock: locked }),
  setSourceMap: (sourceMap) => set({ sourceMap }),
  setMklyWordWrap: (wrap) => set({ mklyWordWrap: wrap }),
  setHtmlWordWrap: (wrap) => set({ htmlWordWrap: wrap }),
  setIsNormalized: (normalized) => set({ isNormalized: normalized }),
  setNormalizationWarnings: (warnings) => set({ normalizationWarnings: warnings }),

  setSelection: (partial, origin) => set((state) => ({
    selection: { ...state.selection, ...partial },
    focusOrigin: origin,
    focusVersion: state.focusVersion + 1,
  })),

  focusBlock: (line, origin, intent = 'navigate') => set((state) => {
    const { blockLine, blockType } = resolveBlockLine(line, state.source);
    return {
      cursorLine: line,
      activeBlockLine: blockLine,
      selection: {
        blockLine,
        blockType,
        propertyKey: state.selection.propertyKey,
        contentRange: null,
      },
      focusOrigin: origin,
      focusVersion: state.focusVersion + 1,
      focusIntent: intent,
    };
  }),
}));

export type { FocusOrigin, FocusIntent, SelectionState };
