import { useState, useCallback } from 'react';
import { getBlockIcon, getBlockIconColor } from '../icons';
import { useBlockDock, type BlockDockEntry } from './use-block-dock';
import { IconSearch } from '../icons';
import { KitBadge } from '../ui/kit-badge';
import { UsagePreview } from '../ui/usage-preview';
import type { CompletionData, BlockDocs } from '@milkly/mkly';

interface BlockSidebarProps {
  completionData: CompletionData;
}

function BlockCard({
  block,
  expanded,
  onToggle,
  onDragStart,
  completionData,
}: {
  block: BlockDockEntry;
  expanded: boolean;
  onToggle: () => void;
  onDragStart: (e: React.DragEvent) => void;
  completionData: CompletionData;
}) {
  const Icon = getBlockIcon(block.name, completionData);
  const iconColor = getBlockIconColor(block.name, completionData);
  const shortName = block.name.includes('/') ? block.name.split('/')[1] : block.name;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onToggle}
      style={{
        borderRadius: 10,
        border: '1px solid var(--ed-border)',
        background: 'var(--ed-surface)',
        cursor: 'grab',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ed-border-strong)';
        e.currentTarget.style.background = 'var(--ed-surface-alt)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--ed-border)';
        e.currentTarget.style.background = 'var(--ed-surface)';
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 8,
            background: iconColor.bg,
            color: iconColor.color,
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--ed-text)',
                letterSpacing: '-0.01em',
              }}
            >
              {shortName}
            </span>
            {block.kit && <KitBadge kit={block.kit} />}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ed-text-muted)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {block.description}
          </div>
        </div>
      </div>

      {/* Docs toggle (only if docs exist) */}
      {block.docs && (
        <div
          style={{
            borderTop: '1px solid var(--ed-border)',
            padding: '0 14px',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{
              width: '100%',
              padding: '7px 0',
              border: 'none',
              background: 'transparent',
              color: expanded ? 'var(--ed-accent)' : 'var(--ed-text-muted)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              textAlign: 'left',
              transition: 'color 0.15s',
            }}
          >
            {expanded ? 'Hide docs' : 'View docs'}
          </button>
        </div>
      )}

      {expanded && block.docs && <ExpandedDocs docs={block.docs} />}
    </div>
  );
}

function ExpandedDocs({ docs }: { docs: BlockDocs }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        padding: '10px 14px 14px',
        borderTop: '1px solid var(--ed-border)',
        fontSize: 12,
        color: 'var(--ed-text)',
        lineHeight: 1.6,
      }}
    >
      <p style={{ margin: '0 0 10px', color: 'var(--ed-text-muted)', fontSize: 12 }}>
        {docs.summary}
      </p>

      {docs.usage && (
        <div style={{ marginBottom: 10 }}>
          <UsagePreview usage={docs.usage} htmlPreview={docs.htmlPreview} />
        </div>
      )}

      {docs.properties && docs.properties.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ed-text-muted)',
              marginBottom: 6,
            }}
          >
            Properties
          </div>
          {docs.properties.map((p) => (
            <div key={p.name} style={{ padding: '3px 0' }}>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--ed-accent)',
                }}
              >
                {p.name}{p.required ? '*' : ''}
              </span>
              {p.description && (
                <span style={{ color: 'var(--ed-text-muted)', fontSize: 11, marginLeft: 8 }}>
                  {p.description}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {docs.tips && docs.tips.length > 0 && (
        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 11, color: 'var(--ed-text-muted)', lineHeight: 1.5 }}>
          {docs.tips.map((tip, i) => (
            <li key={i} style={{ marginBottom: 3 }}>{tip}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BlockSidebar({ completionData }: BlockSidebarProps) {
  const { query, setQuery, filtered } = useBlockDock(completionData);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

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

      {/* Block list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--ed-text-muted)', fontSize: 13 }}>
            No blocks found
          </div>
        )}
        {filtered.map((block) => (
          <BlockCard
            key={block.name}
            block={block}
            expanded={expandedBlock === block.name}
            onToggle={() => setExpandedBlock(expandedBlock === block.name ? null : block.name)}
            onDragStart={(e) => handleDragStart(e, block.name)}
            completionData={completionData}
          />
        ))}
      </div>
    </div>
  );
}
