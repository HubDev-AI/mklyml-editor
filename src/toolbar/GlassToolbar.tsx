import { useEditorStore } from '../store/editor-store';
import { useTheme } from '../theme/use-theme';
import { IconPlus, IconSun, IconMoon, IconWordWrap, IconUndo, IconRedo } from '../icons';
import { StylePickToggle } from '../inspector/StylePickToggle';

export function GlassToolbar() {
  const outputMode = useEditorStore((s) => s.outputMode);
  const viewMode = useEditorStore((s) => s.viewMode);
  const setOutputMode = useEditorStore((s) => s.setOutputMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const inspectorCollapsed = useEditorStore((s) => s.inspectorCollapsed);
  const setInspectorCollapsed = useEditorStore((s) => s.setInspectorCollapsed);
  const sidebarCollapsed = useEditorStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useEditorStore((s) => s.setSidebarCollapsed);
  const setBlockDockOpen = useEditorStore((s) => s.setBlockDockOpen);
  const mklyWordWrap = useEditorStore((s) => s.mklyWordWrap);
  const setMklyWordWrap = useEditorStore((s) => s.setMklyWordWrap);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const htmlWordWrap = useEditorStore((s) => s.htmlWordWrap);
  const setHtmlWordWrap = useEditorStore((s) => s.setHtmlWordWrap);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="liquid-glass-header" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 14px',
      flexShrink: 0,
      height: 44,
    }}>
      <span style={{
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: -0.5,
        color: 'var(--ed-accent)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        mklyml
      </span>

      {/* Sidebar toggle (blocks panel) */}
      <ToolbarButton
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? 'Show blocks' : 'Hide blocks'}
        active={!sidebarCollapsed}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="1" y="2" width="14" height="12" rx="2" />
          <line x1="5" y1="2" x2="5" y2="14" />
        </svg>
      </ToolbarButton>

      {/* mkly word wrap (left side) */}
      <ToolbarButton
        onClick={() => setMklyWordWrap(!mklyWordWrap)}
        title={mklyWordWrap ? 'Disable mklyml word wrap' : 'Enable mklyml word wrap'}
        active={mklyWordWrap}
      >
        <IconWordWrap />
      </ToolbarButton>

      <ToolbarButton onClick={() => setBlockDockOpen(true)} title="Insert block (Cmd+Shift+P)">
        <IconPlus />
      </ToolbarButton>

      <div style={{ width: 1, height: 18, background: 'var(--ed-border)', flexShrink: 0 }} />

      {/* Undo / Redo */}
      <ToolbarButton onClick={undo} title="Undo (Cmd+Z)" disabled={!canUndo}>
        <IconUndo />
      </ToolbarButton>
      <ToolbarButton onClick={redo} title="Redo (Cmd+Shift+Z)" disabled={!canRedo}>
        <IconRedo />
      </ToolbarButton>
      <span style={{
        fontSize: 10,
        color: 'var(--ed-muted)',
        opacity: 0.5,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}>
        last 20
      </span>

      <div style={{ flex: 1 }} />

      {/* Style picker — centered feature button */}
      <StylePickToggle />

      <div style={{ flex: 1 }} />

      {/* Output mode toggle */}
      <PillToggle
        options={['web', 'email'] as const}
        value={outputMode}
        onChange={setOutputMode}
        labels={{ web: 'Web', email: 'Email' }}
      />

      {/* View mode toggle */}
      <PillToggle
        options={['preview', 'edit', 'html'] as const}
        value={viewMode}
        onChange={setViewMode}
        labels={{ preview: 'Preview', edit: 'Edit', html: 'HTML' }}
      />

      {/* HTML word wrap (right side) */}
      <ToolbarButton
        onClick={() => setHtmlWordWrap(!htmlWordWrap)}
        title={htmlWordWrap ? 'Disable HTML word wrap' : 'Enable HTML word wrap'}
        active={htmlWordWrap}
      >
        <IconWordWrap />
      </ToolbarButton>

      {/* Inspector toggle */}
      <ToolbarButton
        onClick={() => setInspectorCollapsed(!inspectorCollapsed)}
        title={inspectorCollapsed ? 'Show inspector' : 'Hide inspector'}
        active={!inspectorCollapsed}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="1" y="2" width="14" height="12" rx="2" />
          <line x1="11" y1="2" x2="11" y2="14" />
        </svg>
      </ToolbarButton>

      {/* Theme toggle */}
      <ToolbarButton onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </ToolbarButton>
    </div>
  );
}

function PillToggle<T extends string>({ options, value, onChange, labels }: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="liquid-glass-pill" style={{
      display: 'flex',
      gap: 1,
      padding: 2,
    }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '3px 10px',
            border: 'none',
            background: value === opt ? 'var(--ed-accent)' : 'transparent',
            color: value === opt ? 'white' : 'var(--ed-text-muted)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            cursor: 'pointer',
            borderRadius: 9999,
            transition: 'all 0.15s',
            lineHeight: '18px',
          }}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

function ToolbarButton({ children, onClick, title, active, disabled }: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="liquid-glass-button"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        padding: 0,
        color: active ? 'var(--ed-accent)' : 'var(--ed-text-muted)',
        cursor: disabled ? 'default' : 'pointer',
        background: active ? 'rgba(226, 114, 91, 0.1)' : undefined,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}
