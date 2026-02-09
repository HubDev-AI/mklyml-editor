export const KIT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  core: { bg: 'rgba(59, 130, 246, 0.12)', text: 'rgb(96, 165, 250)', border: 'rgba(59, 130, 246, 0.3)' },
  newsletter: { bg: 'rgba(168, 85, 247, 0.12)', text: 'rgb(192, 132, 252)', border: 'rgba(168, 85, 247, 0.3)' },
  docs: { bg: 'rgba(34, 197, 94, 0.12)', text: 'rgb(74, 222, 128)', border: 'rgba(34, 197, 94, 0.3)' },
};

const DEFAULT_KIT_COLOR = { bg: 'rgba(226, 114, 91, 0.12)', text: 'var(--ed-accent)', border: 'rgba(226, 114, 91, 0.3)' };

export function getKitColors(kitName: string) {
  return KIT_COLORS[kitName] ?? DEFAULT_KIT_COLOR;
}

interface KitBadgeProps {
  kit: string;
  size?: 'sm' | 'md';
}

export function KitBadge({ kit, size = 'sm' }: KitBadgeProps) {
  const colors = getKitColors(kit);
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: isSm ? '1px 6px' : '1px 8px',
        borderRadius: 10,
        fontSize: isSm ? 9 : 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        whiteSpace: 'nowrap',
        lineHeight: isSm ? '14px' : '16px',
      }}
    >
      {kit}
    </span>
  );
}
