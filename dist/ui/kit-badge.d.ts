export declare const KIT_COLORS: Record<string, {
    bg: string;
    text: string;
    border: string;
}>;
export declare function getKitColors(kitName: string): {
    bg: string;
    text: string;
    border: string;
};
interface KitBadgeProps {
    kit: string;
    size?: 'sm' | 'md';
}
export declare function KitBadge({ kit, size }: KitBadgeProps): import("react/jsx-runtime").JSX.Element;
export {};
