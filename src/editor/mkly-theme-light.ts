import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const lightEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--ed-surface)',
    color: 'var(--ed-text)',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    fontSize: '13px',
    lineHeight: '1.6',
    padding: '16px 0',
    caretColor: 'var(--ed-accent)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--ed-accent)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'hsl(25 80% 92%)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--ed-surface)',
    color: '#aaa',
    border: 'none',
    paddingLeft: '8px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: '#666',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--ed-surface)',
    border: '1px solid var(--ed-border)',
    color: 'var(--ed-text)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    '& > ul': {
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      fontSize: '12px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: 'hsl(25 80% 94%)',
      color: 'var(--ed-text)',
    },
  },
  '.cm-tooltip-autocomplete .cm-completionLabel': {
    color: 'var(--ed-text)',
  },
  '.cm-tooltip-autocomplete .cm-completionDetail': {
    color: 'var(--ed-text-muted)',
    fontStyle: 'normal',
    marginLeft: '8px',
  },
  '.cm-completionMatchedText': {
    color: 'var(--ed-accent)',
    textDecoration: 'none',
    fontWeight: '600',
  },
  '.cm-panels': {
    backgroundColor: 'var(--ed-bg)',
    color: 'var(--ed-text)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'hsl(40 80% 90%)',
    outline: '1px solid hsl(40 60% 70%)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'hsl(40 80% 85%)',
  },
  '.cm-line': {
    padding: '0 16px',
  },
  '.cm-diagnostic': {
    padding: '4px 8px',
    marginLeft: '-1px',
  },
  '.cm-diagnostic-error': {
    borderLeftColor: '#d32f2f',
  },
  '.cm-diagnostic-warning': {
    borderLeftColor: '#f9a825',
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy #d32f2f',
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy #f9a825',
  },
  '.mkly-highlight-line': {
    background: 'rgba(59, 130, 246, 0.15)',
    transition: 'background 0.6s ease',
  },
  '.mkly-drop-line': {
    background: 'rgba(226, 114, 91, 0.08)',
    borderBottom: '2px solid hsl(25 95% 53%)',
  },
}, { dark: false });

const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c0392b', fontWeight: '700' },
  { tag: tags.typeName, color: '#2980b9' },
  { tag: tags.propertyName, color: '#3a6a8a' },
  { tag: tags.string, color: '#7a6530' },
  { tag: tags.comment, color: '#999', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#b58900' },
  { tag: tags.heading, color: '#1a1a1a', fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.monospace, color: '#27ae60' },
  { tag: tags.link, color: '#2980b9', textDecoration: 'underline' },
  { tag: tags.bracket, color: '#999' },
  { tag: tags.special(tags.propertyName), color: '#8e44ad' },
]);

export const mklyThemeLight = [lightEditorTheme, syntaxHighlighting(lightHighlightStyle)];
