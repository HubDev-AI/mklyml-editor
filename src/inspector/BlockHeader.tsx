import { getBlockIcon, getBlockIconColor } from '../icons';
import { KitBadge } from '../ui/kit-badge';
import type { CompletionData } from '@milkly/mkly';

interface BlockHeaderProps {
  type: string;
  startLine: number;
  endLine: number;
  kitName?: string;
  completionData?: CompletionData;
}

export function BlockHeader({ type, startLine, endLine, kitName, completionData }: BlockHeaderProps) {
  const shortName = type.includes('/') ? type.split('/')[1] : type;
  const Icon = getBlockIcon(type, completionData);
  const iconColor = getBlockIconColor(type, completionData);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 14px',
      borderBottom: '1px solid var(--ed-border)',
    }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 6,
        background: iconColor.bg,
        color: iconColor.color,
        flexShrink: 0,
      }}>
        <Icon size={14} />
      </span>
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--ed-text)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {shortName}
          </span>
          {kitName && <KitBadge kit={kitName} />}
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--ed-text-muted)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          L{startLine}–{endLine}
        </div>
      </div>
    </div>
  );
}
