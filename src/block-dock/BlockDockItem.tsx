import { useRef } from 'react';
import { getBlockIcon, getBlockIconColor } from '../icons';
import type { BlockDockEntry } from './use-block-dock';
import { BlockHelpPopover } from './BlockHelpPopover';
import { getBlockDisplayName, type CompletionData } from '@milkly/mkly';

interface BlockDockItemProps {
  block: BlockDockEntry;
  selected: boolean;
  helpOpen: boolean;
  completionData: CompletionData;
  onToggleHelp: () => void;
  onCloseHelp: () => void;
  onClick: () => void;
  onMouseEnter: () => void;
}

export function BlockDockItem({ block, selected, helpOpen, completionData, onToggleHelp, onCloseHelp, onClick, onMouseEnter }: BlockDockItemProps) {
  const helpRef = useRef<HTMLButtonElement>(null);
  const Icon = getBlockIcon(block.name, completionData);
  const iconColor = getBlockIconColor(block.name, completionData);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: selected ? 'rgba(226, 114, 91, 0.12)' : 'transparent',
          color: 'var(--ed-text)',
          cursor: 'pointer',
          textAlign: 'left',
          borderRadius: 6,
          transition: 'background 0.1s',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          paddingRight: block.docs ? 36 : 12,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            background: selected ? iconColor.color : iconColor.bg,
            color: selected ? 'white' : iconColor.color,
            flexShrink: 0,
            border: `1px solid ${selected ? 'transparent' : 'var(--ed-border)'}`,
          }}
        >
          <Icon size={14} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: selected ? 'var(--ed-accent)' : 'var(--ed-text)',
            }}
          >
            {getBlockDisplayName(block.name, block.docs)}
            {block.kit && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                opacity: 0.5,
              }}>
                {block.kit}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ed-text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {block.description}
          </div>
        </div>
      </button>

      {block.docs && (
        <button
          ref={helpRef}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleHelp();
          }}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '1px solid var(--ed-border)',
            background: helpOpen ? 'var(--ed-accent)' : 'var(--ed-glass-bg)',
            color: helpOpen ? 'white' : 'var(--ed-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            transition: 'background 0.15s, color 0.15s',
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
