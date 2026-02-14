import { useState, useEffect, useRef, useCallback } from 'react';
import type { PropertyType } from '@mklyml/core';

interface PropertyFieldProps {
  name: string;
  value: string;
  description?: string;
  propType?: PropertyType;
  optional?: boolean;
  options?: string[];
  onChange: (value: string) => void;
}

type BaseFieldProps = Omit<PropertyFieldProps, 'options' | 'propType'>;

export function PropertyField({ name, value, description, propType, optional, options, onChange }: PropertyFieldProps) {
  switch (propType) {
    case 'boolean':
      return <BooleanField name={name} value={value} description={description} optional={optional} onChange={onChange} />;
    case 'select':
      return <SelectField name={name} value={value} description={description} optional={optional} options={options} onChange={onChange} />;
    case 'number':
      return <NumberField name={name} value={value} description={description} optional={optional} onChange={onChange} />;
    case 'url':
      return <UrlField name={name} value={value} description={description} optional={optional} onChange={onChange} />;
    case 'text':
    default:
      // Fallback: if no propType but has options, still render select/boolean
      if (options && options.length > 0) {
        const isBool = options.length === 2 && options.includes('true') && options.includes('false');
        if (isBool) return <BooleanField name={name} value={value} description={description} optional={optional} onChange={onChange} />;
        return <SelectField name={name} value={value} description={description} optional={optional} options={options} onChange={onChange} />;
      }
      return <TextField name={name} value={value} description={description} optional={optional} onChange={onChange} />;
  }
}

function FieldLabel({ name, optional }: { name: string; optional?: boolean }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--ed-text-muted)',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }}>
      {name}
      {optional && (
        <span style={{
          fontSize: 9,
          fontWeight: 400,
          color: 'var(--ed-text-muted)',
          opacity: 0.6,
          textTransform: 'none',
          letterSpacing: 0,
        }}>
          optional
        </span>
      )}
    </label>
  );
}

function BooleanField({ name, value, description, optional, onChange }: BaseFieldProps) {
  const isOn = value === 'true';

  return (
    <div style={{ padding: '0 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <FieldLabel name={name} optional={optional} />
          {description && (
            <div style={{ fontSize: 10, color: 'var(--ed-text-muted)', opacity: 0.7, marginTop: -2 }}>
              {description}
            </div>
          )}
        </div>
        <button
          onClick={() => onChange(isOn ? '' : 'true')}
          title={description}
          style={{
            position: 'relative',
            width: 34,
            height: 18,
            borderRadius: 9,
            border: 'none',
            background: isOn ? 'var(--ed-accent)' : 'var(--ed-border)',
            cursor: 'pointer',
            transition: 'background 0.15s',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute',
            top: 2,
            left: isOn ? 18 : 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'white',
            transition: 'left 0.15s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>
    </div>
  );
}

function SelectField({ name, value, description, optional, options, onChange }: PropertyFieldProps) {
  return (
    <div style={{ padding: '0 14px', marginBottom: 10 }}>
      <FieldLabel name={name} optional={optional} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={description}
        className="liquid-glass-input"
        style={{ width: '100%' }}
      >
        <option value="">{description ?? name}</option>
        {options!.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function NumberField({ name, value, description, optional, onChange }: BaseFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const isFocusedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isFocusedRef.current) setLocalValue(value);
  }, [value]);

  const commit = useCallback((v: string) => {
    clearTimeout(debounceRef.current);
    onChange(v);
  }, [onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v), 300);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    clearTimeout(debounceRef.current);
    if (localValue !== value) onChange(localValue);
  }, [localValue, value, onChange]);

  const step = useCallback((delta: number) => {
    const n = parseInt(localValue, 10);
    const next = String((isNaN(n) ? 0 : n) + delta);
    setLocalValue(next);
    commit(next);
  }, [localValue, commit]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div style={{ padding: '0 14px', marginBottom: 10 }}>
      <FieldLabel name={name} optional={optional} />
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="number"
          className="liquid-glass-input"
          value={localValue}
          onChange={handleChange}
          onFocus={() => { isFocusedRef.current = true; }}
          onBlur={handleBlur}
          placeholder={description ?? name}
          title={description}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          onClick={() => step(-1)}
          title="Decrease"
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            border: '1px solid var(--ed-border)',
            background: 'var(--ed-surface)',
            color: 'var(--ed-text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          −
        </button>
        <button
          onClick={() => step(1)}
          title="Increase"
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            border: '1px solid var(--ed-border)',
            background: 'var(--ed-surface)',
            color: 'var(--ed-text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function UrlField({ name, value, description, optional, onChange }: BaseFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const isFocusedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isFocusedRef.current) setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v), 300);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    clearTimeout(debounceRef.current);
    if (localValue !== value) onChange(localValue);
  }, [localValue, value, onChange]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const hasUrl = localValue.startsWith('http://') || localValue.startsWith('https://');

  return (
    <div style={{ padding: '0 14px', marginBottom: 10 }}>
      <FieldLabel name={name} optional={optional} />
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="url"
          className="liquid-glass-input"
          value={localValue}
          onChange={handleChange}
          onFocus={() => { isFocusedRef.current = true; }}
          onBlur={handleBlur}
          placeholder={description ?? 'https://...'}
          title={description}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          onClick={() => { if (hasUrl) window.open(localValue, '_blank'); }}
          title={hasUrl ? 'Open URL' : 'Enter a URL first'}
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            border: '1px solid var(--ed-border)',
            background: 'var(--ed-surface)',
            color: hasUrl ? 'var(--ed-accent)' : 'var(--ed-text-muted)',
            cursor: hasUrl ? 'pointer' : 'default',
            fontSize: 12,
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: hasUrl ? 1 : 0.4,
          }}
        >
          ↗
        </button>
      </div>
    </div>
  );
}

function TextField({ name, value, description, optional, onChange }: BaseFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const isFocusedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isFocusedRef.current) setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v), 300);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    clearTimeout(debounceRef.current);
    if (localValue !== value) onChange(localValue);
  }, [localValue, value, onChange]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div style={{ padding: '0 14px', marginBottom: 10 }}>
      <FieldLabel name={name} optional={optional} />
      <input
        className="liquid-glass-input"
        value={localValue}
        onChange={handleChange}
        onFocus={() => { isFocusedRef.current = true; }}
        onBlur={handleBlur}
        placeholder={description ?? name}
        title={description}
        style={{ width: '100%' }}
      />
    </div>
  );
}
