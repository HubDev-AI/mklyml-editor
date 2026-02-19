import { create } from 'zustand';
import type { ParseError, CompileError, SourceMapEntry, StyleGraph } from '@mklyml/core';
import { resolveBlockLine } from './selection-orchestrator';
import type { UndoInfo } from './undo-manager';

declare global {
  interface Window {
    __editorStore?: unknown;
  }
}

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
  selectionId: string | null;

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
    target: string;        // 'self', 'img', 'link', '>.s1', '>li', etc.
    targetTag?: string;    // exact tag that originated descendant targeting (used for class targets like >.s1)
    label?: string;
    sourceLine: number;    // block's source line — used for cursor adjustment after style changes
    targetLine?: number;   // content element's source line — for deferred class injection
    targetIndex?: number;  // index among same-tag siblings (e.g., 2nd <li> → 1)
    selectionId?: string;  // strict style-pick selection marker (authoritative target identity)
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

export const EXAMPLE_NEWSLETTER = `--- use: core
--- use: newsletter
--- theme: newsletter/light
--- preset: newsletter/editorial

--- meta
version: 1
title: The Pulse AI
subject: AI Is Rewriting the SaaS Playbook

--- core/header
title: The Pulse AI

Your daily brief on the ideas, tools, and breakthroughs shaping artificial intelligence.

--- newsletter/intro
Good morning. This week, something quietly shifted in the software industry. The SaaS companies that built empires on learned interfaces and sticky workflows are watching their moats evaporate in real time. Today we break down exactly why \u2014 and what comes next. Plus: a reasoning model that runs on your laptop, a step-by-step prompt engineering tutorial, and the five headlines you need to see before your morning meeting.

--- newsletter/featured
image: https://images.unsplash.com/photo-1639322537228-f710d846310a?w=800&h=400&fit=crop
source: Analysis
author: The Pulse AI
link: https://example.com/saas-disruption

## AI Is Quietly Dismantling the Three Moats That Built the SaaS Industry
Global SaaS company stocks have taken a major nosedive this year, wiping out hundreds of billions in market value. And while most headlines blame macroeconomic pressure, the real story is far more structural: artificial intelligence is eroding the three competitive moats that made SaaS companies nearly impossible to displace.

**The first moat was learned interfaces.** For decades, products like Salesforce, Adobe, and SAP thrived because users invested months or years learning their specific UIs. Switching meant retraining entire teams. But when an AI agent can operate any interface on a user's behalf, the learning curve disappears. It doesn't matter how complex your product is if the user never has to touch it directly.

**The second moat was custom workflows.** Enterprise SaaS companies locked in customers through deeply customized automations \u2014 hundreds of Zapier integrations, custom fields, approval chains built over years. AI is flattening this advantage. A well-prompted language model can now replicate most of these workflows in minutes, reading documentation and APIs to wire things together on the fly. The switching cost drops from "six-month migration project" to "afternoon experiment."

**The third, and most interesting, moat was data scaffolding.** SaaS products became the system of record. Your CRM held your customer relationships. Your project management tool held your team's institutional knowledge. But AI can now ingest, structure, and query data from any source. The data doesn't need to live inside one product anymore. A retrieval pipeline connected to your raw files can do what a purpose-built SaaS dashboard used to do.

So what survives? Companies with genuinely proprietary data \u2014 Bloomberg terminals, medical imaging databases, satellite feeds \u2014 still have something AI can't easily replicate. Regulatory lock-ins in healthcare and finance create real barriers too. And products that are already becoming AI-native (embedding models deeply into the workflow rather than bolting them on) have a head start. But for the vast middle of the SaaS industry? The next eighteen months are going to be a reckoning.

--- core/spacer
height: 16

--- newsletter/category
title: Today in AI

--- newsletter/item
image: https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=300&h=200&fit=crop
source: arXiv
link: https://example.com/small-reasoning-model

### A 7B Model Just Matched GPT-4 on Math \u2014 And It Runs on a Laptop
Researchers at Stanford released Phi-Reason, a 7-billion parameter model that scores 89% on GSM8K and 72% on MATH, putting it within striking distance of GPT-4's performance on mathematical reasoning tasks. The secret is a new technique called chain-of-thought distillation: they took reasoning traces from a much larger model, compressed them into structured training data, and used that to teach the small model *how* to think, not just what to answer.

The practical implication is significant. Phi-Reason runs comfortably on a MacBook Pro with 32GB of RAM at 12 tokens per second \u2014 fast enough for real-time applications. For companies worried about sending sensitive data to cloud APIs, this opens the door to on-device reasoning that stays entirely within their security perimeter.

--- newsletter/item
image: https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=300&h=200&fit=crop
source: Bloomberg
link: https://example.com/enterprise-ai-spending

### Enterprise AI Spending Hits $180B \u2014 But the Money Is Moving
Bloomberg Intelligence reports that global enterprise AI spending reached $180 billion in 2025, up 47% year-over-year. But the more telling number is *where* the growth is happening. Spending on proof-of-concept projects actually declined 12%, while production deployment budgets nearly doubled.

The biggest winners: data infrastructure tools (up 68%), MLOps platforms (up 54%), and fine-tuning services (up 41%). The biggest losers: AI consulting firms and "AI strategy" advisory services, which saw budgets cut by a third. The message from enterprises is clear: the experimentation phase is over, and the teams that get funded now are the ones shipping to production.

--- newsletter/item
image: https://images.unsplash.com/photo-1555255707-c07966088b7b?w=300&h=200&fit=crop
source: Google DeepMind
link: https://example.com/protein-folding-update

### AlphaFold 3 Can Now Predict How Molecules Interact \u2014 Not Just Their Shape
DeepMind's latest update to AlphaFold moves beyond protein structure prediction to model how proteins interact with DNA, RNA, and small molecules with near-experimental accuracy. Previous versions could tell you what a protein looked like; AlphaFold 3 can now tell you what it *does* when it encounters another molecule.

For drug discovery, this is transformative. Pharmaceutical companies typically spend months in wet labs testing molecular interactions. AlphaFold 3 can simulate thousands of these interactions in hours, dramatically narrowing the field of candidates before a single test tube is touched. Two major pharma companies have already announced partnerships to integrate the tool into their early-stage drug pipelines.

--- /newsletter/category

--- core/divider

--- newsletter/sponsor
image: https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=250&fit=crop
link: https://example.com/sponsor-datastack
label: Start your free trial

Power your AI pipeline with **DataStack Cloud**. From ingestion to fine-tuning, one platform handles your entire data workflow. Teams using DataStack ship models to production 3x faster, with built-in versioning, monitoring, and rollback. Trusted by 2,000+ AI teams worldwide.

--- core/divider

--- newsletter/tipOfTheDay
title: Tutorial: The 3-Layer Prompt Framework

Most prompts fail because they dump everything into one block of text. Here's a structured framework that consistently produces better results across any model:

**Layer 1 \u2014 Role &amp; Context.** Start by telling the model who it is and what situation it's in. Example: *"You are a senior data analyst at a fintech company. You're preparing a quarterly board presentation."*

**Layer 2 \u2014 Task &amp; Constraints.** Be specific about what you want and what the boundaries are. Example: *"Analyze the attached CSV of transaction data. Identify the top 3 revenue trends and the top 3 risk signals. Do not speculate beyond what the data shows."*

**Layer 3 \u2014 Format &amp; Tone.** Tell it exactly how to structure the output. Example: *"Present findings as a bulleted executive summary (max 200 words), followed by a detailed appendix with supporting data points. Use a professional but accessible tone."*

The key insight is that each layer answers a different question: Layer 1 answers "who am I?", Layer 2 answers "what should I do?", and Layer 3 answers "how should I present it?" When you separate these concerns, the model can reason about each independently, which dramatically reduces hallucination and off-target responses.

--- newsletter/quickHits
## Quick Hits
*   **Anthropic** raised $2B at a $60B valuation, with backing from Google and Salesforce Ventures. The round makes it the second most valuable AI startup behind OpenAI.

*   **Meta** open-sourced their internal code review AI, trained on 10 years of internal diffs and code comments. Early benchmarks show it catches 34% more bugs than existing linters.

*   **NVIDIA** announced the B300 chip with 2x the inference throughput of the B200 at the same power draw. Pre-orders are already sold out through Q3.

*   **Apple** quietly shipped on-device summarization for Mail, Messages, and Safari in iOS 19 beta 3. The models run entirely on the Neural Engine with zero cloud dependency.

*   **EU AI Act** enforcement has officially begun. The first compliance audits target high-risk systems in hiring, credit scoring, and medical diagnostics. Fines can reach 7% of global revenue.

--- newsletter/tools
title: Tools &amp; Resources

--- newsletter/item
source: GitHub
link: https://example.com/tool-llamacpp

### llama.cpp v4.0 \u2014 Run 70B Models on Consumer GPUs
The latest release introduces 2-bit quantization with minimal quality loss and a new speculative decoding engine. Benchmarks show 40 tokens per second on an RTX 4090 for Llama 3 70B \u2014 fast enough for real-time chat applications. The memory footprint dropped to 24GB, making it feasible on a single consumer GPU for the first time.

--- newsletter/item
source: Hugging Face
link: https://example.com/tool-datasets

### Open Dataset Hub \u2014 50K+ Curated Datasets for Fine-Tuning
Hugging Face launched a curated dataset collection with quality scores, license metadata, and one-click integration with popular training frameworks. Each dataset comes with a data card showing distribution statistics, known biases, and recommended use cases. Filter by domain, language, task type, and license.

--- /newsletter/tools

--- core/divider

--- newsletter/poll
question: What's your biggest challenge with AI in production?
option1: Data quality and labeling
option2: Cost management at scale
option3: Latency and reliability
option4: Compliance and governance

--- newsletter/community
author: Maria Chen, ML Engineer

I switched from running my own fine-tuning infrastructure to using managed endpoints six months ago. My team's iteration speed went from weekly deployments to multiple times per day. The cost is slightly higher per inference call, but the engineering time saved more than makes up for it. We eliminated two full-time positions that were just maintaining GPU clusters, and redirected those engineers to actually building features. Don't underestimate the hidden cost of infrastructure ownership.

--- newsletter/personalNote
I've been thinking a lot about the SaaS disruption piece this week, and here's what keeps nagging at me: the founders I talk to aren't scared of AI replacing their *product*. They're scared of AI replacing the *reason users open their product in the first place*.

Think about it. Nobody opens a project management tool because they love the interface. They open it because their tasks live there. If an AI agent can pull those tasks from anywhere, surface the right ones at the right time, and mark them complete without you ever visiting a dashboard \u2014 what's the dashboard for?

The companies that will win are the ones building the intelligence layer itself, not wrapping AI features around an existing UI. That's a hard pill for a lot of startups to swallow, but the data is increasingly hard to argue with.

--- newsletter/recommendations
title: Weekend Reads
- {@url:https://example.com/read-1}Attention Is All You Need \u2014 Revisited{/} \u2014 A retrospective from the original Transformer paper authors, eight years later. They discuss what they got right, what surprised them, and what they'd do differently today.

- {@url:https://example.com/read-2}The Hidden Costs of "Free" AI APIs{/} \u2014 Rate limits, deprecation cycles, and vendor lock-in are the real price. This deep dive calculates the true total cost of ownership for three different API providers over a two-year period.

- {@url:https://example.com/read-3}Building AI Products That Survive the Hype Cycle{/} \u2014 Lessons from companies that shipped AI features in 2023 and are still iterating today. The common thread: they solved boring problems really well.

--- core/divider

--- newsletter/outro
ctaUrl: https://example.com/share
ctaText: Share The Pulse AI

## Thanks for Reading
If today's issue gave you something to think about, forward it to a colleague who's building with AI. Every share helps us keep this newsletter free and independent. See you tomorrow.

--- core/footer
The Pulse AI | &copy; 2026 All Rights Reserved.
You're receiving this because you signed up at thepulseai.com

{@url:https://example.com/privacy}Privacy Policy{/} | {@url:https://example.com/preferences}Manage Preferences{/} | {@url:https://example.com/unsubscribe}Unsubscribe{/}
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
  source: '',
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
  selectionId: null,
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
  setViewMode: (mode) => set((state) => {
    const { blockLine, blockType } = resolveBlockLine(state.cursorLine, state.source);
    return {
      viewMode: mode,
      activeBlockLine: blockLine,
      selection: {
        blockLine,
        blockType,
        propertyKey: state.selection.propertyKey,
        contentRange: null,
      },
      focusOrigin: null,
      focusVersion: blockLine !== null
        ? state.focusVersion + 1 : state.focusVersion,
      focusIntent: 'navigate' as const,
    };
  }),
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
    const nextSelectionId = `sel-${state.focusVersion + 1}`;
    let nextStylePopup = state.stylePopup;

    // If popup is open and user selected another block from elsewhere, retarget popup
    // to that block and keep selection identity aligned with the global selection flow.
    if (nextStylePopup && blockLine !== null && origin !== 'inspector') {
      const popupBlockLine = resolveBlockLine(nextStylePopup.sourceLine, state.source).blockLine;
      if (popupBlockLine !== blockLine) {
        nextStylePopup = {
          ...nextStylePopup,
          blockType: blockType ?? nextStylePopup.blockType,
          sourceLine: blockLine,
          target: 'self',
          targetTag: undefined,
          label: undefined,
          targetLine: undefined,
          targetIndex: undefined,
          selectionId: nextSelectionId,
        };
      }
    }

    return {
      cursorLine: line,
      activeBlockLine: blockLine,
      selectionId: nextSelectionId,
      selection: {
        blockLine,
        blockType,
        propertyKey: state.selection.propertyKey,
        contentRange: null,
      },
      focusOrigin: origin,
      focusVersion: state.focusVersion + 1,
      focusIntent: intent,
      stylePopup: nextStylePopup,
    };
  }),

  undo: () => _undoHandlers.undo(),
  redo: () => _undoHandlers.redo(),
  flushUndo: () => _undoHandlers.flush(),
  clearHistory: () => _undoHandlers.clear(),
}));

// Expose store on window for E2E tests
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e')) {
  window.__editorStore = useEditorStore;
}

export type { FocusOrigin, FocusIntent, SelectionState };
