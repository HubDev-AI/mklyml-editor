import { DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { CompletionData } from '../../../mkly/src/index.ts';
/**
 * CodeMirror ViewPlugin that colors block type names on `--- blockType` lines
 * using the color defined in BlockDocs (from kits). Unknown blocks get no color.
 */
export declare function blockColorPlugin(data: CompletionData): ViewPlugin<{
    decorations: DecorationSet;
    update(update: ViewUpdate): void;
}, undefined>;
