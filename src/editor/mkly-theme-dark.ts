import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const darkEditorTheme = EditorView.theme({
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
    backgroundColor: '#2a3a5e',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--ed-surface)',
    color: '#4a4a6a',
    border: 'none',
    paddingLeft: '8px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: '#8888aa',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--ed-bg-alt)',
    border: '1px solid var(--ed-border)',
    color: 'var(--ed-text)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    '& > ul': {
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      fontSize: '12px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: '#2a3a5e',
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
    backgroundColor: '#3a3a2e',
    outline: '1px solid #5a5a3e',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: '#4a4a2e',
  },
  '.cm-line': {
    padding: '0 16px',
  },
  '.cm-diagnostic': {
    padding: '4px 8px',
    marginLeft: '-1px',
  },
  '.cm-diagnostic-error': {
    borderLeftColor: '#ff6b6b',
  },
  '.cm-diagnostic-warning': {
    borderLeftColor: '#ffcc66',
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy #ff6b6b',
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy #ffcc66',
  },
  '.mkly-highlight-line': {
    background: 'rgba(59, 130, 246, 0.15)',
    transition: 'background 0.6s ease',
  },
  '.mkly-drop-line': {
    background: 'rgba(226, 114, 91, 0.12)',
    borderBottom: '2px solid var(--ed-accent)',
  },
  '.mkly-delete-gutter .cm-gutterElement': {
    padding: '0 2px',
    cursor: 'default',
  },
  '.mkly-delete-gutter .mkly-block-delete-btn': {
    opacity: '0',
    cursor: 'pointer',
    color: '#ff6b6b',
    fontSize: '16px',
    lineHeight: '1.6',
    fontWeight: '700',
    transition: 'opacity 0.15s',
    userSelect: 'none',
    position: 'relative',
    top: '-3px',
    right: '-2px',
  },
  '.mkly-delete-gutter .cm-gutterElement.mkly-line-hover .mkly-block-delete-btn': {
    opacity: '0.25',
  },
  '.mkly-delete-gutter .cm-gutterElement:hover .mkly-block-delete-btn': {
    opacity: '1',
  },
}, { dark: true });

const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#e2725b', fontWeight: '700' },
  { tag: tags.typeName, color: '#7ec8e3' },
  { tag: tags.propertyName, color: '#a5c0e0' },
  { tag: tags.string, color: '#d4c4a8' },
  { tag: tags.comment, color: '#5a5a7a', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#f0c674' },
  { tag: tags.heading, color: '#e0e0e0', fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.monospace, color: '#b0d0a0' },
  { tag: tags.link, color: '#7ec8e3', textDecoration: 'underline' },
  { tag: tags.bracket, color: '#8888aa' },
  { tag: tags.special(tags.propertyName), color: '#c792ea' },
]);

export const mklyThemeDark = [darkEditorTheme, syntaxHighlighting(darkHighlightStyle)];
