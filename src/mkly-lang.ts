import { StreamLanguage, type StreamParser } from '@codemirror/language';

type State = 'top' | 'block' | 'style' | 'meta' | 'use' | 'theme';

interface MklyState {
  mode: State;
  afterDelimiter: boolean;
}

const mklyParser: StreamParser<MklyState> = {
  startState(): MklyState {
    return { mode: 'top', afterDelimiter: false };
  },

  token(stream, state): string | null {
    // Handle blank lines
    if (stream.sol() && stream.eol()) {
      return null;
    }

    // Comments
    if (stream.match(/^\/\/.*/)) {
      return 'comment';
    }

    // Block type name — right after "--- " or "--- /" was consumed
    if (state.afterDelimiter) {
      state.afterDelimiter = false;
      if (stream.match(/^[\w]+(?:\/[\w]+)?/)) {
        // Consume optional label ": ..."
        stream.match(/^:\s*.*/);
        return null; // unstyled — block-color-plugin handles coloring
      }
    }

    // Block delimiters at start of line
    if (stream.sol()) {
      // Closing block: "--- /" prefix (keyword), type name consumed next call
      if (stream.match(/^---\s+\//)) {
        state.afterDelimiter = true;
        return 'keyword';
      }

      // Opening block: "--- " prefix (keyword), type name consumed next call
      if (stream.match(/^---\s+/)) {
        const rest = stream.string.slice(stream.pos);
        const typeMatch = rest.match(/^([\w]+(?:\/[\w]+)?)/);
        if (typeMatch) {
          const blockType = typeMatch[1];
          if (blockType === 'style') state.mode = 'style';
          else if (blockType === 'meta') state.mode = 'meta';
          else if (blockType === 'use') state.mode = 'use';
          else if (blockType === 'theme') state.mode = 'theme';
          else state.mode = 'block';
        }
        state.afterDelimiter = true;
        return 'keyword';
      }
    }

    // Inside style block
    if (state.mode === 'style') {
      // $variable reference
      if (stream.match(/^\$\w+/)) {
        return 'variableName';
      }
      // Block selector (word at indent 0 without colon, or with brace)
      if (stream.sol() && stream.match(/^[\w]+(?=[{\s]*$)/)) {
        return 'typeName';
      }
      // Sub-element / pseudo
      if (stream.match(/^\.\w+/) || stream.match(/^:\w[\w-]*/)) {
        return 'typeName';
      }
      // Property: value (camelCase or kebab-case)
      if (stream.match(/^[\w-]+(?=\s*:)/)) {
        return 'propertyName';
      }
      // Braces (legacy)
      if (stream.match(/^[{}]/)) {
        return 'bracket';
      }
      stream.next();
      return null;
    }

    // Inside meta, use, or theme block
    if (state.mode === 'meta' || state.mode === 'use' || state.mode === 'theme') {
      if (stream.match(/^[\w]+(?=\s*:)/)) {
        return 'propertyName';
      }
      stream.next();
      return null;
    }

    // Inside a content block
    if (state.mode === 'block') {
      // @style property
      if (stream.sol() && stream.match(/^@[\w]+(?=\s*:)/)) {
        return 'special';
      }
      // Regular property: key: value
      if (stream.sol() && stream.match(/^[\w]+(?=:\s)/)) {
        return 'propertyName';
      }
      // Markdown headings
      if (stream.sol() && stream.match(/^#{1,6}\s/)) {
        stream.skipToEnd();
        return 'heading';
      }
      // Bold **text**
      if (stream.match(/^\*\*[^*]+\*\*/)) {
        return 'strong';
      }
      // Italic *text*
      if (stream.match(/^\*[^*]+\*/)) {
        return 'emphasis';
      }
      // Inline code
      if (stream.match(/^`[^`]+`/)) {
        return 'monospace';
      }
      // Link [text](url)
      if (stream.match(/^\[[^\]]*\]\([^)]*\)/)) {
        return 'link';
      }
      // $variable reference
      if (stream.match(/^\$\w+/)) {
        return 'variableName';
      }
    }

    stream.next();
    return null;
  },
};

export const mklyLanguage = StreamLanguage.define(mklyParser);
