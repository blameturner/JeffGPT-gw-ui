# Home Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `/home` dashboard as the default landing page, folding the retired `/hub` tabs (Logs, Stats, Queue) alongside a new Dashboard tab that contains digest/feed/chat/questions/schedules/widgets per the spec.

**Architecture:** A new `features/home/` surface with a tabbed `HomePage`. Dashboard tab composes a three-column layout over `/home/*` endpoints. SSE chat reuses the project's existing async-generator pattern (`streamJob`). Existing `/hub` is deleted; its Logs/Stats/Queue content is migrated and rewired.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind, TanStack Router, `ky` HTTP client, native `EventSource`, `react-markdown` + `remark-gfm`.

**Spec:** [`docs/superpowers/specs/2026-04-22-home-dashboard-design.md`](../specs/2026-04-22-home-dashboard-design.md)

**Conventions used in this plan:**

- The gateway base URL is read via `gatewayUrl()` from `src/lib/runtime-env.ts`; do not introduce `VITE_API_BASE`.
- The default org id is read via `defaultOrgId()` added in Task 1; it reads `window.__ENV__.DEFAULT_ORG_ID` with fallback to `1`.
- The frontend has no unit-test harness. Each task ends with a **Verify** step that runs `npm -w frontend run build` (typecheck + bundle) and, when applicable, a manual UI check. Do not add vitest.
- Commits use Conventional Commits with scope `home`: `feat(home): …`, `refactor(home): …`, `chore(home): …`.

---

## Task 1: Home API config + shared types

**Files:**
- Create: `frontend/src/api/home/config.ts`
- Create: `frontend/src/api/home/types.ts`

- [ ] **Step 1: Create `config.ts`**

```ts
// frontend/src/api/home/config.ts
declare global {
  interface Window {
    __ENV__?: { GATEWAY_URL?: string; DEFAULT_ORG_ID?: string | number };
  }
}

export function defaultOrgId(): number {
  const raw = typeof window !== 'undefined' ? window.__ENV__?.DEFAULT_ORG_ID : undefined;
  const n = typeof raw === 'number' ? raw : raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 1;
}
```

- [ ] **Step 2: Create `types.ts`**

```ts
// frontend/src/api/home/types.ts
export interface DigestMeta {
  id: number;
  date: string;
  markdown: string | null;
  markdown_available: boolean;
  path: string;
  cluster_count: number;
  source_count: number;
  created_at: string;
}

export interface Question {
  id: number;
  org_id: number;
  question_text: string;
  suggested_options: { label: string; value: string }[];
  context_ref: string;
  followup_action: string;
  status: 'pending' | 'answered' | 'dismissed';
  answer_selected_option: string;
  answer_text: string;
  conversation_id: number | null;
  message_id: number | null;
  created_at: string;
  answered_at: string | null;
}

export interface Insight {
  id: number;
  org_id: number;
  title: string;
  topic: string;
  body_markdown: string;
  summary: string;
  trigger: 'chat_idle' | 'fallback_twice_daily' | 'manual' | 'question_followup';
  status: 'draft' | 'published' | 'archived';
  research_plan_id: number | null;
  related_entities: string[];
  sources: { url: string; title: string }[];
  created_at: string;
  surfaced_at: string | null;
}

export interface Schedule {
  id: number;
  agent_name: string;
  task_description: string;
  product: string;
  cron_expression: string;
  timezone: string;
  org_id: number;
  active: boolean;
  next_run_time: string | null;
}

export type FeedItemKind = 'digest' | 'insight' | 'question' | 'run';

export interface FeedItem {
  kind: FeedItemKind;
  id: number;
  title: string;
  snippet: string;
  created_at: string;
  ref: Record<string, unknown>;
}

export interface HomeConversationRef {
  id: number;
  title: string;
  model: string;
  last_message_at: string | null;
}

export interface WidgetEnvelope<T> {
  enabled: boolean;
  message: string;
  data: T | null;
}

export interface GraphWidgetData {
  top_entities: { type: string; name: string; degree: number }[];
  sparse_concepts: string[];
  recent_edges: { from: string; relationship: string; to: string }[];
}

export interface ActivityWidgetData {
  runs: {
    id: number;
    agent_name: string;
    status: string;
    summary: string;
    duration_seconds: number;
    tokens_total: number;
    created_at: string;
  }[];
}

export interface HomeOverview {
  org_id: number;
  digest: DigestMeta | null;
  pending_questions: Question[];
  recent_insights: Insight[];
  home_conversation: HomeConversationRef | null;
  schedules: Schedule[];
  widgets: {
    email: WidgetEnvelope<null>;
    calendar: WidgetEnvelope<null>;
    graph: WidgetEnvelope<GraphWidgetData>;
  };
}

export interface HomeHealth {
  scheduler_running: boolean;
  tables: {
    daily_digests: boolean;
    assistant_questions: boolean;
    insights: boolean;
    digest_feedback: boolean;
  };
  features: { home: boolean; daily_digest: boolean; insights: boolean };
  seconds_since_chat: number | null;
}
```

- [ ] **Step 3: Verify**

Run: `npm -w frontend run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/home/config.ts frontend/src/api/home/types.ts
git commit -m "feat(home): add home api config and shared types"
```

---

## Task 2: Home API clients (read endpoints)

**Files:**
- Create: `frontend/src/api/home/overview.ts`
- Create: `frontend/src/api/home/health.ts`
- Create: `frontend/src/api/home/feed.ts`
- Create: `frontend/src/api/home/digest.ts`
- Create: `frontend/src/api/home/insights.ts`
- Create: `frontend/src/api/home/questions.ts`
- Create: `frontend/src/api/home/schedules.ts`
- Create: `frontend/src/api/home/widgets.ts`
- Create: `frontend/src/api/home/search.ts`
- Create: `frontend/src/api/home/conversationExport.ts`

- [ ] **Step 1: Add `overview.ts`**

```ts
// frontend/src/api/home/overview.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { HomeOverview } from './types';

export function getHomeOverview(orgId: number = defaultOrgId()) {
  return http
    .get('home/overview', { searchParams: { org_id: orgId } })
    .json<HomeOverview>();
}
```

- [ ] **Step 2: Add `health.ts`**

```ts
// frontend/src/api/home/health.ts
import { http } from '../../lib/http';
import type { HomeHealth } from './types';

export function getHomeHealth() {
  return http.get('home/health').json<HomeHealth>();
}
```

- [ ] **Step 3: Add `feed.ts`**

```ts
// frontend/src/api/home/feed.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { FeedItem } from './types';

export function listHomeFeed(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 25;
  return http
    .get('home/feed', { searchParams: { org_id: orgId, limit } })
    .json<{ items: FeedItem[] }>();
}
```

- [ ] **Step 4: Add `digest.ts`**

```ts
// frontend/src/api/home/digest.ts
import { http, HTTPError } from '../../lib/http';
import { defaultOrgId } from './config';
import type { DigestMeta } from './types';

export async function getDigest(opts: { orgId?: number; date?: string } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const search: Record<string, string | number> = { org_id: orgId };
  if (opts.date) search.date = opts.date;
  try {
    return await http.get('home/digest', { searchParams: search }).json<DigestMeta>();
  } catch (err) {
    if (err instanceof HTTPError && err.response.status === 404) return null;
    throw err;
  }
}

export function listDigests(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 7;
  return http
    .get('home/digests', { searchParams: { org_id: orgId, limit } })
    .json<{ digests: DigestMeta[] }>();
}
```

Note: `lib/http.ts` currently only exports `http`. If `HTTPError` is not
re-exported, add `export { HTTPError } from 'ky';` to `lib/http.ts`.

- [ ] **Step 5: Add `insights.ts`**

```ts
// frontend/src/api/home/insights.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { Insight } from './types';

export function listInsights(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 10;
  return http
    .get('home/insights', { searchParams: { org_id: orgId, limit } })
    .json<{ insights: Insight[] }>();
}

export function getInsight(id: number) {
  return http.get(`home/insights/${id}`).json<Insight>();
}
```

- [ ] **Step 6: Add `questions.ts`**

```ts
// frontend/src/api/home/questions.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { Question } from './types';

export function listQuestions(opts: {
  orgId?: number;
  status?: 'pending';
  limit?: number;
} = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const status = opts.status ?? 'pending';
  const limit = opts.limit ?? 20;
  return http
    .get('home/questions', { searchParams: { org_id: orgId, status, limit } })
    .json<{ questions: Question[] }>();
}
```

- [ ] **Step 7: Add `schedules.ts`**

```ts
// frontend/src/api/home/schedules.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { Schedule } from './types';

export function listSchedules(orgId: number = defaultOrgId()) {
  return http
    .get('home/schedules', { searchParams: { org_id: orgId } })
    .json<{ schedules: Schedule[] }>();
}
```

- [ ] **Step 8: Add `widgets.ts`**

```ts
// frontend/src/api/home/widgets.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type {
  WidgetEnvelope,
  GraphWidgetData,
  ActivityWidgetData,
} from './types';

export function getEmailWidget() {
  return http.get('home/widgets/email').json<WidgetEnvelope<null>>();
}

export function getCalendarWidget() {
  return http.get('home/widgets/calendar').json<WidgetEnvelope<null>>();
}

export function getGraphWidget(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 10;
  return http
    .get('home/widgets/graph', { searchParams: { org_id: orgId, limit } })
    .json<WidgetEnvelope<GraphWidgetData>>();
}

export function getActivityWidget(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 10;
  return http
    .get('home/widgets/activity', { searchParams: { org_id: orgId, limit } })
    .json<WidgetEnvelope<ActivityWidgetData>>();
}
```

- [ ] **Step 9: Add `search.ts`**

```ts
// frontend/src/api/home/search.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';

export interface HomeSearchHit {
  text: string;
  metadata: Record<string, unknown> & {
    source?: string;
    kind?: string;
    chunk_index?: number;
  };
  distance: number;
}

export function searchHome(opts: {
  query: string;
  orgId?: number;
  collection?: 'agent_outputs' | 'daily_digests' | 'chat_knowledge';
  nResults?: number;
}) {
  return http
    .post('home/search', {
      json: {
        org_id: opts.orgId ?? defaultOrgId(),
        query: opts.query,
        collection: opts.collection ?? 'agent_outputs',
        n_results: opts.nResults ?? 8,
      },
    })
    .json<{ query: string; collection: string; hits: HomeSearchHit[] }>();
}
```

- [ ] **Step 10: Add `conversationExport.ts`**

```ts
// frontend/src/api/home/conversationExport.ts
import { defaultOrgId } from './config';
import { gatewayUrl } from '../../lib/runtime-env';

export function homeConversationExportUrl(orgId: number = defaultOrgId()): string {
  return `${gatewayUrl()}/home/conversation/export?org_id=${orgId}`;
}

export async function downloadHomeConversation(orgId: number = defaultOrgId()) {
  const res = await fetch(homeConversationExportUrl(orgId), { credentials: 'include' });
  if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
  const text = await res.text();
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `home-conversation-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 11: Verify**

Run: `npm -w frontend run build`
Expected: build succeeds. If `HTTPError` is missing, update `lib/http.ts`:

```ts
// append to frontend/src/lib/http.ts
export { HTTPError } from 'ky';
```

- [ ] **Step 12: Commit**

```bash
git add frontend/src/api/home/ frontend/src/lib/http.ts
git commit -m "feat(home): add home api read clients"
```

---

## Task 3: Home API clients (mutations)

**Files:**
- Create: `frontend/src/api/home/mutations.ts`

- [ ] **Step 1: Create the file**

```ts
// frontend/src/api/home/mutations.ts
import { http, HTTPError } from '../../lib/http';
import { defaultOrgId } from './config';

export interface JobResponse {
  job_id: string;
}

export interface QueuedResponse {
  status: 'queued';
  tool_job_id: string;
}

export async function runDigest(orgId: number = defaultOrgId()): Promise<QueuedResponse> {
  return http.post('home/digest/run', { json: { org_id: orgId } }).json<QueuedResponse>();
}

export type FeedbackSignal = 'up' | 'down';

export async function postDigestFeedback(args: {
  digestId: number;
  signal: FeedbackSignal;
  domain?: string;
  note?: string;
  orgId?: number;
}): Promise<{ ok: boolean; notConfigured?: boolean; id?: number }> {
  try {
    const json = await http
      .post(`home/digest/${args.digestId}/feedback`, {
        json: {
          org_id: args.orgId ?? defaultOrgId(),
          signal: args.signal,
          domain: args.domain ?? '',
          note: args.note ?? '',
        },
      })
      .json<{ status: 'ok'; id: number }>();
    return { ok: true, id: json.id };
  } catch (err) {
    if (err instanceof HTTPError && err.response.status === 503) {
      return { ok: false, notConfigured: true };
    }
    throw err;
  }
}

export async function produceInsight(opts: {
  orgId?: number;
  topicHint?: string | null;
} = {}): Promise<QueuedResponse> {
  return http
    .post('home/insights/produce', {
      json: {
        org_id: opts.orgId ?? defaultOrgId(),
        topic_hint: opts.topicHint ?? null,
      },
    })
    .json<QueuedResponse>();
}

export async function answerQuestion(args: {
  id: number;
  selectedOption: string;
  answerText: string;
  orgId?: number;
}): Promise<JobResponse> {
  return http
    .post(`home/questions/${args.id}/answer`, {
      json: {
        org_id: args.orgId ?? defaultOrgId(),
        selected_option: args.selectedOption,
        answer_text: args.answerText,
        model: 'chat',
        response_style: null,
      },
    })
    .json<JobResponse>();
}

export async function dismissQuestion(args: {
  id: number;
  reason?: string;
  orgId?: number;
}): Promise<{ status: 'dismissed' }> {
  return http
    .post(`home/questions/${args.id}/dismiss`, {
      json: { org_id: args.orgId ?? defaultOrgId(), reason: args.reason ?? '' },
    })
    .json<{ status: 'dismissed' }>();
}

export async function retractQuestion(args: {
  id: number;
  orgId?: number;
}): Promise<{ status: 'pending' }> {
  return http
    .post(`home/questions/${args.id}/retract`, {
      json: { org_id: args.orgId ?? defaultOrgId() },
    })
    .json<{ status: 'pending' }>();
}

export async function sendHomeChat(args: {
  message: string;
  orgId?: number;
  searchMode?: 'disabled' | 'basic' | 'standard';
  searchConsentConfirmed?: boolean;
}): Promise<JobResponse> {
  return http
    .post('home/chat', {
      json: {
        org_id: args.orgId ?? defaultOrgId(),
        model: 'chat',
        message: args.message,
        response_style: null,
        search_mode: args.searchMode ?? 'basic',
        search_consent_confirmed: args.searchConsentConfirmed ?? false,
        temperature: null,
        max_tokens: null,
      },
    })
    .json<JobResponse>();
}

export async function runBriefing(orgId: number = defaultOrgId()): Promise<JobResponse> {
  return http
    .post('home/briefing', { searchParams: { org_id: orgId } })
    .json<JobResponse>();
}

export async function runSchedule(args: {
  id: number;
  task?: string | null;
  product?: string | null;
}): Promise<{ status: 'dispatched'; agent_name: string; org_id: number }> {
  return http
    .post(`home/schedules/${args.id}/run-now`, {
      json: { task: args.task ?? null, product: args.product ?? null },
    })
    .json<{ status: 'dispatched'; agent_name: string; org_id: number }>();
}

export function isRateLimited(err: unknown): boolean {
  return err instanceof HTTPError && err.response.status === 429;
}
```

- [ ] **Step 2: Verify**

Run: `npm -w frontend run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/home/mutations.ts
git commit -m "feat(home): add home api mutation clients"
```

---

## Task 4: SSE subscriber (`subscribeJob`)

The existing `streamJob` in `src/api/streamJob.ts` does POST-then-stream in a
single call. We need the inverse: **given an already-issued `job_id`, open
an SSE stream and emit typed events.** Built on the same endpoint
(`/api/stream/{job_id}`) the existing client uses, not `/stream/{job_id}` —
the gateway proxies the latter to the former.

**Files:**
- Create: `frontend/src/lib/sse/subscribeJob.ts`

- [ ] **Step 1: Create the subscriber**

```ts
// frontend/src/lib/sse/subscribeJob.ts
import { gatewayUrl } from '../runtime-env';

export type SseEvent =
  | { type: 'status'; message?: string }
  | { type: 'chunk'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done' }
  | { type: 'raw'; data: unknown };

export interface SubscribeJobHandle {
  close(): void;
}

export function subscribeJob(
  jobId: string,
  onEvent: (ev: SseEvent) => void,
): SubscribeJobHandle {
  let cursor = 0;
  let closed = false;
  let es: EventSource | null = null;

  function open() {
    if (closed) return;
    const url = `${gatewayUrl()}/api/stream/${encodeURIComponent(jobId)}?cursor=${cursor}`;
    es = new EventSource(url, { withCredentials: true });

    es.onmessage = (e) => {
      if (e.data === '[DONE]') {
        onEvent({ type: 'done' });
        cleanup();
        return;
      }
      if (e.lastEventId) {
        const n = parseInt(e.lastEventId, 10);
        if (Number.isFinite(n)) cursor = n + 1;
      }
      try {
        const parsed = JSON.parse(e.data);
        if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
          onEvent(parsed as SseEvent);
        } else {
          onEvent({ type: 'raw', data: parsed });
        }
      } catch {
        /* ignore malformed frame */
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; close on hard failure after repeated errors
      if (es && es.readyState === EventSource.CLOSED) {
        onEvent({ type: 'error', message: 'SSE connection closed' });
        cleanup();
      }
    };
  }

  function cleanup() {
    closed = true;
    if (es) {
      es.close();
      es = null;
    }
  }

  open();
  return { close: cleanup };
}
```

- [ ] **Step 2: Verify**

Run: `npm -w frontend run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/sse/subscribeJob.ts
git commit -m "feat(home): add job-id sse subscriber"
```

---

## Task 5: Toast system

**Files:**
- Create: `frontend/src/lib/toast/ToastHost.tsx`
- Create: `frontend/src/lib/toast/useToast.ts`
- Modify: `frontend/src/routes/__root.tsx`

- [ ] **Step 1: Create `ToastHost.tsx`**

```tsx
// frontend/src/lib/toast/ToastHost.tsx
import { useEffect, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
  ttl: number;
}

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

export function emitToast(text: string, kind: ToastKind = 'info', ttl = 4000) {
  const t: ToastItem = { id: ++counter, text, kind, ttl };
  listeners.forEach((fn) => fn(t));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((s) => [...s, t]);
      window.setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), t.ttl);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={[
            'pointer-events-auto min-w-[220px] max-w-[360px] rounded border px-3 py-2 text-[13px] shadow',
            t.kind === 'success' && 'border-fg/40 bg-bg text-fg',
            t.kind === 'error' && 'border-red-500 bg-bg text-red-400',
            t.kind === 'info' && 'border-border bg-bg text-fg',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `useToast.ts`**

```ts
// frontend/src/lib/toast/useToast.ts
import { emitToast } from './ToastHost';

export function useToast() {
  return {
    info: (text: string) => emitToast(text, 'info'),
    success: (text: string) => emitToast(text, 'success'),
    error: (text: string) => emitToast(text, 'error'),
  };
}
```

- [ ] **Step 3: Mount `ToastHost` in the root route**

Open `frontend/src/routes/__root.tsx`. Import `ToastHost` and render it once
inside the root component JSX (typically at the end, as a sibling of the
`<Outlet />`). Example diff idea:

```tsx
import { ToastHost } from '../lib/toast/ToastHost';
// ...
return (
  <>
    <Outlet />
    <ToastHost />
  </>
);
```

If `__root.tsx` already returns a fragment with outlet, just add `<ToastHost />` inside it.

- [ ] **Step 4: Verify**

Run: `npm -w frontend run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/toast/ frontend/src/routes/__root.tsx
git commit -m "feat(home): add toast host and hook"
```

---

## Task 6: `useOverview` hook

**Files:**
- Create: `frontend/src/features/home/hooks/useOverview.ts`

- [ ] **Step 1: Create the hook**

```ts
// frontend/src/features/home/hooks/useOverview.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getHomeOverview } from '../../../api/home/overview';
import { getHomeHealth } from '../../../api/home/health';
import type { HomeOverview, HomeHealth } from '../../../api/home/types';

interface State {
  overview: HomeOverview | null;
  health: HomeHealth | null;
  loading: boolean;
  error: string | null;
}

export function useOverview(pollMs = 60_000) {
  const [state, setState] = useState<State>({
    overview: null,
    health: null,
    loading: true,
    error: null,
  });
  const mounted = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const [overview, health] = await Promise.all([getHomeOverview(), getHomeHealth()]);
      if (!mounted.current) return;
      setState({ overview, health, loading: false, error: null });
    } catch (err) {
      if (!mounted.current) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refetch();
    const iv = window.setInterval(refetch, pollMs);
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted.current = false;
      window.clearInterval(iv);
      window.removeEventListener('focus', onFocus);
    };
  }, [pollMs, refetch]);

  return { ...state, refetch };
}
```

- [ ] **Step 2: Verify**

Run: `npm -w frontend run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/home/hooks/useOverview.ts
git commit -m "feat(home): add useOverview polling hook"
```

---

## Task 7: Relative time + misc utils

**Files:**
- Create: `frontend/src/lib/utils/formatRelative.ts`

- [ ] **Step 1: Create the util**

```ts
// frontend/src/lib/utils/formatRelative.ts
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso);
  const diff = (now.getTime() - then.getTime()) / 1000;
  if (Math.abs(diff) < 45) return 'just now';
  const past = diff >= 0;
  const abs = Math.abs(diff);
  const unit = (n: number, s: string) =>
    `${Math.round(n)}${s} ${past ? 'ago' : 'from now'}`;
  if (abs < 3600) return unit(abs / 60, 'm');
  if (abs < 86400) return unit(abs / 3600, 'h');
  if (abs < 86400 * 7) return unit(abs / 86400, 'd');
  return then.toLocaleDateString();
}

export function formatSecondsSinceChat(seconds: number | null | undefined): string {
  if (seconds == null) return 'no chats yet';
  if (seconds < 60) return `${Math.round(seconds)}s since last chat`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m since last chat`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h since last chat`;
  return `${Math.round(seconds / 86400)}d since last chat`;
}
```

- [ ] **Step 2: Verify + commit**

```bash
npm -w frontend run build
git add frontend/src/lib/utils/formatRelative.ts
git commit -m "feat(home): add relative time formatters"
```

---

## Task 8: Route wiring — add `/home`, redirect `/`, redirect `/hub`

**Files:**
- Create: `frontend/src/routes/home.tsx`
- Create: `frontend/src/features/home/HomePage.tsx` (temporary placeholder)
- Modify: `frontend/src/routes/index.tsx`
- Modify: `frontend/src/routes/hub.tsx`

- [ ] **Step 1: Create a placeholder `HomePage`**

```tsx
// frontend/src/features/home/HomePage.tsx
export function HomePage() {
  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans p-8">
      <h1 className="font-display text-2xl tracking-tightest">Home</h1>
      <p className="text-muted mt-2 text-sm">Dashboard coming online…</p>
    </div>
  );
}
```

- [ ] **Step 2: Register the route**

```tsx
// frontend/src/routes/home.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { HomePage } from '../features/home/HomePage';
import { setupStatus } from '../api/auth/setupStatus';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/home')({
  beforeLoad: async () => {
    try {
      const status = await setupStatus();
      if (!status.configured) throw redirect({ to: '/setup' });
    } catch (err) {
      if ((err as any)?.routerCode) throw err;
      throw redirect({ to: '/setup' });
    }
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: '/login' });
  },
  component: HomePage,
});
```

- [ ] **Step 3: Redirect `/` to `/home`**

Modify `frontend/src/routes/index.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { setupStatus } from '../api/auth/setupStatus';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      const status = await setupStatus();
      if (!status.configured) throw redirect({ to: '/setup' });
    } catch (err) {
      if ((err as any)?.routerCode) throw err;
      throw redirect({ to: '/setup' });
    }
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: '/login' });
    throw redirect({ to: '/home' });
  },
  component: () => null,
});
```

- [ ] **Step 4: Make `/hub` redirect to `/home`**

Modify `frontend/src/routes/hub.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/hub')({
  beforeLoad: () => {
    throw redirect({ to: '/home' });
  },
  component: () => null,
});
```

- [ ] **Step 5: Regenerate route tree and verify**

Run: `npm -w frontend run build`
Expected: build succeeds. `src/routeTree.gen.ts` updates (regenerated by the vite plugin).

- [ ] **Step 6: Manual check**

Run: `npm -w frontend run dev`
- Visit `/` → redirects to `/home` → placeholder appears.
- Visit `/hub` → redirects to `/home`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/routes/home.tsx frontend/src/routes/index.tsx frontend/src/routes/hub.tsx frontend/src/features/home/HomePage.tsx frontend/src/routeTree.gen.ts
git commit -m "feat(home): add /home route and redirect / and /hub"
```

---

## Task 9: Migrate Logs / Stats / Queue tabs out of hub

The existing `features/hub/` provides: `HomePage` (will be replaced), `HomeTab`,
`StatsTab`, `QueueTab`, components (`DailyChart`, `DetailPanel`, `FlowStep`,
`Heatmap`, `StackArrow`, `StackNode`, `StatCard`), `constants`, `types`,
`utils`. Move everything we still need under `features/home/` so the `hub`
folder can be deleted cleanly.

**Files:**
- Create: `frontend/src/features/home/legacy/` (directory)
- Move: `frontend/src/features/hub/components/*` → `frontend/src/features/home/legacy/components/*`
- Move: `frontend/src/features/hub/constants/*` → `frontend/src/features/home/legacy/constants/*`
- Move: `frontend/src/features/hub/utils/*` → `frontend/src/features/home/legacy/utils/*`
- Move: `frontend/src/features/hub/types/*` → `frontend/src/features/home/legacy/types/*` (except `HubTab`, which is deleted)
- Move: `frontend/src/features/hub/tabs/StatsTab.tsx` → `frontend/src/features/home/tabs/StatsTab.tsx`
- Move: `frontend/src/features/hub/tabs/QueueTab.tsx` → `frontend/src/features/home/tabs/QueueTab.tsx`
- Move: `frontend/src/features/hub/tabs/HomeTab.tsx` → `frontend/src/features/home/legacy/HomeTabLegacy.tsx` (renamed — it becomes the Overview section in Task 17)
- Move: `frontend/src/features/hub/tabs/research/**` → `frontend/src/features/home/legacy/research/**`
- Move: `frontend/src/features/hub/tabs/ops/**` → `frontend/src/features/home/legacy/ops/**`

- [ ] **Step 1: Move files with `git mv`**

```bash
cd frontend/src
mkdir -p features/home/legacy features/home/tabs
git mv features/hub/components features/home/legacy/components
git mv features/hub/constants features/home/legacy/constants
git mv features/hub/utils features/home/legacy/utils
git mv features/hub/types features/home/legacy/types
git mv features/hub/tabs/StatsTab.tsx features/home/tabs/StatsTab.tsx
git mv features/hub/tabs/QueueTab.tsx features/home/tabs/QueueTab.tsx
git mv features/hub/tabs/HomeTab.tsx features/home/legacy/HomeTabLegacy.tsx
git mv features/hub/tabs/research features/home/legacy/research
git mv features/hub/tabs/ops features/home/legacy/ops
```

- [ ] **Step 2: Delete the now-empty `features/hub/` tree**

```bash
git rm frontend/src/features/hub/HubPage.tsx
git rm -rf frontend/src/features/hub
```

Also delete `features/home/legacy/types/HubTab.ts` if it was moved — it's no
longer needed (the new shell defines its own tab union):

```bash
git rm frontend/src/features/home/legacy/types/HubTab.ts 2>/dev/null || true
```

- [ ] **Step 3: Rewrite imports in moved files**

The moved files import each other using relative paths like `'../components/StatCard'`
and `'../../api/...'`. Depth changes for the `/api/...` references because the
tabs moved from `features/hub/tabs/` to `features/home/tabs/` (same depth — three
levels), and legacy components moved from `features/hub/components/` to
`features/home/legacy/components/` (one level deeper).

Run a grep to find broken imports and fix each:

```bash
npm -w frontend run build 2>&1 | grep -E "Cannot find module|TS2307" | head -40
```

Fix each reported import by adjusting relative depth. Typical patterns:

- In `features/home/legacy/components/*` files, `'../../../api/...'` becomes `'../../../../api/...'`.
- In `features/home/legacy/research/*` and `legacy/ops/*`, similarly add one `../`.
- In `features/home/tabs/StatsTab.tsx` and `QueueTab.tsx`, references previously
  like `'../components/StatCard'` become `'../legacy/components/StatCard'`, and
  `'../../../api/...'` stays unchanged (same depth).
- In `features/home/legacy/HomeTabLegacy.tsx`, its imports of `'../../../api/...'`
  become `'../../../../api/...'`.

Repeat build + fix until clean.

- [ ] **Step 4: Verify**

Run: `npm -w frontend run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/features
git commit -m "refactor(home): migrate hub tabs into features/home, delete hub"
```

---

## Task 10: Home page shell — tabs + health banner

**Files:**
- Modify: `frontend/src/features/home/HomePage.tsx`
- Create: `frontend/src/features/home/tabs/DashboardTab.tsx` (stub)
- Create: `frontend/src/features/home/tabs/LogsTab.tsx`
- Create: `frontend/src/features/home/dashboard/UnhealthyBanner.tsx`

- [ ] **Step 1: Create `UnhealthyBanner`**

```tsx
// frontend/src/features/home/dashboard/UnhealthyBanner.tsx
import type { HomeHealth } from '../../../api/home/types';

interface Props { health: HomeHealth | null }

function problems(h: HomeHealth): string[] {
  const out: string[] = [];
  if (!h.scheduler_running) out.push('scheduler not running');
  const missing = Object.entries(h.tables)
    .filter(([k, v]) => !v && k !== 'digest_feedback')
    .map(([k]) => k);
  if (missing.length) out.push(`missing tables: ${missing.join(', ')}`);
  return out;
}

export function UnhealthyBanner({ health }: Props) {
  if (!health) return null;
  const ps = problems(health);
  if (ps.length === 0) return null;
  return (
    <div className="border-b border-red-500 bg-red-500/10 px-8 py-2 text-[12px] text-red-400">
      Unhealthy — {ps.join(' · ')}
    </div>
  );
}
```

- [ ] **Step 2: Create `LogsTab`**

```tsx
// frontend/src/features/home/tabs/LogsTab.tsx
import { LogsPage } from '../../logs/LogsPage';
export function LogsTab() { return <LogsPage />; }
```

- [ ] **Step 3: Create `DashboardTab` stub**

```tsx
// frontend/src/features/home/tabs/DashboardTab.tsx
import type { HomeOverview, HomeHealth } from '../../../api/home/types';

interface Props { overview: HomeOverview | null; health: HomeHealth | null; refetch: () => void; }

export function DashboardTab(_props: Props) {
  return <div className="p-8 text-sm text-muted">Dashboard — content in next tasks.</div>;
}
```

- [ ] **Step 4: Rewrite `HomePage`**

```tsx
// frontend/src/features/home/HomePage.tsx
import { useState } from 'react';
import { useOverview } from './hooks/useOverview';
import { UnhealthyBanner } from './dashboard/UnhealthyBanner';
import { DashboardTab } from './tabs/DashboardTab';
import { LogsTab } from './tabs/LogsTab';
import { StatsTab } from './tabs/StatsTab';
import { QueueTab } from './tabs/QueueTab';

type Tab = 'dashboard' | 'logs' | 'stats' | 'queue';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'logs', label: 'Logs' },
  { id: 'stats', label: 'Stats' },
  { id: 'queue', label: 'Queue' },
];

export function HomePage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { overview, health, loading, refetch } = useOverview();

  const ok = health && health.scheduler_running;

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <header className="shrink-0 border-b border-border px-8 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tightest">Home</h1>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              ok ? 'bg-fg' : health ? 'bg-muted' : 'bg-border animate-blink'
            }`}
          />
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {loading ? 'Checking' : ok ? 'All connected' : health ? 'Degraded' : 'Gateway unreachable'}
          </span>
        </div>
      </header>

      <UnhealthyBanner health={health} />

      <nav className="shrink-0 border-b border-border px-8 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-4 py-3 text-[11px] uppercase tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'dashboard' && <DashboardTab overview={overview} health={health} refetch={refetch} />}
        {tab === 'logs' && <LogsTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'queue' && <QueueTab />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm -w frontend run build
npm -w frontend run dev
```

Expected: Build succeeds. Visiting `/home` shows Home header + tabs; Logs/Stats/Queue tabs render as before; Dashboard tab shows the placeholder.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/home
git commit -m "feat(home): add HomePage shell with tabs and health banner"
```

---

## Task 11: GreetingStrip

**Files:**
- Create: `frontend/src/features/home/dashboard/GreetingStrip.tsx`
- Create: `frontend/src/features/home/dashboard/ProduceInsightPopover.tsx`

- [ ] **Step 1: Create `ProduceInsightPopover`**

```tsx
// frontend/src/features/home/dashboard/ProduceInsightPopover.tsx
import { useState } from 'react';

interface Props {
  onSubmit: (topicHint: string | null) => void;
  onClose: () => void;
}

export function ProduceInsightPopover({ onSubmit, onClose }: Props) {
  const [text, setText] = useState('');
  return (
    <div className="absolute right-0 top-full mt-2 z-10 w-80 rounded border border-border bg-bg p-3 shadow-lg">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
        Optional topic hint
      </p>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Leave blank to auto-pick"
        className="w-full border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-fg"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(text.trim() || null);
          if (e.key === 'Escape') onClose();
        }}
      />
      <div className="mt-3 flex justify-end gap-2">
        <button className="text-[12px] text-muted hover:text-fg" onClick={onClose}>
          Cancel
        </button>
        <button
          className="border border-fg px-3 py-1 text-[12px] text-fg hover:bg-fg hover:text-bg"
          onClick={() => onSubmit(text.trim() || null)}
        >
          Produce
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `GreetingStrip`**

```tsx
// frontend/src/features/home/dashboard/GreetingStrip.tsx
import { useState } from 'react';
import type { HomeHealth } from '../../../api/home/types';
import { formatSecondsSinceChat } from '../../../lib/utils/formatRelative';
import { useToast } from '../../../lib/toast/useToast';
import { runDigest, produceInsight, runBriefing } from '../../../api/home/mutations';
import { subscribeJob } from '../../../lib/sse/subscribeJob';
import { ProduceInsightPopover } from './ProduceInsightPopover';

interface Props {
  health: HomeHealth | null;
  onAfterMutate: () => void; // refetch overview
  onChatStream: (jobId: string) => void; // hand briefing stream to HomeChat
}

export function GreetingStrip({ health, onAfterMutate, onChatStream }: Props) {
  const toast = useToast();
  const [producing, setProducing] = useState(false);
  const [showInsight, setShowInsight] = useState(false);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  async function handleDigest() {
    try {
      await runDigest();
      toast.success("Digest queued — it'll appear in a minute");
      // Poll overview for up to 2 minutes
      const start = Date.now();
      const iv = window.setInterval(() => {
        onAfterMutate();
        if (Date.now() - start > 2 * 60_000) window.clearInterval(iv);
      }, 10_000);
    } catch (err) {
      toast.error(`Digest failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function handleInsight(topicHint: string | null) {
    setShowInsight(false);
    setProducing(true);
    try {
      await produceInsight({ topicHint });
      toast.success('Insight queued — ~60s');
      window.setTimeout(onAfterMutate, 60_000);
    } catch (err) {
      toast.error(`Insight failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setProducing(false);
    }
  }

  async function handleBrief() {
    try {
      const { job_id } = await runBriefing();
      onChatStream(job_id);
      toast.info('Briefing streaming into chat…');
    } catch (err) {
      toast.error(`Briefing failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-border px-8 py-4">
      <div>
        <div className="font-display text-lg tracking-tightest">{today}</div>
        <div className="text-[12px] text-muted mt-1">
          {formatSecondsSinceChat(health?.seconds_since_chat)}
        </div>
      </div>
      <div className="flex items-center gap-2 relative">
        <button
          data-shortcut="brief"
          className="border border-border px-3 py-1.5 text-[12px] uppercase tracking-[0.14em] hover:border-fg"
          onClick={handleBrief}
        >
          Brief me
        </button>
        <button
          data-shortcut="digest"
          className="border border-border px-3 py-1.5 text-[12px] uppercase tracking-[0.14em] hover:border-fg"
          onClick={handleDigest}
        >
          Run digest
        </button>
        <div className="relative">
          <button
            disabled={producing}
            className="border border-border px-3 py-1.5 text-[12px] uppercase tracking-[0.14em] hover:border-fg disabled:opacity-50"
            onClick={() => setShowInsight((v) => !v)}
          >
            {producing ? 'Queuing…' : 'Produce insight'}
          </button>
          {showInsight && (
            <ProduceInsightPopover
              onSubmit={handleInsight}
              onClose={() => setShowInsight(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

Note: the `subscribeJob` import is unused here but kept in the plan's import
list because downstream components need it; remove this line if tsc flags it.

- [ ] **Step 3: Verify**

Run: `npm -w frontend run build`
Expected: build succeeds. If `subscribeJob` import triggers unused-var
error, delete it from `GreetingStrip.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/home/dashboard/GreetingStrip.tsx frontend/src/features/home/dashboard/ProduceInsightPopover.tsx
git commit -m "feat(home): add greeting strip with quick actions"
```

---

## Task 12: Feed + FeedItem

**Files:**
- Create: `frontend/src/features/home/dashboard/FeedItem.tsx`
- Create: `frontend/src/features/home/dashboard/Feed.tsx`

- [ ] **Step 1: Create `FeedItem`**

```tsx
// frontend/src/features/home/dashboard/FeedItem.tsx
import type { FeedItem as FeedItemT } from '../../../api/home/types';
import { formatRelative } from '../../../lib/utils/formatRelative';

interface Props {
  item: FeedItemT;
  onClick: (item: FeedItemT) => void;
}

const KIND_LABEL: Record<FeedItemT['kind'], string> = {
  digest: 'DIGEST',
  insight: 'INSIGHT',
  question: 'QUESTION',
  run: 'RUN',
};

export function FeedItem({ item, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(item)}
      className="w-full text-left border border-border px-4 py-3 hover:border-fg transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
          {KIND_LABEL[item.kind]}
        </span>
        <span className="text-[11px] text-muted">{formatRelative(item.created_at)}</span>
      </div>
      <div className="font-sans text-[14px] text-fg mt-1">{item.title}</div>
      {item.snippet && (
        <div className="text-[12px] text-muted mt-1 line-clamp-3">{item.snippet}</div>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Create `Feed`**

```tsx
// frontend/src/features/home/dashboard/Feed.tsx
import { useEffect, useState, useCallback } from 'react';
import { listHomeFeed } from '../../../api/home/feed';
import type { FeedItem as FeedItemT } from '../../../api/home/types';
import { FeedItem } from './FeedItem';

interface Props {
  onOpen: (item: FeedItemT) => void;
}

export function Feed({ onOpen }: Props) {
  const [items, setItems] = useState<FeedItemT[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await listHomeFeed({ limit: 25 });
      if (append) {
        // Append, de-duplicating by kind+id
        setItems((prev) => {
          const seen = new Set(prev.map((i) => `${i.kind}:${i.id}`));
          const next = res.items.filter((i) => !seen.has(`${i.kind}:${i.id}`));
          return [...prev, ...next];
        });
        if (res.items.length === 0) setHasMore(false);
      } else {
        setItems(res.items);
        setHasMore(res.items.length === 25);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
        No activity yet — run a digest or send a chat to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <FeedItem key={`${it.kind}-${it.id}`} item={it} onClick={onOpen} />
      ))}
      {hasMore && (
        <button
          disabled={loadingMore}
          onClick={() => load(true)}
          className="w-full border border-border px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-muted hover:border-fg hover:text-fg disabled:opacity-50"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
npm -w frontend run build
git add frontend/src/features/home/dashboard/Feed.tsx frontend/src/features/home/dashboard/FeedItem.tsx
git commit -m "feat(home): add feed with load-more"
```

---

## Task 13: QuestionsPanel

**Files:**
- Create: `frontend/src/features/home/dashboard/QuestionCard.tsx`
- Create: `frontend/src/features/home/dashboard/QuestionsPanel.tsx`

- [ ] **Step 1: `QuestionCard`**

```tsx
// frontend/src/features/home/dashboard/QuestionCard.tsx
import { useState, forwardRef } from 'react';
import type { Question } from '../../../api/home/types';

interface Props {
  q: Question;
  onAnswer: (q: Question, selectedOption: string, answerText: string) => void;
  onDismiss: (q: Question) => void;
}

export const QuestionCard = forwardRef<HTMLDivElement, Props>(function QuestionCard(
  { q, onAnswer, onDismiss },
  ref,
) {
  const [freeText, setFreeText] = useState('');
  return (
    <div ref={ref} className="border border-border p-4">
      <div className="text-sm text-fg">{q.question_text}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {q.suggested_options.map((opt) => (
          <button
            key={opt.value}
            data-question-option={q.id}
            className="border border-border px-3 py-1 text-[12px] hover:border-fg"
            onClick={() => onAnswer(q, opt.value, opt.label)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Or type a custom answer…"
          className="flex-1 border border-border bg-transparent px-2 py-1 text-[12px] outline-none focus:border-fg"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && freeText.trim()) onAnswer(q, '', freeText.trim());
          }}
        />
        <button
          className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-fg"
          onClick={() => onDismiss(q)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: `QuestionsPanel`**

```tsx
// frontend/src/features/home/dashboard/QuestionsPanel.tsx
import { useRef } from 'react';
import type { Question } from '../../../api/home/types';
import { answerQuestion, dismissQuestion } from '../../../api/home/mutations';
import { useToast } from '../../../lib/toast/useToast';
import { QuestionCard } from './QuestionCard';

interface Props {
  questions: Question[];
  onRefetch: () => void;
  onChatStream: (jobId: string) => void;
  registerScrollTarget?: (id: number, el: HTMLDivElement | null) => void;
}

export function QuestionsPanel({ questions, onRefetch, onChatStream, registerScrollTarget }: Props) {
  const toast = useToast();
  const refs = useRef<Map<number, HTMLDivElement>>(new Map());

  async function handleAnswer(q: Question, selectedOption: string, answerText: string) {
    try {
      const { job_id } = await answerQuestion({
        id: q.id,
        selectedOption,
        answerText,
      });
      onChatStream(job_id);
      toast.success('Answer sent');
      onRefetch();
    } catch (err) {
      toast.error(`Answer failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function handleDismiss(q: Question) {
    try {
      await dismissQuestion({ id: q.id });
      toast.info('Question dismissed');
      onRefetch();
    } catch (err) {
      toast.error(`Dismiss failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="border border-dashed border-border px-4 py-6 text-center text-[12px] text-muted">
        No pending questions.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted px-1">
        Pending questions
      </div>
      {questions.map((q) => (
        <QuestionCard
          key={q.id}
          q={q}
          ref={(el) => {
            if (el) refs.current.set(q.id, el);
            else refs.current.delete(q.id);
            registerScrollTarget?.(q.id, el);
          }}
          onAnswer={handleAnswer}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
npm -w frontend run build
git add frontend/src/features/home/dashboard/QuestionCard.tsx frontend/src/features/home/dashboard/QuestionsPanel.tsx
git commit -m "feat(home): add questions panel with answer/dismiss"
```

---

## Task 14: HomeChat + SSE wiring

**Files:**
- Create: `frontend/src/features/home/dashboard/ChatMessage.tsx`
- Create: `frontend/src/features/home/dashboard/HomeChat.tsx`
- Create: `frontend/src/features/home/hooks/useHomeChat.ts`

- [ ] **Step 1: `useHomeChat`**

```ts
// frontend/src/features/home/hooks/useHomeChat.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendHomeChat, isRateLimited } from '../../../api/home/mutations';
import { subscribeJob, type SubscribeJobHandle } from '../../../lib/sse/subscribeJob';
import { emitToast } from '../../../lib/toast/ToastHost';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
}

export function useHomeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const handles = useRef<SubscribeJobHandle[]>([]);

  const attachStream = useCallback((jobId: string) => {
    const localId = `a-${jobId}`;
    setMessages((m) => [...m, { id: localId, role: 'assistant', text: '', streaming: true }]);
    const h = subscribeJob(jobId, (ev) => {
      if (ev.type === 'chunk') {
        setMessages((m) =>
          m.map((msg) => (msg.id === localId ? { ...msg, text: msg.text + ev.text } : msg)),
        );
      } else if (ev.type === 'error') {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === localId ? { ...msg, streaming: false, text: msg.text + `\n\n[error: ${ev.message}]` } : msg,
          ),
        );
      } else if (ev.type === 'done') {
        setMessages((m) => m.map((msg) => (msg.id === localId ? { ...msg, streaming: false } : msg)));
      }
    });
    handles.current.push(h);
  }, []);

  const send = useCallback(
    async (text: string, searchMode: 'disabled' | 'basic' | 'standard' = 'basic') => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setSending(true);
      const userId = `u-${Date.now()}`;
      setMessages((m) => [...m, { id: userId, role: 'user', text: trimmed }]);
      try {
        const { job_id } = await sendHomeChat({ message: trimmed, searchMode });
        attachStream(job_id);
      } catch (err) {
        if (isRateLimited(err)) emitToast('Rate limited — slow down', 'error');
        else emitToast(`Chat failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
      } finally {
        setSending(false);
      }
    },
    [attachStream, sending],
  );

  useEffect(() => {
    return () => {
      handles.current.forEach((h) => h.close());
      handles.current = [];
    };
  }, []);

  return { messages, sending, send, attachStream };
}
```

- [ ] **Step 2: `ChatMessage`**

```tsx
// frontend/src/features/home/dashboard/ChatMessage.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as Msg } from '../hooks/useHomeChat';

export function ChatMessage({ m }: { m: Msg }) {
  const isUser = m.role === 'user';
  return (
    <div className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className={[
          'max-w-[90%] border px-3 py-2 text-[13px]',
          isUser ? 'border-fg text-fg' : 'border-border text-fg',
        ].join(' ')}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{m.text}</div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text || '…'}</ReactMarkdown>
          </div>
        )}
        {m.streaming && <span className="ml-1 inline-block animate-pulse text-muted">▍</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `HomeChat`**

```tsx
// frontend/src/features/home/dashboard/HomeChat.tsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { useHomeChat } from '../hooks/useHomeChat';
import { downloadHomeConversation } from '../../../api/home/conversationExport';

export interface HomeChatHandle {
  attachStream: (jobId: string) => void;
  focusInput: () => void;
}

export const HomeChat = forwardRef<HomeChatHandle>(function HomeChat(_props, ref) {
  const { messages, sending, send, attachStream } = useHomeChat();
  const [text, setText] = useState('');
  const [searchMode, setSearchMode] = useState<'disabled' | 'basic' | 'standard'>('basic');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    attachStream,
    focusInput: () => inputRef.current?.focus(),
  }));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const t = text;
    setText('');
    await send(t, searchMode);
  }

  return (
    <div className="flex h-full flex-col border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Home chat</div>
        <button
          onClick={() => downloadHomeConversation()}
          className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-fg"
        >
          Export
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-[12px] text-muted">
            Say hi. Today's digest is already in context.
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} m={m} />
        ))}
      </div>

      <div className="border-t border-border p-2 flex items-center gap-2">
        <select
          value={searchMode}
          onChange={(e) => setSearchMode(e.target.value as any)}
          className="border border-border bg-transparent text-[11px] uppercase tracking-[0.14em] px-1 py-1 text-muted"
        >
          <option value="disabled">No search</option>
          <option value="basic">Basic</option>
          <option value="standard">Standard</option>
        </select>
        <input
          ref={inputRef}
          data-chat-input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…  ( / to focus )"
          className="flex-1 border border-border bg-transparent px-2 py-1.5 text-[13px] outline-none focus:border-fg"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          disabled={sending || !text.trim()}
          onClick={handleSend}
          className="border border-fg px-3 py-1.5 text-[12px] uppercase tracking-[0.14em] text-fg hover:bg-fg hover:text-bg disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
});
```

- [ ] **Step 4: Verify + commit**

```bash
npm -w frontend run build
git add frontend/src/features/home/dashboard/ChatMessage.tsx frontend/src/features/home/dashboard/HomeChat.tsx frontend/src/features/home/hooks/useHomeChat.ts
git commit -m "feat(home): add home chat with sse streaming"
```

---

## Task 15: SchedulesPanel

**Files:**
- Create: `frontend/src/features/home/dashboard/SchedulesPanel.tsx`

- [ ] **Step 1: Create**

```tsx
// frontend/src/features/home/dashboard/SchedulesPanel.tsx
import type { Schedule } from '../../../api/home/types';
import { runSchedule } from '../../../api/home/mutations';
import { useToast } from '../../../lib/toast/useToast';
import { formatRelative } from '../../../lib/utils/formatRelative';

interface Props { schedules: Schedule[]; }

export function SchedulesPanel({ schedules }: Props) {
  const toast = useToast();

  async function handleRun(s: Schedule) {
    try {
      await runSchedule({ id: s.id });
      toast.success(`${s.agent_name} dispatched`);
    } catch (err) {
      toast.error(`Run failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return (
    <div className="border border-border">
      <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-muted">
        Schedules
      </div>
      {schedules.length === 0 && (
        <div className="p-3 text-[12px] text-muted">No schedules configured.</div>
      )}
      <ul className="divide-y divide-border">
        {schedules.map((s) => (
          <li key={s.id} className={['p-3', s.active ? '' : 'opacity-50'].join(' ')}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] text-fg truncate">{s.agent_name}</div>
                <div className="text-[11px] text-muted truncate">{s.cron_expression} · {s.timezone}</div>
                <div className="text-[11px] text-muted mt-0.5">
                  Next: {formatRelative(s.next_run_time)}
                </div>
              </div>
              <button
                className="border border-border px-2 py-1 text-[10px] uppercase tracking-[0.14em] hover:border-fg"
                onClick={() => handleRun(s)}
              >
                Run now
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
npm -w frontend run build
git add frontend/src/features/home/dashboard/SchedulesPanel.tsx
git commit -m "feat(home): add schedules panel"
```

---

## Task 16: Core widgets (Email, Calendar, Graph) + WidgetRail container

**Files:**
- Create: `frontend/src/features/home/dashboard/widgets/PlaceholderWidget.tsx`
- Create: `frontend/src/features/home/dashboard/widgets/EmailWidget.tsx`
- Create: `frontend/src/features/home/dashboard/widgets/CalendarWidget.tsx`
- Create: `frontend/src/features/home/dashboard/widgets/GraphWidget.tsx`
- Create: `frontend/src/features/home/dashboard/WidgetRail.tsx`

- [ ] **Step 1: `PlaceholderWidget`**

```tsx
// frontend/src/features/home/dashboard/widgets/PlaceholderWidget.tsx
interface Props { title: string; message: string; }
export function PlaceholderWidget({ title, message }: Props) {
  return (
    <div className="border border-dashed border-border p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{title}</div>
      <div className="text-[12px] text-muted mt-1">{message}</div>
    </div>
  );
}
```

- [ ] **Step 2: `EmailWidget` / `CalendarWidget`**

```tsx
// frontend/src/features/home/dashboard/widgets/EmailWidget.tsx
import type { WidgetEnvelope } from '../../../../api/home/types';
import { PlaceholderWidget } from './PlaceholderWidget';
export function EmailWidget({ env }: { env: WidgetEnvelope<null> | undefined }) {
  return <PlaceholderWidget title="Email" message={env?.message || 'Not configured'} />;
}
```

```tsx
// frontend/src/features/home/dashboard/widgets/CalendarWidget.tsx
import type { WidgetEnvelope } from '../../../../api/home/types';
import { PlaceholderWidget } from './PlaceholderWidget';
export function CalendarWidget({ env }: { env: WidgetEnvelope<null> | undefined }) {
  return <PlaceholderWidget title="Calendar" message={env?.message || 'Not configured'} />;
}
```

- [ ] **Step 3: `GraphWidget`**

```tsx
// frontend/src/features/home/dashboard/widgets/GraphWidget.tsx
import type { GraphWidgetData, WidgetEnvelope } from '../../../../api/home/types';
import { PlaceholderWidget } from './PlaceholderWidget';

export function GraphWidget({ env }: { env: WidgetEnvelope<GraphWidgetData> | undefined }) {
  if (!env?.enabled || !env.data) {
    return <PlaceholderWidget title="Graph" message={env?.message || 'Not configured'} />;
  }
  const { top_entities, sparse_concepts, recent_edges } = env.data;
  return (
    <div className="border border-border p-3 space-y-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Graph</div>
      {top_entities.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Top entities</div>
          <ul className="text-[12px] space-y-0.5">
            {top_entities.slice(0, 5).map((e) => (
              <li key={`${e.type}:${e.name}`} className="flex justify-between">
                <span className="truncate">{e.name}</span>
                <span className="text-muted">{e.degree}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sparse_concepts.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Sparse concepts</div>
          <div className="text-[12px] text-muted">{sparse_concepts.slice(0, 6).join(' · ')}</div>
        </div>
      )}
      {recent_edges.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Recent edges</div>
          <ul className="text-[12px] space-y-0.5">
            {recent_edges.slice(0, 4).map((e, i) => (
              <li key={i} className="truncate">
                {e.from} <span className="text-muted">→ {e.relationship} →</span> {e.to}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `WidgetRail` skeleton (code/chat/scrapers added next task)**

```tsx
// frontend/src/features/home/dashboard/WidgetRail.tsx
import type { HomeOverview } from '../../../api/home/types';
import { EmailWidget } from './widgets/EmailWidget';
import { CalendarWidget } from './widgets/CalendarWidget';
import { GraphWidget } from './widgets/GraphWidget';
import { CodeConvosWidget } from './widgets/CodeConvosWidget';
import { ChatConvosWidget } from './widgets/ChatConvosWidget';
import { ScrapersWidget } from './widgets/ScrapersWidget';

interface Props { overview: HomeOverview | null; }

export function WidgetRail({ overview }: Props) {
  return (
    <div className="space-y-2">
      <EmailWidget env={overview?.widgets.email} />
      <CalendarWidget env={overview?.widgets.calendar} />
      <GraphWidget env={overview?.widgets.graph} />
      <CodeConvosWidget />
      <ChatConvosWidget />
      <ScrapersWidget />
    </div>
  );
}
```

Note: the three "hub-derived" widgets are added in Task 17 — the import
lines here will fail until that task lands. To keep each task's build
green, temporarily comment those three imports/usages out and uncomment
them in Task 17.

- [ ] **Step 5: Verify + commit (with hub-widget imports commented out)**

```bash
npm -w frontend run build
git add frontend/src/features/home/dashboard/widgets frontend/src/features/home/dashboard/WidgetRail.tsx
git commit -m "feat(home): add email/calendar/graph widgets and rail"
```

---

## Task 17: Code / Chat / Scrapers widgets (reuse hub endpoints)

These widgets surface existing data that used to live on `/hub`. They
consume **existing** API clients only.

Endpoints to reuse (verified in the repo):
- Chat conversations: `src/api/chat/listConversations.ts` — returns the
  recent chat conversations.
- Code conversations: `src/api/code/listCodeConversations.ts` — returns the
  recent code conversations.
- Scrapers: `src/api/enrichment/research.ts` (`listResearchPlans`) for the
  research/scrape pipeline, or `src/api/queue/listQueueJobs.ts` filtered to
  scraper job types. Use `listResearchPlans` as the primary source; fall
  back to `listQueueJobs({ limit: 5 })` if no research plans exist.

**Files:**
- Create: `frontend/src/features/home/dashboard/widgets/CodeConvosWidget.tsx`
- Create: `frontend/src/features/home/dashboard/widgets/ChatConvosWidget.tsx`
- Create: `frontend/src/features/home/dashboard/widgets/ScrapersWidget.tsx`

- [ ] **Step 1: Inspect return shapes**

Before writing code, open `listConversations.ts`, `listCodeConversations.ts`,
`listResearchPlans` in `api/enrichment/research.ts`, and
`listQueueJobs.ts`. Record the field names for each. The widget code
below uses placeholders `title`, `id`, `updated_at` for chat/code and
`topic`, `status`, `updated_at` for research plans — adjust to the
actual field names seen in the source files.

- [ ] **Step 2: `ChatConvosWidget`**

```tsx
// frontend/src/features/home/dashboard/widgets/ChatConvosWidget.tsx
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { listConversations } from '../../../../api/chat/listConversations';
import { formatRelative } from '../../../../lib/utils/formatRelative';

// Replace `any[]` with the actual return type from listConversations.
// Read that file first and import its exported type if one exists.
export function ChatConvosWidget() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    listConversations()
      .then((r: any) => setItems(Array.isArray(r) ? r : r.conversations ?? []))
      .catch(() => setItems([]));
  }, []);
  return (
    <div className="border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Chat conversations</div>
        <Link to="/chat" className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg">
          Open
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-[12px] text-muted">None yet.</div>
      ) : (
        <ul className="text-[12px] space-y-1">
          {items.slice(0, 5).map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span className="truncate">{c.title || c.name || `Conv #${c.id}`}</span>
              <span className="text-muted shrink-0">
                {formatRelative(c.updated_at || c.last_message_at || c.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `CodeConvosWidget`**

```tsx
// frontend/src/features/home/dashboard/widgets/CodeConvosWidget.tsx
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { listCodeConversations } from '../../../../api/code/listCodeConversations';
import { formatRelative } from '../../../../lib/utils/formatRelative';

export function CodeConvosWidget() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    listCodeConversations()
      .then((r: any) => setItems(Array.isArray(r) ? r : r.conversations ?? []))
      .catch(() => setItems([]));
  }, []);
  return (
    <div className="border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Code conversations</div>
        <Link to="/code" className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg">
          Open
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-[12px] text-muted">None yet.</div>
      ) : (
        <ul className="text-[12px] space-y-1">
          {items.slice(0, 5).map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span className="truncate">{c.title || c.name || `Conv #${c.id}`}</span>
              <span className="text-muted shrink-0">
                {formatRelative(c.updated_at || c.last_message_at || c.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `ScrapersWidget`**

```tsx
// frontend/src/features/home/dashboard/widgets/ScrapersWidget.tsx
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { listResearchPlans } from '../../../../api/enrichment/research';
import { formatRelative } from '../../../../lib/utils/formatRelative';

export function ScrapersWidget() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    listResearchPlans()
      .then((r: any) => setItems(Array.isArray(r) ? r : r.plans ?? r.research_plans ?? []))
      .catch(() => setItems([]));
  }, []);
  const counts = items.reduce<Record<string, number>>((acc, p) => {
    const s = p.status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Scrapers / research</div>
        <Link to="/research" className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg">
          Open
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-[12px] text-muted">No plans yet.</div>
      ) : (
        <>
          <div className="text-[12px] text-muted mb-2">
            {Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </div>
          <ul className="text-[12px] space-y-1">
            {items.slice(0, 3).map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className="truncate">{p.topic || p.title || `Plan #${p.id}`}</span>
                <span className="text-muted shrink-0">
                  {formatRelative(p.updated_at || p.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Re-enable the imports in `WidgetRail.tsx`**

Uncomment the three imports and their uses in
`frontend/src/features/home/dashboard/WidgetRail.tsx` (from Task 16).

- [ ] **Step 6: Verify + commit**

```bash
npm -w frontend run build
git add frontend/src/features/home/dashboard/widgets/CodeConvosWidget.tsx \
        frontend/src/features/home/dashboard/widgets/ChatConvosWidget.tsx \
        frontend/src/features/home/dashboard/widgets/ScrapersWidget.tsx \
        frontend/src/features/home/dashboard/WidgetRail.tsx
git commit -m "feat(home): add code/chat/scraper widgets reusing hub endpoints"
```

---

## Task 18: Digest modal + Insight modal

**Files:**
- Create: `frontend/src/features/home/dashboard/modals/ModalShell.tsx`
- Create: `frontend/src/features/home/dashboard/modals/DigestModal.tsx`
- Create: `frontend/src/features/home/dashboard/modals/InsightModal.tsx`

- [ ] **Step 1: `ModalShell`**

```tsx
// frontend/src/features/home/dashboard/modals/ModalShell.tsx
import { useEffect, ReactNode } from 'react';

interface Props { title: string; onClose: () => void; children: ReactNode; }

export function ModalShell({ title, onClose, children }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-8" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-3xl overflow-hidden border border-border bg-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{title}</div>
          <button className="text-[11px] text-muted hover:text-fg" onClick={onClose}>Close</button>
        </div>
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(85vh - 40px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `DigestModal`**

```tsx
// frontend/src/features/home/dashboard/modals/DigestModal.tsx
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getDigest } from '../../../../api/home/digest';
import { postDigestFeedback } from '../../../../api/home/mutations';
import type { DigestMeta } from '../../../../api/home/types';
import { useToast } from '../../../../lib/toast/useToast';
import { ModalShell } from './ModalShell';

interface Props { date?: string; onClose: () => void; }

export function DigestModal({ date, onClose }: Props) {
  const [digest, setDigest] = useState<DigestMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    getDigest({ date }).then((d) => setDigest(d)).finally(() => setLoading(false));
  }, [date]);

  async function sendFeedback(signal: 'up' | 'down') {
    if (!digest) return;
    const res = await postDigestFeedback({ digestId: digest.id, signal });
    if (res.ok) toast.success('Feedback saved');
    else if (res.notConfigured) toast.info('Feedback storage not configured yet');
    else toast.error('Feedback failed');
  }

  return (
    <ModalShell title={digest ? `Digest — ${digest.date}` : 'Digest'} onClose={onClose}>
      {loading && <div className="text-sm text-muted">Loading…</div>}
      {!loading && !digest && (
        <div className="text-sm text-muted">No digest for this date.</div>
      )}
      {digest && (
        <>
          {!digest.markdown_available && (
            <div className="mb-3 border border-yellow-500 bg-yellow-500/10 p-2 text-[12px] text-yellow-400">
              Digest stored but its markdown body is not readable from the API container — kick the worker or open the file manually.
            </div>
          )}
          <div className="flex items-center gap-2 mb-3 text-[12px] text-muted">
            <span>{digest.cluster_count} clusters</span>
            <span>·</span>
            <span>{digest.source_count} sources</span>
            <span className="ml-auto flex gap-1">
              <button className="border border-border px-2 py-0.5 hover:border-fg" onClick={() => sendFeedback('up')}>👍</button>
              <button className="border border-border px-2 py-0.5 hover:border-fg" onClick={() => sendFeedback('down')}>👎</button>
            </span>
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {digest.markdown || '(no body)'}
            </ReactMarkdown>
          </div>
        </>
      )}
    </ModalShell>
  );
}
```

- [ ] **Step 3: `InsightModal`**

```tsx
// frontend/src/features/home/dashboard/modals/InsightModal.tsx
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getInsight } from '../../../../api/home/insights';
import type { Insight } from '../../../../api/home/types';
import { ModalShell } from './ModalShell';
import { formatRelative } from '../../../../lib/utils/formatRelative';

interface Props { id: number; onClose: () => void; }

export function InsightModal({ id, onClose }: Props) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getInsight(id).then(setInsight).finally(() => setLoading(false));
  }, [id]);

  return (
    <ModalShell title={insight?.title || 'Insight'} onClose={onClose}>
      {loading && <div className="text-sm text-muted">Loading…</div>}
      {insight && (
        <>
          <div className="mb-3 text-[12px] text-muted">
            {insight.topic} · {insight.trigger} · {formatRelative(insight.created_at)}
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight.body_markdown}</ReactMarkdown>
          </div>
          {insight.sources.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted mb-1">Sources</div>
              <ul className="text-[12px] space-y-0.5">
                {insight.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-fg">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}
```

- [ ] **Step 4: Verify + commit**

```bash
npm -w frontend run build
git add frontend/src/features/home/dashboard/modals
git commit -m "feat(home): add digest and insight modals"
```

---

## Task 19: Assemble `DashboardTab`

**Files:**
- Modify: `frontend/src/features/home/tabs/DashboardTab.tsx`

- [ ] **Step 1: Replace the stub**

```tsx
// frontend/src/features/home/tabs/DashboardTab.tsx
import { useRef, useState } from 'react';
import type { HomeOverview, HomeHealth, FeedItem } from '../../../api/home/types';
import { GreetingStrip } from '../dashboard/GreetingStrip';
import { Feed } from '../dashboard/Feed';
import { QuestionsPanel } from '../dashboard/QuestionsPanel';
import { HomeChat, type HomeChatHandle } from '../dashboard/HomeChat';
import { SchedulesPanel } from '../dashboard/SchedulesPanel';
import { WidgetRail } from '../dashboard/WidgetRail';
import { DigestModal } from '../dashboard/modals/DigestModal';
import { InsightModal } from '../dashboard/modals/InsightModal';

interface Props {
  overview: HomeOverview | null;
  health: HomeHealth | null;
  refetch: () => void;
}

export function DashboardTab({ overview, health, refetch }: Props) {
  const chatRef = useRef<HomeChatHandle>(null);
  const questionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [digestModal, setDigestModal] = useState<{ date?: string } | null>(null);
  const [insightModal, setInsightModal] = useState<number | null>(null);

  function openFeedItem(item: FeedItem) {
    if (item.kind === 'digest') setDigestModal({ date: item.ref.date as string | undefined });
    else if (item.kind === 'insight') setInsightModal(item.id);
    else if (item.kind === 'question') {
      const el = questionRefs.current.get(item.id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector<HTMLButtonElement>('[data-question-option]')?.focus();
    }
    // 'run' — no-op (snippet already visible in feed)
  }

  const pending = overview?.pending_questions ?? [];
  const schedules = overview?.schedules ?? [];

  return (
    <div className="flex flex-col">
      <GreetingStrip
        health={health}
        onAfterMutate={refetch}
        onChatStream={(jobId) => chatRef.current?.attachStream(jobId)}
      />

      <div className="grid grid-cols-[280px_minmax(0,1fr)_360px] gap-4 p-4">
        <aside className="space-y-2">
          <SchedulesPanel schedules={schedules} />
          <WidgetRail overview={overview} />
        </aside>

        <main className="space-y-4 min-w-0">
          <QuestionsPanel
            questions={pending}
            onRefetch={refetch}
            onChatStream={(jobId) => chatRef.current?.attachStream(jobId)}
            registerScrollTarget={(id, el) => {
              if (el) questionRefs.current.set(id, el);
              else questionRefs.current.delete(id);
            }}
          />
          <Feed onOpen={openFeedItem} />
        </main>

        <aside className="h-[calc(100vh-200px)] min-h-[500px]">
          <HomeChat ref={chatRef} />
        </aside>
      </div>

      {digestModal && (
        <DigestModal date={digestModal.date} onClose={() => setDigestModal(null)} />
      )}
      {insightModal != null && (
        <InsightModal id={insightModal} onClose={() => setInsightModal(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify + manual UI check**

```bash
npm -w frontend run build
npm -w frontend run dev
```

Manually:
- `/home` renders dashboard with the 3-column layout.
- Greeting strip shows today's date + time-since.
- Schedules/Widgets in the left rail.
- Questions + Feed in the centre.
- Chat on the right.
- Empty states appear when there's no data.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/home/tabs/DashboardTab.tsx
git commit -m "feat(home): assemble dashboard layout"
```

---

## Task 20: Stats tab — Today + Overview sections

**Files:**
- Create: `frontend/src/features/home/stats/TodaySection.tsx`
- Create: `frontend/src/features/home/stats/OverviewSection.tsx`
- Modify: `frontend/src/features/home/tabs/StatsTab.tsx`

- [ ] **Step 1: `TodaySection`**

```tsx
// frontend/src/features/home/stats/TodaySection.tsx
import { useEffect, useState } from 'react';
import { getHomeOverview } from '../../../api/home/overview';
import { listHomeFeed } from '../../../api/home/feed';
import { listInsights } from '../../../api/home/insights';
import type { HomeOverview, FeedItem } from '../../../api/home/types';

function isToday(iso: string, now = new Date()) {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function TodaySection() {
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [insightsToday, setInsightsToday] = useState(0);

  useEffect(() => {
    Promise.all([getHomeOverview(), listHomeFeed({ limit: 100 }), listInsights({ limit: 50 })])
      .then(([ov, fd, ins]) => {
        setOverview(ov);
        setFeed(fd.items);
        setInsightsToday(ins.insights.filter((i) => isToday(i.created_at)).length);
      })
      .catch(() => {});
  }, []);

  const feedToday = feed.filter((f) => isToday(f.created_at));
  const byKind = feedToday.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="border-b border-border p-6">
      <h2 className="font-display text-lg tracking-tightest mb-3">Today</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
        <Metric label="Digest clusters" value={overview?.digest?.cluster_count ?? '—'} />
        <Metric label="Digest sources" value={overview?.digest?.source_count ?? '—'} />
        <Metric label="Insights today" value={insightsToday} />
        <Metric label="Pending questions" value={overview?.pending_questions.length ?? 0} />
        <Metric label="Feed items today" value={feedToday.length} />
        <Metric label="…digests" value={byKind.digest ?? 0} />
        <Metric label="…runs" value={byKind.run ?? 0} />
        <Metric label="…questions" value={byKind.question ?? 0} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="font-display text-xl tracking-tightest mt-1">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: `OverviewSection`**

This is the old hub `HomeTab` renamed to `HomeTabLegacy` in Task 9. Wrap
it as the Overview section. The legacy component renders its own
everything — here we just re-export it with a section header.

```tsx
// frontend/src/features/home/stats/OverviewSection.tsx
import { HomeTab as OverviewLegacy } from '../legacy/HomeTabLegacy';

export function OverviewSection() {
  return (
    <section className="border-b border-border p-6">
      <h2 className="font-display text-lg tracking-tightest mb-3">Overview</h2>
      <OverviewLegacy />
    </section>
  );
}
```

If `HomeTabLegacy.tsx`'s export name is still `HomeTab` (it should be after
the rename of the file only), this import works. If Task 9 also renamed
the export symbol, adjust to match.

- [ ] **Step 3: Modify `StatsTab` to prepend sections**

Open `frontend/src/features/home/tabs/StatsTab.tsx`. Its existing export
likely returns a single component. Wrap it:

```tsx
// at the top of StatsTab.tsx (keep all existing imports)
import { TodaySection } from '../stats/TodaySection';
import { OverviewSection } from '../stats/OverviewSection';
```

Wrap the existing returned JSX so the component returns:

```tsx
return (
  <div>
    <TodaySection />
    <OverviewSection />
    {/* existing StatsTab content kept verbatim here */}
  </div>
);
```

If the existing `StatsTab` returned a fragment or a div already, splice
the two sections in as the first children.

- [ ] **Step 4: Verify + commit**

```bash
npm -w frontend run build
npm -w frontend run dev
# Click the Stats tab; confirm Today + Overview sections appear above the existing stats content.
git add frontend/src/features/home/stats frontend/src/features/home/tabs/StatsTab.tsx
git commit -m "feat(home): add Today and Overview sections to Stats tab"
```

---

## Task 21: Keyboard shortcuts

**Files:**
- Create: `frontend/src/features/home/hooks/useKeyboardShortcuts.ts`
- Modify: `frontend/src/features/home/tabs/DashboardTab.tsx`

- [ ] **Step 1: Hook**

```ts
// frontend/src/features/home/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

interface Handlers {
  onSlash?: () => void; // focus chat
  onB?: () => void;      // briefing
  onD?: () => void;      // digest run
}

export function useKeyboardShortcuts(h: Handlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inEditable =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (inEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/' && h.onSlash) { e.preventDefault(); h.onSlash(); }
      else if (e.key.toLowerCase() === 'b' && h.onB) { e.preventDefault(); h.onB(); }
      else if (e.key.toLowerCase() === 'd' && h.onD) { e.preventDefault(); h.onD(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [h.onSlash, h.onB, h.onD]);
}
```

- [ ] **Step 2: Wire into `DashboardTab`**

Add at the top of the component body (after the existing `useRef`s):

```tsx
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

// inside DashboardTab(), after refs:
useKeyboardShortcuts({
  onSlash: () => chatRef.current?.focusInput(),
  onB: () => document.querySelector<HTMLButtonElement>('[data-shortcut="brief"]')?.click(),
  onD: () => document.querySelector<HTMLButtonElement>('[data-shortcut="digest"]')?.click(),
});
```

- [ ] **Step 3: Verify + commit**

```bash
npm -w frontend run build
npm -w frontend run dev
# Manually: press `/` → chat input focuses; `b` → briefing toast; `d` → digest toast.
git add frontend/src/features/home/hooks/useKeyboardShortcuts.ts frontend/src/features/home/tabs/DashboardTab.tsx
git commit -m "feat(home): add keyboard shortcuts for chat/brief/digest"
```

---

## Task 22: Final end-to-end verification

No new files. This task exists so the implementer signs off on the full
spec checklist before considering the plan complete.

- [ ] **Step 1: Build**

```bash
npm -w frontend run build
```

Expected: no TS errors.

- [ ] **Step 2: Run dev server and go through the spec verification list**

```bash
npm -w frontend run dev
```

Work through each item from `docs/superpowers/specs/2026-04-22-home-dashboard-design.md` section 12:

- [ ] 1. `/home/overview` paints when tables are missing.
- [ ] 2. Run digest → toast → digest appears in feed within 2 min.
- [ ] 3. Produce insight → toast → insight appears within ~60s.
- [ ] 4. Answer a pending question → SSE ack appears in chat → question clears from pending list.
- [ ] 5. Dismiss → question disappears immediately.
- [ ] 6. Retract an answered question (via `/chat` or manual API call) → reappears as pending.
- [ ] 7. Chat message → SSE streams chunks → final assistant message visible in `GET /home/conversation/export`.
- [ ] 8. "Brief me" → SSE streams into chat.
- [ ] 9. Health banner disappears once all tables are provisioned.
- [ ] 10. `/` lands on `/home`; `/hub` redirects to `/home`; no file in `src/features/` is named `hub`.

- [ ] **Step 3: Commit any polish from verification**

If verification turned up bugs, fix them in-place with small commits
scoped to the symptom (no large refactors).

- [ ] **Step 4: Final commit / branch summary**

```bash
git log --oneline main..HEAD
```

Review the series; squash only trivially messy commits. Do not force-push
to main.

---

## Self-review notes

- **Spec coverage:** every section of the design doc maps to a task:
  routing (T8), shell + tabs + banner (T10), greeting/quick-actions (T11),
  feed (T12), questions (T13), chat + SSE (T14), schedules (T15),
  widgets (T16, T17), modals (T18), dashboard assembly (T19), stats
  sections (T20), shortcuts (T21). Toasts (T5), relative-time util (T7),
  SSE subscriber (T4), types/clients (T1–T3) underpin the rest.
- **Placeholders:** every code block is complete. Task 17 explicitly notes
  that the hub widgets' return shapes must be confirmed from source before
  coding — that inspection is the first step of the task, not a TODO.
- **Type consistency:** `HomeOverview`, `HomeHealth`, `FeedItem`,
  `Question`, `Insight`, `Schedule`, `WidgetEnvelope`, `SubscribeJobHandle`,
  `SseEvent`, `ChatMessage`, `HomeChatHandle` are defined once and
  imported consistently downstream.
- **Ordering:** the plan is build-green at every commit except Task 16,
  which intentionally notes the three hub widgets to be commented out
  until Task 17 re-enables them.
