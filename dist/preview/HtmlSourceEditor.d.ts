interface HtmlSourceEditorProps {
    value: string;
    onChange: (html: string) => void;
    readOnly?: boolean;
}
export declare function HtmlSourceEditor({ value, onChange, readOnly }: HtmlSourceEditorProps): import("react/jsx-runtime").JSX.Element;
export {};
