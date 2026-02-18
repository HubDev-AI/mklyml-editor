import { useState } from 'react';
import { PropertyField } from './PropertyField';
import type { CompletionData } from '@mklyml/core';

interface PropertyFormProps {
  blockType: string;
  properties: Record<string, string>;
  completionData: CompletionData;
  onPropertyChange: (key: string, value: string) => void;
}

export function PropertyForm({ blockType, properties, completionData, onPropertyChange }: PropertyFormProps) {
  const propDefs = completionData.properties.get(blockType);
  const [showOptional, setShowOptional] = useState(false);

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

  const required = propDefs.filter(p => !p.optional);
  const optional = propDefs.filter(p => p.optional);

  return (
    <div style={{ paddingTop: 10 }}>
      {required.map((prop) => (
        <PropertyField
          key={prop.label}
          name={prop.label}
          value={properties[prop.label] ?? ''}
          description={prop.description}
          propType={prop.propType}
          options={prop.options}
          onChange={(v) => onPropertyChange(prop.label, v)}
        />
      ))}
      {optional.length > 0 && (
        <>
          <button
            onClick={() => setShowOptional(!showOptional)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              width: '100%',
              padding: '4px 14px',
              marginBottom: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--ed-text-muted)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <span style={{ transform: showOptional ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', fontSize: 9 }}>&#9660;</span>
            More options ({optional.length})
          </button>
          {showOptional && optional.map((prop) => (
            <PropertyField
              key={prop.label}
              name={prop.label}
              value={properties[prop.label] ?? ''}
              description={prop.description}
              propType={prop.propType}
              options={prop.options}
              optional
              onChange={(v) => onPropertyChange(prop.label, v)}
            />
          ))}
        </>
      )}
    </div>
  );
}
