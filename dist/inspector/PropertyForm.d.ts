import { CompletionData } from '../../../mkly/src/index.ts';
interface PropertyFormProps {
    blockType: string;
    properties: Record<string, string>;
    completionData: CompletionData;
    onPropertyChange: (key: string, value: string) => void;
}
export declare function PropertyForm({ blockType, properties, completionData, onPropertyChange }: PropertyFormProps): import("react/jsx-runtime").JSX.Element;
export {};
