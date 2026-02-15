import { KitInfo, CompletionData } from '../../../mkly/src/index.ts';
interface KitInfoPanelProps {
    kitName: string;
    kitInfo: KitInfo | undefined;
    completionData?: CompletionData;
}
export declare function KitInfoPanel({ kitName, kitInfo, completionData }: KitInfoPanelProps): import("react/jsx-runtime").JSX.Element;
export {};
