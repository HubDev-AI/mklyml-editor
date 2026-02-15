import { StreamLanguage } from '@codemirror/language';
type State = 'top' | 'block' | 'style' | 'meta' | 'use' | 'theme';
interface MklyState {
    mode: State;
    afterDelimiter: boolean;
}
export declare const mklyLanguage: StreamLanguage<MklyState>;
export {};
