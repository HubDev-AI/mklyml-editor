import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { CompletionData } from '../../mkly/src/index.ts';
export declare function mklyCompletionSource(data: CompletionData): (context: CompletionContext) => CompletionResult | null;
