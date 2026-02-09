import { PropertyField } from './PropertyField';
import type { CompletionData } from '@milkly/mkly';

interface PropertyFormProps {
  blockType: string;
  properties: Record<string, string>;
  completionData: CompletionData;
  onPropertyChange: (key: string, value: string) => void;
}

export function PropertyForm({ blockType, properties, completionData, onPropertyChange }: PropertyFormProps) {
  const propDefs = completionData.properties.get(blockType);

  if (!propDefs || propDefs.length === 0) {
    return (
      <div style={{
        padding: '12px 14px',
        fontSize: 12,
        color: 'var(--ed-text-muted)',
        fontStyle: 'italic',
      }}>
        This block has no configurable properties.
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 10 }}>
      {propDefs.map((prop) => (
        <PropertyField
          key={prop.label}
          name={prop.label}
          value={properties[prop.label] ?? ''}
          description={prop.description}
          onChange={(v) => onPropertyChange(prop.label, v)}
        />
      ))}
    </div>
  );
}
