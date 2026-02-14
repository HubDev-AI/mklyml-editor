import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBlockDock } from './use-block-dock';
import { BlockDockItem } from './BlockDockItem';
import { useEditorStore } from '../store/editor-store';
import type { CompletionData } from '@mklyml/core';

interface BlockDockProps {
  completionData: CompletionData;
  onInsert: (blockName: string) => void;
}

export function BlockDock({ completionData, onInsert }: BlockDockProps) {
  const open = useEditorStore((s) => s.blockDockOpen);
  const setOpen = useEditorStore((s) => s.setBlockDockOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [helpBlock, setHelpBlock] = useState<string | null>(null);

  const {
    query, setQuery, filtered, selectedIndex,
    setSelectedIndex, moveSelection, resetSearch, selectedBlock,
  } = useBlockDock(completionData);

  const close = useCallback(() => {
    setOpen(false);
    resetSearch();
    setHelpBlock(null);
  }, [setOpen, resetSearch]);

  const handleSelect = useCallback((name: string) => {
    onInsert(name);
    close();
  }, [onInsert, close]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection('down');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection('up');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedBlock) handleSelect(selectedBlock.name);
    }
  }, [close, moveSelection, selectedBlock, handleSelect]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="liquid-glass-overlay animate-cream-rise"
        style={{
          width: 380,
          maxHeight: 440,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 12px 0' }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              className="liquid-glass-input"
              placeholder="Search blocks..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                padding: '8px 12px',
                paddingRight: query ? 34 : 12,
                fontSize: 14,
              }}
            />
            {query && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery('');
                  inputRef.current?.focus();
                }}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--ed-border)',
                  color: 'var(--ed-text)',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1,
                  padding: 0,
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div
          ref={listRef}
          style={{
            overflow: 'auto',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {filtered.length === 0 && (
            <div style={{
              padding: 16,
              textAlign: 'center',
              color: 'var(--ed-text-muted)',
              fontSize: 13,
            }}>
              No blocks found
            </div>
          )}
          {filtered.map((block, i) => (
            <BlockDockItem
              key={block.name}
              block={block}
              selected={i === selectedIndex}
              helpOpen={helpBlock === block.name}
              completionData={completionData}
              onToggleHelp={() => setHelpBlock(helpBlock === block.name ? null : block.name)}
              onCloseHelp={() => setHelpBlock(null)}
              onClick={() => handleSelect(block.name)}
              onMouseEnter={() => setSelectedIndex(i)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
