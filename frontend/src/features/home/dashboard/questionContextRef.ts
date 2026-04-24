// Parses the `context_ref` string that the home-questions producers stamp
// on each question. Values the UI will see:
//   loop:<id>          — freshly-flagged decision or external wait
//   loop:<id>:stale    — stale open loop (>3 days idle)
//   insight:<id>       — "deep-dive this insight?" prompt
export type QuestionContextKind = 'loop' | 'stale-loop' | 'insight' | 'other';

export interface QuestionContext {
  kind: QuestionContextKind;
  id: number | null;
  glyph: string;
  label: string;
  deepLink: boolean;
}

export function parseContextRef(ref: string | null | undefined): QuestionContext {
  if (!ref) {
    return { kind: 'other', id: null, glyph: '·', label: '', deepLink: false };
  }

  if (ref.startsWith('loop:')) {
    const rest = ref.slice('loop:'.length);
    const [idStr, suffix] = rest.split(':');
    const id = Number(idStr);
    const stale = suffix === 'stale';
    return {
      kind: stale ? 'stale-loop' : 'loop',
      id: Number.isFinite(id) ? id : null,
      glyph: stale ? '⚠' : '↻',
      label: stale ? 'stale loop' : 'open loop',
      deepLink: true,
    };
  }

  if (ref.startsWith('insight:')) {
    const id = Number(ref.slice('insight:'.length));
    return {
      kind: 'insight',
      id: Number.isFinite(id) ? id : null,
      glyph: '✦',
      label: 'insight follow-up',
      deepLink: true,
    };
  }

  return { kind: 'other', id: null, glyph: '·', label: ref, deepLink: false };
}
