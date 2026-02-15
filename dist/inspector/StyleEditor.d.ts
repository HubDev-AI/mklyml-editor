import { StyleGraph, TargetInfo } from '../../../mkly/src/index.ts';
interface StyleEditorProps {
    blockType: string;
    label?: string;
    styleGraph: StyleGraph | null;
    computedStyles: Record<string, string>;
    targets?: Record<string, TargetInfo>;
    styleHints?: Record<string, string[]>;
    onStyleChange: (blockType: string, target: string, prop: string, value: string, label?: string) => void;
}
export declare function StyleEditor({ blockType, label, styleGraph, computedStyles, targets, styleHints, onStyleChange }: StyleEditorProps): import("react/jsx-runtime").JSX.Element;
declare function StyleRow({ label, children }: {
    label: string;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export { StyleRow };
