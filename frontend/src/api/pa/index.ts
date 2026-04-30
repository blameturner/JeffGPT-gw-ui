import { http } from '../../lib/http';
import { defaultOrgId } from '../home/config';

export interface AnchoredAsk {
  id: string;
  title: string;
  status: 'open' | 'closed' | 'snoozed' | string;
  age_seconds: number;
  last_nudge_at?: string;
  source?: string;
}
export interface PATopic {
  id: string;
  title: string;
  brief?: string;
  warmth?: number;
  last_active?: string;
  source_count?: number;
  engagement?: number;
  muted?: boolean;
  sources?: Array<{ id: string; url?: string; title?: string }>;
}
export interface PAFeedItem {
  id: string;
  kind: 'topic' | 'nudge' | string;
  title: string;
  summary?: string;
  created_at: string;
  ref_id?: string;
}

const orgParam = () => ({ org_id: defaultOrgId() });

export const paPageApi = {
  anchoredAsks: (status: 'open' | 'closed' | 'snoozed' | 'all' = 'open', limit = 100) =>
    http
      .get('api/pa/anchored-asks', { searchParams: { ...orgParam(), status, limit } })
      .json<{ asks: AnchoredAsk[] }>(),
  closeAsk: (id: string) =>
    http.post(`api/pa/anchored-asks/${encodeURIComponent(id)}/close`, { json: orgParam() }).json<{ ok: boolean }>(),
  snoozeAsk: (id: string, hours = 24) =>
    http
      .post(`api/pa/anchored-asks/${encodeURIComponent(id)}/snooze`, {
        json: { ...orgParam(), hours },
      })
      .json<{ ok: boolean }>(),
  nudgeAsk: (id: string) =>
    http.post(`api/pa/anchored-asks/${encodeURIComponent(id)}/nudge`, { json: orgParam() }).json<{ ok: boolean }>(),
  topics: (limit = 60) =>
    http.get('api/pa/topics', { searchParams: { ...orgParam(), limit } }).json<{ topics: PATopic[] }>(),
  topic: (id: string) =>
    http.get(`api/pa/topics/${encodeURIComponent(id)}`, { searchParams: orgParam() }).json<PATopic>(),
  muteTopic: (id: string) =>
    http.post(`api/pa/topics/${encodeURIComponent(id)}/mute`, { json: orgParam() }).json<{ ok: boolean }>(),
  researchTopic: (id: string) =>
    http
      .post(`api/pa/topics/${encodeURIComponent(id)}/research-now`, { json: orgParam() })
      .json<{ job_id?: string; ok: boolean }>(),
  feed: (limit = 50, since?: string) => {
    const searchParams: Record<string, string | number> = { ...orgParam(), limit };
    if (since) searchParams.since = since;
    return http.get('api/pa/feed', { searchParams }).json<{ items: PAFeedItem[] }>();
  },
};
