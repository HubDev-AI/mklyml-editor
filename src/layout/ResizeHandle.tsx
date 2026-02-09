import { useCallback, useRef } from 'react';

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  direction?: 'horizontal' | 'vertical';
}

export function ResizeHandle({ onResize, direction = 'horizontal' }: ResizeHandleProps) {
  const dragging = useRef(false);
  const startPos = useRef(0);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const stopDrag = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const pos = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = pos - startPos.current;
    startPos.current = pos;
    onResizeRef.current(delta);
  }, [direction]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onLostPointerCapture={stopDrag}
      style={{
        width: isHorizontal ? 5 : '100%',
        height: isHorizontal ? '100%' : 5,
        cursor: isHorizontal ? 'col-resize' : 'row-resize',
        background: 'var(--ed-resize-handle)',
        flexShrink: 0,
        transition: 'background 0.15s',
        position: 'relative',
        touchAction: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--ed-resize-handle-hover)';
      }}
      onMouseLeave={(e) => {
        if (!dragging.current) {
          (e.currentTarget as HTMLElement).style.background = 'var(--ed-resize-handle)';
        }
      }}
    />
  );
}
