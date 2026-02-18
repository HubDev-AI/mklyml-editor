const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data',
  'del', 'dfn', 'em', 'i', 'img', 'ins', 'kbd', 'mark', 'q',
  'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span', 'strong',
  'sub', 'sup', 'time', 'u', 'var', 'wbr',
]);

export function prettifyHtml(html: string): string {
  if (!html) return html;

  const lines: string[] = [];
  let indent = 0;
  let pos = 0;

  while (pos < html.length) {
    // Skip whitespace between tags
    while (pos < html.length && /\s/.test(html[pos])) pos++;
    if (pos >= html.length) break;

    if (html[pos] === '<') {
      // HTML comments (<!-- ... -->) — preserve as-is
      if (html[pos + 1] === '!' && html[pos + 2] === '-' && html[pos + 3] === '-') {
        const commentEnd = html.indexOf('-->', pos + 4);
        if (commentEnd !== -1) {
          lines.push('  '.repeat(indent) + html.substring(pos, commentEnd + 3));
          pos = commentEnd + 3;
          continue;
        }
      }

      // Script/style content — emit as single block
      const scriptMatch = html.slice(pos).match(/^<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/i);
      if (scriptMatch) {
        lines.push('  '.repeat(indent) + scriptMatch[0]);
        pos += scriptMatch[0].length;
        continue;
      }

      // Closing tag
      if (html[pos + 1] === '/') {
        const closeMatch = html.slice(pos).match(/^<\/(\w+)\s*>/);
        if (closeMatch) {
          const tag = closeMatch[1].toLowerCase();
          if (!INLINE_ELEMENTS.has(tag)) {
            indent = Math.max(0, indent - 1);
          }
          lines.push('  '.repeat(indent) + closeMatch[0]);
          pos += closeMatch[0].length;
          continue;
        }
      }

      // Opening tag (possibly self-closing)
      const openMatch = html.slice(pos).match(/^<(\w+)([^>]*?)(\/?)>/);
      if (openMatch) {
        const tag = openMatch[1].toLowerCase();
        const selfClose = openMatch[3] === '/';
        const isVoid = VOID_ELEMENTS.has(tag);
        const isInline = INLINE_ELEMENTS.has(tag);
        const fullTag = openMatch[0];

        // Check if this tag has short inline content (no nested tags)
        if (!isVoid && !selfClose && !isInline) {
          const afterTag = pos + fullTag.length;
          const closeStr = `</${tag}>`;
          const closeIdx = html.indexOf(closeStr, afterTag);
          if (closeIdx !== -1) {
            const inner = html.substring(afterTag, closeIdx);
            const hasOnlyInlineTags = !/<(?!\/?(a|b|i|em|strong|span|code|br|img|u|s|mark|small|sup|sub)\b)\w/i.test(inner);
            const attrs = openMatch[2] ?? '';
            const hasMklyLineAttr = /\bdata-mkly-line="/.test(attrs);
            const preferMultiline = hasMklyLineAttr || attrs.length > 40;
            // Keep inline when content is short OR only has inline tags (never split <code> out of <p>)
            if (!preferMultiline && (hasOnlyInlineTags || inner.length < 120)) {
              lines.push('  '.repeat(indent) + fullTag + inner + closeStr);
              pos = closeIdx + closeStr.length;
              continue;
            }
          }
        }

        lines.push('  '.repeat(indent) + fullTag);
        pos += fullTag.length;

        if (!isVoid && !selfClose && !isInline) {
          indent++;
        }
        continue;
      }

      // Unrecognized — emit character
      lines.push('  '.repeat(indent) + html[pos]);
      pos++;
    } else {
      // Text content — collect until next tag
      let end = html.indexOf('<', pos);
      if (end === -1) end = html.length;
      const text = html.substring(pos, end).trim();
      if (text) {
        lines.push('  '.repeat(indent) + text);
      }
      pos = end;
    }
  }

  return lines.join('\n');
}
