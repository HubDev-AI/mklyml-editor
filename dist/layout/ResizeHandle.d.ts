interface ResizeHandleProps {
    onResize: (delta: number) => void;
    direction?: 'horizontal' | 'vertical';
}
export declare function ResizeHandle({ onResize, direction }: ResizeHandleProps): import("react/jsx-runtime").JSX.Element;
export {};
