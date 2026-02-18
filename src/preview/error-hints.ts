export interface ErrorHint {
  friendly: string;
  fix?: string;
}

const PATTERNS: Array<{ re: RegExp; hint: (m: RegExpMatchArray) => ErrorHint }> = [
  {
    re: /Missing required.*"src"/i,
    hint: () => ({ friendly: 'This image needs a source URL', fix: 'Add: src: https://...' }),
  },
  {
    re: /Missing required.*"url"/i,
    hint: () => ({ friendly: 'This button needs a link', fix: 'Add: url: https://...' }),
  },
  {
    re: /Missing required.*"height"/i,
    hint: () => ({ friendly: 'Spacer needs a height value', fix: 'Add: height: 24' }),
  },
  {
    re: /Missing required.*"(\w+)"/i,
    hint: (m) => ({ friendly: `Missing required property "${m[1]}"`, fix: `Add: ${m[1]}: ...` }),
  },
  {
    re: /Unknown block type/i,
    hint: () => ({ friendly: 'Block type not recognized', fix: 'Check the sidebar for available blocks' }),
  },
  {
    re: /Closing.*no matching/i,
    hint: () => ({ friendly: 'Extra closing tag \u2014 no matching opener', fix: 'Remove this line' }),
  },
  {
    re: /Invalid version/i,
    hint: () => ({ friendly: 'Version must be a number', fix: 'Use: version: 1' }),
  },
  {
    re: /Unsupported version/i,
    hint: () => ({ friendly: 'This version is not supported', fix: 'Use: version: 1' }),
  },
];

export function getErrorHint(message: string): ErrorHint {
  for (const { re, hint } of PATTERNS) {
    const m = message.match(re);
    if (m) return hint(m);
  }
  return { friendly: message };
}
