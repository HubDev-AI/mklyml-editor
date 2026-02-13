import { getBlockDisplayName, type KitInfo, type CompletionData } from '@milkly/mkly';

interface KitInfoPanelProps {
  kitName: string;
  kitInfo: KitInfo | undefined;
  completionData?: CompletionData;
}

export function KitInfoPanel({ kitName, kitInfo, completionData }: KitInfoPanelProps) {
  if (!kitInfo) {
    return (
      <div style={{
        padding: '12px 14px',
        fontSize: 12,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: 'var(--ed-text-muted)',
      }}>
        Unknown kit: <strong>{kitName}</strong>
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px 14px',
      fontSize: 12,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'var(--ed-accent)',
          color: 'white',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {kitInfo.displayName[0].toUpperCase()}
        </div>
        <div>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--ed-text)',
          }}>
            {kitInfo.displayName}
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--ed-text-muted)',
          }}>
            kit
          </div>
        </div>
      </div>

      <p style={{ color: 'var(--ed-text)', margin: '0 0 12px', lineHeight: 1.5 }}>
        {kitInfo.description}
      </p>

      {kitInfo.blockNames.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--ed-text-muted)',
            marginBottom: 4,
          }}>
            Blocks ({kitInfo.blockNames.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {kitInfo.blockNames.map((name) => (
              <span
                key={name}
                style={{
                  fontSize: 10,
                  background: 'var(--ed-surface)',
                  border: '1px solid var(--ed-border)',
                  borderRadius: 3,
                  padding: '2px 6px',
                  color: 'var(--ed-text)',
                }}
              >
                {getBlockDisplayName(name, completionData?.docs.get(name))}
              </span>
            ))}
          </div>
        </div>
      )}

      {kitInfo.themeNames.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--ed-text-muted)',
            marginBottom: 4,
          }}>
            Themes ({kitInfo.themeNames.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {kitInfo.themeNames.map((name) => {
              const item = completionData?.themes.find((t) => t.label === name);
              return (
                <span
                  key={name}
                  title={name}
                  style={{
                    fontSize: 10,
                    background: 'var(--ed-surface)',
                    border: '1px solid var(--ed-border)',
                    borderRadius: 3,
                    padding: '2px 6px',
                    color: 'var(--ed-text)',
                  }}
                >
                  {item?.description ?? name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {kitInfo.presetNames.length > 0 && (
        <div>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--ed-text-muted)',
            marginBottom: 4,
          }}>
            Presets ({kitInfo.presetNames.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {kitInfo.presetNames.map((name) => {
              const item = completionData?.presets.find((p) => p.label === name);
              return (
                <span
                  key={name}
                  title={name}
                  style={{
                    fontSize: 10,
                    background: 'var(--ed-surface)',
                    border: '1px solid var(--ed-border)',
                    borderRadius: 3,
                    padding: '2px 6px',
                    color: 'var(--ed-text)',
                  }}
                >
                  {item?.description ?? name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
