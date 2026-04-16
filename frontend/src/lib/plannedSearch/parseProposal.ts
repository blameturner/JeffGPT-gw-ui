import type { PlannedSearchQuery } from './types';

export interface ParsedProposal {
  messageId: number;
  queries: PlannedSearchQuery[];
}

const MARKER = '[planned_search]';

export function isProposalContent(content: string): boolean {
  const trimmed = content.trimStart();
  if (trimmed.startsWith(MARKER)) return true;
  // Also detect raw JSON array of query objects emitted by the newer backend.
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] && typeof parsed[0] === 'object' && 'query' in parsed[0]) {
        return true;
      }
    } catch {
      // not JSON
    }
  }
  return false;
}

/**
 * Parse queries out of content that may be either the legacy `[planned_search]`
 * marker format or a raw JSON array.  Returns null when neither format is recognised.
 * `messageId` will be 0 for the JSON format — callers that already know the DB row
 * id should substitute it after calling this helper.
 */
export function parseProposal(content: string): ParsedProposal | null {
  const trimmed = content.trimStart();

  // ── New format: raw JSON array ───────────────────────────────────────────
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const queries: PlannedSearchQuery[] = parsed
          .map((q) => {
            if (typeof q === 'string') return { query: q, reason: '' };
            if (q && typeof q === 'object') {
              return {
                query: String((q as { query?: unknown }).query ?? ''),
                reason: String((q as { reason?: unknown }).reason ?? ''),
              };
            }
            return null;
          })
          .filter((q): q is PlannedSearchQuery => q !== null && q.query.length > 0);
        if (queries.length > 0) {
          return { messageId: 0, queries };
        }
      }
    } catch {
      // fall through to marker format
    }
  }

  // ── Legacy format: [planned_search] ... [message_id:N] ───────────────────
  if (!trimmed.startsWith(MARKER)) return null;

  const idMatch = content.match(/\[message_id:(\d+)\]\s*$/);
  if (!idMatch) return null;
  const messageId = Number(idMatch[1]);
  if (!Number.isFinite(messageId)) return null;

  const body = content
    .slice(content.indexOf(MARKER) + MARKER.length, idMatch.index)
    .trim();

  const queries: PlannedSearchQuery[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('-')) continue;
    const stripped = line.replace(/^-\s*/, '');
    const reasonMatch = stripped.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (reasonMatch) {
      queries.push({ query: reasonMatch[1].trim(), reason: reasonMatch[2].trim() });
    } else {
      queries.push({ query: stripped, reason: '' });
    }
  }

  return { messageId, queries };
}
