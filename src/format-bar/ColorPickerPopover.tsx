import { useEffect, useRef } from 'react';

interface ColorPickerPopoverProps {
  anchorX: number;
  anchorY: number;
  onSelect: (color: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
  '#000000', '#ffffff', '#1e293b', '#dc2626',
];

export function ColorPickerPopover({ anchorX, anchorY, onSelect, onClose }: ColorPickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="liquid-glass-overlay"
      style={{
        position: 'fixed',
        left: anchorX,
        top: anchorY + 8,
        transform: 'translateX(-50%)',
        padding: 8,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 4,
        zIndex: 9999,
      }}
    >
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(color);
          }}
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            border: `1px solid ${color === '#ffffff' ? 'var(--ed-border)' : 'transparent'}`,
            background: color,
            cursor: 'pointer',
            padding: 0,
          }}
          title={color}
        />
      ))}
      <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
        <input
          type="color"
          onChange={(e) => onSelect(e.target.value)}
          style={{ width: '100%', height: 24, border: 'none', cursor: 'pointer', borderRadius: 4, padding: 0 }}
          title="Custom color"
        />
      </div>
    </div>
  );
}
