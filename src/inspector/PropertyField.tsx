import { useState, useEffect, useRef, useCallback } from 'react';

interface PropertyFieldProps {
  name: string;
  value: string;
  description?: string;
  optional?: boolean;
  onChange: (value: string) => void;
}

export function PropertyField({ name, value, description, optional, onChange }: PropertyFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const isFocusedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value);
    }
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
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div style={{ padding: '0 14px', marginBottom: 10 }}>
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
