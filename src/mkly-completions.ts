import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import type { CompletionData } from '@milkly/mkly';

const STYLE_CSS_PROPERTIES = [
  'bg', 'fg', 'rounded', 'padding', 'margin', 'color', 'background',
  'borderRadius', 'border', 'fontSize', 'fontWeight', 'fontFamily',
  'lineHeight', 'letterSpacing', 'textAlign', 'boxShadow', 'opacity',
  'maxWidth', 'minHeight', 'display', 'gap', 'overflow',
];

function findEnclosingBlock(
  doc: string,
  pos: number,
): string | null {
  const textBefore = doc.slice(0, pos);
  const lines = textBefore.split('\n');

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    const match = line.match(/^---\s+([\w]+(?:\/[\w]+)?)/);
    if (match) {
      const blockType = match[1];
      if (blockType === 'style' || blockType === 'meta' || blockType === 'use' || blockType === 'theme') return null;
      return blockType;
    }
  }
  return null;
}

function isInStyleBlock(doc: string, pos: number): boolean {
  const textBefore = doc.slice(0, pos);
  const lines = textBefore.split('\n');

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    const match = line.match(/^---\s+([\w]+(?:\/[\w]+)?)/);
    if (match) return match[1] === 'style';
  }
  return false;
}

export function mklyCompletionSource(data: CompletionData) {
  return (context: CompletionContext): CompletionResult | null => {
    const { state, pos } = context;
    const line = state.doc.lineAt(pos);
    const textBefore = line.text.slice(0, pos - line.from);
    const docText = state.doc.toString();

    // After `--- ` → suggest block names
    const blockTrigger = textBefore.match(/^---\s+([\w/]*)$/);
    if (blockTrigger) {
      const prefix = blockTrigger[1];
      const from = pos - prefix.length;

      const specialBlocks: Completion[] = [
        { label: 'style', detail: 'Style block', type: 'keyword' },
        { label: 'meta', detail: 'Document metadata', type: 'keyword' },
        { label: 'use', detail: 'Kit declaration', type: 'keyword' },
        { label: 'theme', detail: 'Theme selection', type: 'keyword' },
      ];

      const blockCompletions: Completion[] = [
        ...specialBlocks,
        ...data.blocks.map(b => ({
          label: b.label,
          detail: b.description,
          type: 'type' as const,
        })),
      ];

      return {
        from,
        options: blockCompletions,
        filter: true,
      };
    }

    // After `--- use: ` → suggest kit names
    const useTrigger = textBefore.match(/^---\s+use:\s*(\w*)$/);
    if (useTrigger) {
      const prefix = useTrigger[1];
      return {
        from: pos - prefix.length,
        options: data.kits.map(k => ({
          label: k.label,
          detail: k.description,
          type: 'namespace' as const,
        })),
        filter: true,
      };
    }

    // After `--- theme: ` → suggest theme names
    const themeTrigger = textBefore.match(/^---\s+theme:\s*([\w/]*)$/);
    if (themeTrigger) {
      const prefix = themeTrigger[1];
      return {
        from: pos - prefix.length,
        options: data.themes.map(t => ({
          label: t.label,
          detail: t.description,
          type: 'enum' as const,
        })),
        filter: true,
      };
    }

    // After `$` in style block → suggest variable names
    if (isInStyleBlock(docText, pos)) {
      const varTrigger = textBefore.match(/\$(\w*)$/);
      if (varTrigger) {
        const prefix = varTrigger[1];
        return {
          from: pos - prefix.length,
          options: data.variables.map(v => ({
            label: v.label,
            detail: v.description,
            type: 'variable' as const,
          })),
          filter: true,
        };
      }
    }

    // After `@target/` → suggest CSS properties for that target
    const targetPropTrigger = textBefore.match(/^@([\w.]+)\/(\w*)$/);
    if (targetPropTrigger) {
      const prefix = targetPropTrigger[2];
      return {
        from: pos - prefix.length,
        options: STYLE_CSS_PROPERTIES.map(p => ({
          label: p,
          detail: 'Target style property',
          type: 'property' as const,
          apply: `${p}: `,
        })),
        filter: true,
      };
    }

    // After `@` at line start → suggest CSS properties + target prefixes
    const atTrigger = textBefore.match(/^@(\w*)$/);
    if (atTrigger) {
      const prefix = atTrigger[1];
      const options: Completion[] = STYLE_CSS_PROPERTIES.map(p => ({
        label: p,
        detail: 'Inline style property',
        type: 'property' as const,
        apply: `${p}: `,
      }));

      const blockType = findEnclosingBlock(docText, pos);
      if (blockType) {
        const targets = data.targets.get(blockType);
        if (targets) {
          for (const [name, info] of Object.entries(targets)) {
            options.unshift({
              label: `${name}/`,
              detail: `${info.label} sub-element`,
              type: 'namespace' as const,
              boost: 1,
            });
          }
        }
      }

      return { from: pos - prefix.length, options, filter: true };
    }

    // At line start inside a block → suggest property names
    const propTrigger = textBefore.match(/^(\w*)$/);
    if (propTrigger && propTrigger[1].length > 0) {
      const blockType = findEnclosingBlock(docText, pos);
      if (blockType) {
        const props = data.properties.get(blockType);
        if (props && props.length > 0) {
          const prefix = propTrigger[1];
          return {
            from: pos - prefix.length,
            options: props.map(p => ({
              label: p.label,
              detail: p.description,
              type: 'property' as const,
              apply: `${p.label}: `,
            })),
            filter: true,
          };
        }
      }
    }

    return null;
  };
}
