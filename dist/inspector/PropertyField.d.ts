import { PropertyType } from '../../../mkly/src/index.ts';
interface PropertyFieldProps {
    name: string;
    value: string;
    description?: string;
    propType?: PropertyType;
    optional?: boolean;
    options?: string[];
    onChange: (value: string) => void;
}
export declare function PropertyField({ name, value, description, propType, optional, options, onChange }: PropertyFieldProps): import("react/jsx-runtime").JSX.Element;
export {};
