import { useEffect, useState, useCallback, useRef } from 'react';
import type { EditorView } from '@codemirror/view';
import { wrapBold, wrapItalic, wrapCode, insertLink, setTextColor, setFontSize, setHighlightColor } from './format-commands';

interface FormatBarProps {
  editorView: EditorView | null;
}

interface Position {
  x: number;
  y: number;
}

type BarMode = 'buttons' | 'textColor' | 'highlight' | 'fontSize';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

const PRESET_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px'];

const btnBase: React.CSSProperties = {
  height: 26,
  border: 'none',
  background: 'transparent',
  color: 'var(--ed-text)',
  cursor: 'pointer',
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.1s',
  flexShrink: 0,
};

function hoverIn(e: React.MouseEvent) {
  (e.currentTarget as HTMLElement).style.background = 'var(--ed-glass-bg)';
}
function hoverOut(e: React.MouseEvent) {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
}

export function FormatBar({ editorView }: FormatBarProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<Position>({ x: 0, y: 0 });
  const barRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<BarMode>('buttons');

  // Reset mode when bar hides
  useEffect(() => {
    if (!visible) setMode('buttons');
  }, [visible]);

  useEffect(() => {
    if (!editorView) return;

    const checkSelection = () => {
      const { from, to } = editorView.state.selection.main;
      if (from === to) {
        setVisible(false);
        return;
      }

      // Only show format bar on block content text — not on structural lines
      const fromLine = editorView.state.doc.lineAt(from);
      const trimmed = fromLine.text.trim();

      // Never show on block delimiters, style lines, or comments
      if (trimmed.startsWith('---') || trimmed.startsWith('@') || trimmed.startsWith('//')) {
        setVisible(false);
        return;
      }

      // Check if this looks like a property line (key: value) inside a block header
      if (/^\w[\w-]*:\s/.test(trimmed)) {
        let inProps = false;
        for (let i = fromLine.number - 1; i >= 1; i--) {
          const lt = editorView.state.doc.line(i).text.trim();
          if (lt.startsWith('---')) { inProps = true; break; }
          if (lt === '') break;
        }
        if (inProps) {
          setVisible(false);
          return;
        }
      }

      const fromCoords = editorView.coordsAtPos(from);
      const toCoords = editorView.coordsAtPos(to);
      if (!fromCoords || !toCoords) return;

      const x = (fromCoords.left + toCoords.right) / 2;
      const y = fromCoords.top - 40;

      setPos({ x, y });
      setVisible(true);
    };

    const dom = editorView.dom;
    dom.addEventListener('mouseup', checkSelection);
    dom.addEventListener('keyup', checkSelection);

    return () => {
      dom.removeEventListener('mouseup', checkSelection);
      dom.removeEventListener('keyup', checkSelection);
    };
  }, [editorView]);

  const exec = useCallback((fn: (view: EditorView) => boolean) => {
    if (!editorView) return;
    fn(editorView);
    editorView.focus();
    setVisible(false);
    setMode('buttons');
  }, [editorView]);

  if (!visible || !editorView) return null;

  const renderButtons = () => {
    const formatBtns = [
      { label: 'B', title: 'Bold (Cmd+B)', action: wrapBold, style: { fontWeight: 700 } as React.CSSProperties },
      { label: 'I', title: 'Italic (Cmd+I)', action: wrapItalic, style: { fontStyle: 'italic' } as React.CSSProperties },
      { label: '<>', title: 'Code', action: wrapCode, style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11 } as React.CSSProperties },
      { label: '\u{1F517}', title: 'Link (Cmd+K)', action: insertLink, style: {} as React.CSSProperties },
    ];

    const styleBtns = [
      { label: 'A', title: 'Text Color', style: { color: '#ef4444', fontWeight: 700, fontSize: 13 } as React.CSSProperties, mode: 'textColor' as BarMode },
      { label: 'Aa', title: 'Font Size', style: { fontSize: 11, fontWeight: 600 } as React.CSSProperties, mode: 'fontSize' as BarMode },
      { label: 'H', title: 'Highlight', style: { background: 'rgba(234,179,8,0.3)', borderRadius: 2, padding: '0 3px', fontWeight: 700, fontSize: 13 } as React.CSSProperties, mode: 'highlight' as BarMode },
    ];

    return (
      <>
        {formatBtns.map((btn) => (
          <button
            key={btn.label}
            title={btn.title}
            onMouseDown={(e) => {
              e.preventDefault();
              exec(btn.action);
            }}
            style={{ ...btnBase, width: 28, fontSize: 13, ...btn.style }}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
          >
            {btn.label}
          </button>
        ))}

        <div style={{ width: 1, height: 16, background: 'var(--ed-border)', margin: '0 2px', alignSelf: 'center', flexShrink: 0 }} />

        {styleBtns.map((btn) => (
          <button
            key={btn.label}
            title={btn.title}
            onMouseDown={(e) => {
              e.preventDefault();
              setMode(btn.mode);
            }}
            style={{ ...btnBase, width: 28, ...btn.style }}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
          >
            {btn.label}
          </button>
        ))}
      </>
    );
  };

  const renderColorPicker = (type: 'textColor' | 'highlight') => (
    <>
      <button
        onMouseDown={(e) => { e.preventDefault(); setMode('buttons'); }}
        style={{ ...btnBase, width: 26, fontSize: 12 }}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        title="Back"
      >
        &#x2190;
      </button>
      <div style={{ width: 1, height: 16, background: 'var(--ed-border)', margin: '0 2px', alignSelf: 'center', flexShrink: 0 }} />
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          onMouseDown={(e) => {
            e.preventDefault();
            if (type === 'textColor') exec((v) => setTextColor(v, color));
            else exec((v) => setHighlightColor(v, color));
          }}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            background: color,
            border: `1px solid ${color === '#ffffff' ? 'var(--ed-border)' : 'transparent'}`,
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
          title={color}
        />
      ))}
    </>
  );

  const renderSizePicker = () => (
    <>
      <button
        onMouseDown={(e) => { e.preventDefault(); setMode('buttons'); }}
        style={{ ...btnBase, width: 26, fontSize: 12 }}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        title="Back"
      >
        &#x2190;
      </button>
      <div style={{ width: 1, height: 16, background: 'var(--ed-border)', margin: '0 2px', alignSelf: 'center', flexShrink: 0 }} />
      {PRESET_SIZES.map((size) => (
        <button
          key={size}
          onMouseDown={(e) => {
            e.preventDefault();
            exec((v) => setFontSize(v, size));
          }}
          style={{
            ...btnBase,
            padding: '0 8px',
            fontSize: 11,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          {size}
        </button>
      ))}
    </>
  );

  return (
    <div
      ref={barRef}
      className="liquid-glass-pill animate-cream-rise"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        zIndex: 9998,
        overflow: 'hidden',
      }}
    >
      {mode === 'buttons' && renderButtons()}
      {mode === 'textColor' && renderColorPicker('textColor')}
      {mode === 'highlight' && renderColorPicker('highlight')}
      {mode === 'fontSize' && renderSizePicker()}
    </div>
  );
}
