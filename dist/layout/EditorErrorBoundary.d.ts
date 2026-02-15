import { Component, ReactNode } from 'react';
interface Props {
    name: string;
    children: ReactNode;
}
interface State {
    error: Error | null;
}
export declare class EditorErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: Error): State;
    private handleReset;
    render(): string | number | boolean | import("react/jsx-runtime").JSX.Element | Iterable<ReactNode> | null | undefined;
}
export {};
