import { CompletionData } from '../../../mkly/src/index.ts';
interface EditorShellProps {
    completionData: CompletionData;
    documentId?: string;
    persistHistory?: boolean;
}
export declare function EditorShell({ completionData, documentId, persistHistory }: EditorShellProps): import("react/jsx-runtime").JSX.Element;
export {};
