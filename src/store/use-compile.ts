import { useEffect, useRef, useMemo } from 'react';
import { mkly, htmlToMkly, CORE_KIT, createCompletionData, escapeHtml } from '@mklyml/core';
import type { ParseError } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import { emailPlugin } from '@mklyml/plugins/email';
import { useEditorStore } from './editor-store';

const KITS = { core: CORE_KIT, newsletter: NEWSLETTER_KIT };

function generateNormalizationWarnings(
  original: string,
  normalized: string,
): ParseError[] {
  const warnings: ParseError[] = [];
  const origLines = original.split('\n');

  // Detect stripped comments
  let origCommentCount = 0;
  let normCommentCount = 0;
  for (const line of origLines) {
    if (line.trim().startsWith('//')) origCommentCount++;
  }
  for (const line of normalized.split('\n')) {
    if (line.trim().startsWith('//')) normCommentCount++;
  }
  if (origCommentCount > normCommentCount) {
    const lost = origCommentCount - normCommentCount;
    warnings.push({
      severity: 'warning',
      line: 1,
      message: `Round-trip: ${lost} comment(s) stripped (not preserved in HTML)`,
    });
  }

  // Detect lost style block
  const origHasStyle = origLines.some(l => l.trim() === '--- style');
  const normHasStyle = normalized.split('\n').some(l => l.trim() === '--- style');
  if (origHasStyle && !normHasStyle) {
    const styleLine = origLines.findIndex(l => l.trim() === '--- style') + 1;
    warnings.push({
      severity: 'warning',
      line: styleLine,
      message: 'Round-trip: style block partially lost (inline @styles preserved, variable block stripped)',
    });
  }

  // Detect lost inline styles (@property lines)
  let origStyleCount = 0;
  let normStyleCount = 0;
  for (const line of origLines) {
    if (line.trim().startsWith('@') && line.includes(':')) origStyleCount++;
  }
  for (const line of normalized.split('\n')) {
    if (line.trim().startsWith('@') && line.includes(':')) normStyleCount++;
  }
  if (origStyleCount > normStyleCount) {
    warnings.push({
      severity: 'warning',
      line: 1,
      message: `Round-trip: ${origStyleCount - normStyleCount} inline style(s) lost during normalization`,
    });
  }

  // Compare block headers (--- type lines)
  const origBlocks = origLines
    .map((l, i) => ({ line: i + 1, text: l.trim() }))
    .filter(l => l.text.startsWith('--- ') && !l.text.startsWith('--- /'));
  const normBlocks = normalized.split('\n')
    .map((l, i) => ({ line: i + 1, text: l.trim() }))
    .filter(l => l.text.startsWith('--- ') && !l.text.startsWith('--- /'));

  const origBlockTypes = origBlocks.map(b => b.text.replace(/^---\s+/, '').split(/[\s:]/)[0]);
  const normBlockTypes = normBlocks.map(b => b.text.replace(/^---\s+/, '').split(/[\s:]/)[0]);

  // Check for blocks that disappeared
  const origTypeCounts = new Map<string, number>();
  const normTypeCounts = new Map<string, number>();
  for (const t of origBlockTypes) origTypeCounts.set(t, (origTypeCounts.get(t) ?? 0) + 1);
  for (const t of normBlockTypes) normTypeCounts.set(t, (normTypeCounts.get(t) ?? 0) + 1);

  for (const [type, count] of origTypeCounts) {
    const normCount = normTypeCounts.get(type) ?? 0;
    if (normCount < count) {
      warnings.push({
        severity: 'warning',
        line: 1,
        message: `Round-trip: ${count - normCount} '${type}' block(s) lost`,
      });
    }
  }

  return warnings;
}

export function useCompile() {
  const source = useEditorStore((s) => s.source);
  const outputMode = useEditorStore((s) => s.outputMode);
  const setHtml = useEditorStore((s) => s.setHtml);
  const setErrors = useEditorStore((s) => s.setErrors);
  const setSourceMap = useEditorStore((s) => s.setSourceMap);
  const setStyleGraph = useEditorStore((s) => s.setStyleGraph);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const completionData = useMemo(
    () => createCompletionData([], [CORE_KIT, NEWSLETTER_KIT]),
    [],
  );

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const result = mkly(source, {
          kits: KITS,
          plugins: outputMode === 'email' ? [emailPlugin()] : [],
          sourceMap: true,
        });

        const { isNormalized, normalizationWarnings } = useEditorStore.getState();

        // On first compile, normalize via round-trip: mkly → HTML → mkly
        if (!isNormalized) {
          useEditorStore.getState().setIsNormalized(true);
          try {
            const normalized = htmlToMkly(result.html, { kits: KITS });
            const warnings = generateNormalizationWarnings(source, normalized);
            useEditorStore.getState().setNormalizationWarnings(warnings);

            if (normalized.trim() !== source.trim()) {
              // Set the normalized source — this will trigger a recompile
              setHtml(result.html);
              setErrors([...result.errors, ...warnings]);
              setSourceMap(result.sourceMap ?? null);
              setStyleGraph(result.styleGraph ?? null);
              useEditorStore.getState().setSource(normalized);
              return;
            }
            // Source already stable, just merge warnings
            setHtml(result.html);
            setErrors([...result.errors, ...warnings]);
            setSourceMap(result.sourceMap ?? null);
            setStyleGraph(result.styleGraph ?? null);
          } catch {
            // Normalization failed, use original source as-is
            setHtml(result.html);
            setErrors(result.errors);
            setSourceMap(result.sourceMap ?? null);
            setStyleGraph(result.styleGraph ?? null);
          }
          return;
        }

        // Normal compile — include persistent normalization warnings
        setHtml(result.html);
        setErrors(
          normalizationWarnings.length > 0
            ? [...result.errors, ...normalizationWarnings]
            : result.errors,
        );
        setSourceMap(result.sourceMap ?? null);
        setStyleGraph(result.styleGraph ?? null);
      } catch (e) {
        setHtml(`<html><body style="margin:0;background:#fff;color:#dc2626;font-family:monospace;padding:16px;"><pre style="white-space:pre-wrap;">${escapeHtml(String(e))}</pre></body></html>`);
        setErrors([]);
        setSourceMap(null);
        setStyleGraph(null);
      }
    }, 150);

    return () => clearTimeout(timerRef.current);
  }, [source, outputMode, setHtml, setErrors, setSourceMap, setStyleGraph]);

  return { completionData };
}
