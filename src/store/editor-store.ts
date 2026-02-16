import { create } from 'zustand';
import type { ParseError, CompileError, SourceMapEntry, StyleGraph } from '@mklyml/core';
import { resolveBlockLine } from './selection-orchestrator';
import type { UndoInfo } from './undo-manager';

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

  // Computed CSS styles of the active block element in the preview iframe.
  // Used by the style editor to show inherited/theme values as placeholders.
  computedStyles: Record<string, string>;

  // StyleGraph from latest compilation — canonical style model for the document
  styleGraph: StyleGraph | null;

  // Independent word wrap toggles per code editor
  mklyWordWrap: boolean;
  htmlWordWrap: boolean;

  // Round-trip normalization: source is compiled → reverse parsed on first load
  // to ensure stability under html→mkly round-trips
  isNormalized: boolean;
  normalizationWarnings: Array<ParseError>;

  // Style pick mode: click elements in preview to open floating style popup
  stylePickMode: boolean;
  stylePopup: {
    blockType: string;
    target: string;        // 'self', 'img', 'link', etc.
    label?: string;
    anchorRect: { x: number; y: number; width: number; height: number };
  } | null;

  // Persistent undo/redo
  documentId: string;
  canUndo: boolean;
  canRedo: boolean;
  undoInfo: UndoInfo;

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
  setComputedStyles: (styles: Record<string, string>) => void;
  setStyleGraph: (graph: StyleGraph | null) => void;
  setMklyWordWrap: (wrap: boolean) => void;
  setHtmlWordWrap: (wrap: boolean) => void;
  setIsNormalized: (normalized: boolean) => void;
  setNormalizationWarnings: (warnings: Array<ParseError>) => void;
  setSelection: (state: Partial<SelectionState>, origin: FocusOrigin) => void;
  setStylePickMode: (mode: boolean) => void;
  openStylePopup: (info: EditorState['stylePopup']) => void;
  closeStylePopup: () => void;

  // Single entry point: any tab calls this to say "user is at this mkly line"
  focusBlock: (line: number, origin: FocusOrigin, intent?: FocusIntent) => void;

  // Persistent undo/redo (implementations registered by useUndoInit hook)
  undo: () => boolean;
  redo: () => boolean;
  flushUndo: () => void;
  clearHistory: () => void;
}

const EXAMPLE = `--- use: core
--- use: newsletter
--- theme: newsletter/graphite
--- preset: newsletter/editorial

--- meta
version: 1
title: The Cat's Meow Newsletter
subject: Your Weekly Dose of Feline Fun & Facts

--- style
primary: #4A3728 // Dark brown
accent: #D4A574 // Golden tan
body
  bg: #F7F3EB // Light cream background
  fg: #333333 // Dark grey for text

newsletter/header
  bg: $primary
  fg: white
  padding: 24px

newsletter/intro
  padding: 24px 0
  border-bottom: 1px solid #EEEEEE

newsletter/featured
  .image
    rounded: 8px
  .source
    fg: $accent
    font-weight: bold
  padding: 32px 0

newsletter/category
  padding: 32px 0
  .heading
    fg: $primary
    border-bottom: 2px solid $accent
    padding-bottom: 8px
    margin-bottom: 24px

newsletter/item
  .image
    rounded: 4px
  .source
    fg: $accent
    font-size: 0.9em
  margin-bottom: 24px

newsletter/quickHits
  padding: 24px
  rounded: 8px
  .heading
    fg: $primary

newsletter/outro
  padding: 32px
  rounded: 8px
  .cta
    bg: $accent
    fg: white
    rounded: 5px
    padding: 12px 24px
    text-decoration: none
    display: inline-block
    :hover
      bg: darken($accent, 10%)

core/footer
  bg: $primary
  fg: white
  padding: 24px
  text-align: center

--- core/header
title: logo:
title: The Cat's Meow Newsletter

A weekly purr-fect collection of news, tips, and adorable cat content straight to your inbox!

--- newsletter/intro
Welcome to this week's edition of The Cat's Meow! We're diving into some fascinating feline stories, from mysterious bald kittens to the surprising ways our pets can influence nature. Get ready for your dose of all things cat!

--- core/spacer
height: 24

--- newsletter/featured
image: https://i.chzbgr.com/original/44317445/h8B09E0AB/kittens-where-one-is-born-mysteriously-hairless-thumbnail-includes-one-picture-of-newborn-kittens
source: cheezburger.com
author: Blake Seidel
link: https://cheezburger.com/44317445/shes-bald-mother-of-two-tabby-cats-has-a-healthy-litter-of-kittens-but-quickly-realizes-that-one-of

## 'She's bald!': Mother of two tabby cats has a healthy litter of kittens, but quickly realizes that one of her healthy babies is not like the others
It's not nice to call a beautiful young lady "bald," even if she is! We're not going to sit here and pretend like we're expurrt geneticists, but we do know a thing or two about cats, so that's where we come in. This week, we're highlighting the story of a mother cat with a healthy litter, but one very unique kitten.

--- core/spacer
height: 32

--- newsletter/category
title: Latest News &amp; Feline Finds

--- newsletter/item
image: https://i.chzbgr.com/original/44307973/h95341854/31-pictures-of-cats-refusing-cuddles-thumbnail-includes-two-pictures-of-cats-refusing-cuddles
source: cheezburger.com
link: https://cheezburger.com/44307973/31-feisty-photos-of-spicy-cats-proving-their-cuddles-are-conditional-at-best

### 31 Feisty Photos of Spicy Cats Proving Their Cuddles Are Conditional at Best
Out of all the creatures we let live in our house, cats are the best at saying "no." Dogs always want your love and affection. If they had it their way, they would be glued to your side 24 hours a day, 7 days a week. Cats? Not so much. Dive into this hilarious collection of cats setting their boundaries.

--- newsletter/item
image: https://www.sciencedaily.com/images/1920/caenoplana-variegata.webp
source: science-daily
link: https://www.sciencedaily.com/releases/2026/02/260210231550.htm

### Scientists discover pets are helping an invasive flatworm spread
A new study shows that dogs and cats may be helping an invasive flatworm spread. Researchers analyzing over a decade of reports discovered the worm attached to pet fur. Its sticky mucus and ability to survive in various environments make it a formidable invader. Learn more about this surprising discovery.

--- newsletter/item
image: https://i.chzbgr.com/original/44303109/h70F56A3A/out-hes-been-waiting-for-me-to-go-to-sleep-then-licking-the-tip-of-the-olive-oil-bottle-all-night
source: cheezburger.com
link: https://cheezburger.com/44303109/confused-owner-who-doesnt-understand-why-her-chonky-cat-is-not-losing-weight-catches-the-cat-licking

### Confused owner who doesn't understand why her chonky cat is not losing weight catches the cat licking the olive oil bottle in the middle of the night...
The word "diet" is not part of any cat's vocabulary, and they refuse to learn it. We will start this by saying that chonky cats are amazing. And we love them. And they exist. Read about one owner's hilarious struggle to understand her cat's late-night snacking habits.

--- newsletter/item
image: https://www.cnet.com/a/img/resize/5afd01a9b3021cd3e2440a06f166ce30817a79a8/hub/2024/10/07/3b36e9f2-4d10-4847-a3f3-0fbc7d08c5e8/gettyimages-1365457057.jpg?auto=webp&amp;fit=crop&amp;height=675&amp;width=1200
source: cnet
link: https://www.cnet.com/home/pet-friendly-nontoxic-houseplants/

### 7 Pet-Friendly Houseplants That Are Safe for Cats and Dogs
Don't take a chance with toxic houseplants. Opt for a pet-safe plant to keep your furry family safe. This guide provides excellent options for greening your home without endangering your beloved pets.

--- /newsletter/category

--- core/divider

--- newsletter/quickHits
## Did You Know?
*   Cats can make over 100 different sounds, whereas dogs can only make about 10.

*   A group of cats is called a "clowder."

*   Cats sleep for about 70% of their lives.

*   The oldest cat on record lived to be 38 years old!

--- core/divider

--- newsletter/outro
ctaUrl: https://www.example.com/subscribe
ctaText: Join Our Community

## That's a Wrap for This Week!
Thank you for tuning into The Cat's Meow! We hope you enjoyed this week's collection of all things feline. Don't forget to share your favorite cat stories with us!

--- core/footer
The Cat's Meow Newsletter | &copy; 2024 All Rights Reserved.
Questions? Contact us at info@catsmeow.com

{@url:https://www.example.com/privacy}Privacy Policy{/} | {@url:https://www.example.com/unsubscribe}Unsubscribe{/}
`;

// Undo handlers registered by useUndoInit hook — no undo logic in the store.
let _undoHandlers = {
  undo: (): boolean => false,
  redo: (): boolean => false,
  flush: (): void => {},
  clear: (): void => {},
};

export function registerUndoHandlers(handlers: typeof _undoHandlers): void {
  _undoHandlers = handlers;
}

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
  computedStyles: {},
  styleGraph: null,
  mklyWordWrap: true,
  htmlWordWrap: true,
  isNormalized: false,
  normalizationWarnings: [],
  stylePickMode: false,
  stylePopup: null,
  documentId: '_default',
  canUndo: false,
  canRedo: false,
  undoInfo: { position: 0, total: 0, storageBytes: 0 },

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
  setComputedStyles: (styles) => set({ computedStyles: styles }),
  setStyleGraph: (graph) => set({ styleGraph: graph }),
  setMklyWordWrap: (wrap) => set({ mklyWordWrap: wrap }),
  setHtmlWordWrap: (wrap) => set({ htmlWordWrap: wrap }),
  setIsNormalized: (normalized) => set({ isNormalized: normalized }),
  setNormalizationWarnings: (warnings) => set({ normalizationWarnings: warnings }),

  setSelection: (partial, origin) => set((state) => ({
    selection: { ...state.selection, ...partial },
    focusOrigin: origin,
    focusVersion: state.focusVersion + 1,
  })),

  setStylePickMode: (mode) => set(mode ? { stylePickMode: true } : { stylePickMode: false, stylePopup: null }),
  openStylePopup: (info) => set({ stylePopup: info }),
  closeStylePopup: () => set({ stylePopup: null }),

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

  undo: () => _undoHandlers.undo(),
  redo: () => _undoHandlers.redo(),
  flushUndo: () => _undoHandlers.flush(),
  clearHistory: () => _undoHandlers.clear(),
}));

export type { FocusOrigin, FocusIntent, SelectionState };
