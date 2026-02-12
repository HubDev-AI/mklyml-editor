import { useState, useCallback, useRef } from 'react';
import { getBlockIcon, getBlockIconColor } from '../icons';
import { useBlockDock, type BlockDockEntry } from './use-block-dock';
import { IconSearch } from '../icons';
import { KitBadge } from '../ui/kit-badge';
import { BlockHelpPopover } from './BlockHelpPopover';
import { getBlockDisplayName, type CompletionData } from '@milkly/mkly';

interface BlockSidebarProps {
  completionData: CompletionData;
}

function BlockChip({
  block,
  helpOpen,
  onToggleHelp,
  onCloseHelp,
  onDragStart,
  completionData,
}: {
  block: BlockDockEntry;
  helpOpen: boolean;
  onToggleHelp: () => void;
  onCloseHelp: () => void;
  onDragStart: (e: React.DragEvent) => void;
  completionData: CompletionData;
}) {
  const helpRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const Icon = getBlockIcon(block.name, completionData);
  const iconColor = getBlockIconColor(block.name, completionData);
  const displayName = getBlockDisplayName(block.name, block.docs);

  return (
    <div
      ref={helpRef}
      draggable
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => {
        if (block.docs) {
          e.preventDefault();
          onToggleHelp();
        }
      }}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 20,
        background: hovered
          ? 'var(--ed-surface-alt)'
          : helpOpen
            ? 'var(--ed-surface-alt)'
            : 'var(--ed-surface)',
        border: `1px solid ${helpOpen ? 'var(--ed-accent)' : hovered ? 'var(--ed-border-strong)' : 'var(--ed-border)'}`,
        cursor: 'grab',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: 5,
          background: iconColor.bg,
          color: iconColor.color,
          flexShrink: 0,
        }}
      >
        <Icon size={12} />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ed-text)',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}
      >
        {displayName}
      </span>
      {block.kit && <KitBadge kit={block.kit} size="sm" />}

      {block.docs && (hovered || helpOpen) && (
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleHelp();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: 'none',
            background: helpOpen ? 'var(--ed-accent)' : 'rgba(128,128,128,0.15)',
            color: helpOpen ? 'white' : 'var(--ed-text-muted)',
            cursor: 'pointer',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            padding: 0,
            marginLeft: -2,
            flexShrink: 0,
          }}
          title={`Help: ${block.name}`}
        >
          ?
        </button>
      )}

      {helpOpen && block.docs && helpRef.current && (
        <BlockHelpPopover
          docs={block.docs}
          blockName={block.name}
          kitName={block.kit}
          anchorEl={helpRef.current}
          onClose={onCloseHelp}
        />
      )}
    </div>
  );
}

export function BlockSidebar({ completionData }: BlockSidebarProps) {
  const { query, setQuery, filtered } = useBlockDock(completionData);
  const [helpBlock, setHelpBlock] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, blockName: string) => {
    e.dataTransfer.setData('application/x-mkly-block', blockName);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--ed-bg)',
        borderRight: '1px solid var(--ed-border)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 12px 4px', flexShrink: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ed-text-muted)',
            marginBottom: 10,
            padding: '0 2px',
          }}
        >
          Blocks
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--ed-border)',
            background: 'var(--ed-surface)',
          }}
        >
          <IconSearch size={14} />
          <input
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--ed-text)',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
              padding: 0,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
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
                flexShrink: 0,
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Block chips */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '10px 12px 12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignContent: 'start',
        }}
      >
        {filtered.length === 0 && (
          <div style={{ width: '100%', padding: 20, textAlign: 'center', color: 'var(--ed-text-muted)', fontSize: 13 }}>
            No blocks found
          </div>
        )}
        {filtered.map((block) => (
          <BlockChip
            key={block.name}
            block={block}
            helpOpen={helpBlock === block.name}
            onToggleHelp={() => setHelpBlock(helpBlock === block.name ? null : block.name)}
            onCloseHelp={() => setHelpBlock(null)}
            onDragStart={(e) => handleDragStart(e, block.name)}
            completionData={completionData}
          />
        ))}
      </div>
    </div>
  );
}
