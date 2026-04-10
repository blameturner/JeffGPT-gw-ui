import {
  createHighlighter,
  type Highlighter,
  type BundledLanguage,
  type BundledTheme,
} from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();

export const LIGHT_THEME: BundledTheme = 'github-light';
export const DARK_THEME: BundledTheme = 'github-dark';

const LANG_ALIAS: Record<string, BundledLanguage> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  python: 'python',
  rb: 'ruby',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  shell: 'shell',
  rs: 'rust',
  go: 'go',
  yml: 'yaml',
  md: 'markdown',
  json: 'json',
  html: 'html',
  css: 'css',
  sql: 'sql',
  plaintext: 'text' as BundledLanguage,
  text: 'text' as BundledLanguage,
};

export function normaliseLang(input?: string): BundledLanguage {
  const key = (input ?? 'text').toLowerCase();
  return LANG_ALIAS[key] ?? (key as BundledLanguage);
}

export async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [LIGHT_THEME, DARK_THEME],
      langs: ['text', 'typescript', 'tsx', 'javascript', 'python', 'shell', 'json'],
    }).then((h) => {
      for (const l of ['text', 'typescript', 'tsx', 'javascript', 'python', 'shell', 'json']) {
        loadedLangs.add(l);
      }
      return h;
    });
  }
  return highlighterPromise;
}

export interface ShikiToken {
  content: string;
  color?: string;
  fontStyle?: number;
}

export async function highlightToTokens(
  code: string,
  lang?: string,
  theme: BundledTheme = LIGHT_THEME,
): Promise<{ tokens: ShikiToken[][]; bg: string; fg: string }> {
  const hl = await getHighlighter();
  const resolved = normaliseLang(lang);
  if (!loadedLangs.has(resolved)) {
    try {
      await hl.loadLanguage(resolved);
      loadedLangs.add(resolved);
    } catch {
      const result = hl.codeToTokens(code, { lang: 'text', theme });
      return { tokens: result.tokens, bg: result.bg ?? '', fg: result.fg ?? '' };
    }
  }
  const result = hl.codeToTokens(code, { lang: resolved, theme });
  return { tokens: result.tokens, bg: result.bg ?? '', fg: result.fg ?? '' };
}
