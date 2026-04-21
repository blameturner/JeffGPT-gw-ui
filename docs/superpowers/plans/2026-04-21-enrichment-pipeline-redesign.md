# Enrichment Pipeline Redesign — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Hub frontend to match the new four-job enrichment pipeline: replace the legacy discovery UI with a Suggestions Review Queue, refit the OpsTab ribbon and panels to the new data shapes, simplify the backoff display to a single idle-gate traffic light, update tool-queue task-type labels, and delete the legacy discovery/scraper/scrape-targets Hub tabs.

**Architecture:** The Hub → Queue Center tab already renders `OpsTab` with a ribbon+sub-tab+side-panel layout. This plan upgrades that layout in place: swap the `discovery` sub-tab for a new `suggestions` sub-tab (Review Queue) backed by `suggested_scrape_targets`; extend the ribbon to four pipeline tiles (Discover → Suggestions → Pathfinder → Scraper); replace the runtime/backoff tile with a dedicated BackoffLight component reading the new single-gate shape; refine `ScrapeTargetsPanel` per-brief (sort, filter chips, drawer summary); update the tool-queue panel to show friendly task-type labels and flag legacy types. Endpoints gain `api/enrichment/discovery/suggestions*` for list/approve/reject; `ScrapeTargetRow` gains `summary` + `suggested_id`; `QueueStatus.backoff` moves to `{state: 'clear'|'waiting_for_idle', idle_seconds, threshold}`. Legacy Hub tabs (`DiscoveryTab`, `ScrapeTargetsTab`, `ScraperTab`) and their unused API helpers (`runScraper`, `scrapeNext`, `markUrlProcessed`, legacy `listDiscovery`) are deleted in a final pass.

**Tech Stack:** TypeScript 5.7, React 18.3, Vite 5.4, Tailwind 3.4, TanStack Router 1.87, `ky` HTTP client. No test framework is configured — verification below uses `npx tsc --noEmit` and `pnpm build`, plus manual browser checks with `pnpm dev`.

---

## Plan-Wide Conventions

- **Endpoint prefix:** The frontend calls backend routes under `api/enrichment/...` and `api/tool-queue/...` (gateway rewrites). When the brief says `GET /discovery/suggestions`, call `api/enrichment/discovery/suggestions`.
- **Verification instead of TDD:** Each task ends with:
  1. `npx tsc --noEmit -p frontend/tsconfig.json` — must succeed with no errors.
  2. `pnpm --filter frontend build` (or `cd frontend && pnpm build`) — must succeed.
  3. For UI tasks, `cd frontend && pnpm dev` and verify in a browser at `http://localhost:5173/hub`, switching to Queue Center, with an `org_id` that has seed data.
- **Commit granularity:** One commit per task. Use Conventional Commits with the `feat(ops):` or `refactor(ops):` prefix matching recent history.
- **Do NOT introduce backwards-compat shims** for the shape changes unless explicitly listed. Delete the old shape.

---

## File Structure (Decomposition)

| Path | Responsibility | Status |
|---|---|---|
| `frontend/src/api/types/Suggestion.ts` | `Suggestion` row + list/approve/reject/manual-discover response shapes. | **Create** |
| `frontend/src/api/types/Enrichment.ts` | Extend `ScrapeTargetRow` with `summary?: string \| null` and `suggested_id?: number \| null`. Delete `DiscoveryRow`, `DiscoveryListResponse`, `ScraperNextResponse`. | Modify |
| `frontend/src/api/types/QueueStatus.ts` | Replace `backoff` with `{state: 'clear'\|'waiting_for_idle', idle_seconds, threshold}`. | Modify |
| `frontend/src/api/types/OpsDashboard.ts` | Add `suggestions?: { count?: number; rows?: Suggestion[] }`; delete legacy `discovery?:` key. | Modify |
| `frontend/src/api/enrichment/suggestions.ts` | `listSuggestions`, `approveSuggestion`, `rejectSuggestion`. | **Create** |
| `frontend/src/api/enrichment/pathfinder.ts` | `discover()` body is `{seed_url, org_id}`; new response shape `{status, suggested_id, job_id, url} \| {status:'failed', error}`. Delete `fetchNextUrl`, `markUrlProcessed`, `listDiscovery`, `ListDiscoveryParams`. Keep `startPathfinder`. | Modify |
| `frontend/src/api/enrichment/scraper.ts` | Delete `runScraper`, `scrapeNext`, `ScraperRunRequest`. Keep `startScraper`. | Modify |
| `frontend/src/api/enrichment/getDiscoveryRow.ts` | Delete file — legacy discovery detail endpoint gone. | Delete |
| `frontend/src/features/hub/tabs/ops/lib/taskTypeLabels.ts` | Friendly label map + legacy detector for ToolJob `type` strings. | **Create** |
| `frontend/src/features/hub/tabs/ops/components/SuggestionsPanel.tsx` | The Review Queue — status filter chips, rows with relevance/score/reason, approve/reject actions, bulk select, manual-seed form. | **Create** |
| `frontend/src/features/hub/tabs/ops/components/BackoffLight.tsx` | Traffic-light for `clear` / `waiting_for_idle` with idle_seconds vs threshold. | **Create** |
| `frontend/src/features/hub/tabs/ops/components/PipelineRibbon.tsx` | Four pipeline tiles (Discover → Suggestions → Pathfinder → Scraper). Tile click triggers `onFocusStage(stage)`. Backoff/runtime tile removed. | Modify |
| `frontend/src/features/hub/tabs/ops/components/PipelineCard.tsx` | Accept optional `onClick`, optional `stageBadge` (count). | Modify |
| `frontend/src/features/hub/tabs/ops/components/QueueJobsPanel.tsx` | Use `taskTypeLabels` helper; legacy badge when type matches a deprecated name. | Modify |
| `frontend/src/features/hub/tabs/ops/components/ScrapeTargetsPanel.tsx` | Default sort `next_crawl_at ASC nulls-first`; status filter chips (`ok/error/scraping/rejected/all`); fails red when ≥3; row click → drawer with summary + recent tool_jobs. | Modify |
| `frontend/src/features/hub/tabs/ops/components/RowDrawer.tsx` | Unchanged, used with a new `extra` prop by ScrapeTargetsPanel. | Unchanged |
| `frontend/src/features/hub/tabs/ops/components/DiscoveryPanel.tsx` | Delete file. | Delete |
| `frontend/src/features/hub/tabs/ops/OpsTab.tsx` | Sub-tabs become `suggestions \| scrape-targets \| queue`; old runtime/backoff triptych replaced by `BackoffLight`; ribbon `onFocusStage` routes to sub-tab. | Modify |
| `frontend/src/features/hub/HubPage.tsx` | Remove `discovery` and `scrape-targets` top-level tabs; keep Queue Center only. | Modify |
| `frontend/src/features/hub/types/HubTab.ts` | Drop `'discovery'`, `'scrape-targets'` literals. | Modify |
| `frontend/src/features/hub/tabs/DiscoveryTab.tsx` | Delete file. | Delete |
| `frontend/src/features/hub/tabs/ScrapeTargetsTab.tsx` | Delete file. | Delete |
| `frontend/src/features/hub/tabs/ScraperTab.tsx` | Delete file. | Delete |

---

## Task 1: Add `Suggestion` type

**Files:**
- Create: `frontend/src/api/types/Suggestion.ts`

- [ ] **Step 1: Create the type file**

Write `frontend/src/api/types/Suggestion.ts`:

```typescript
export type SuggestionRelevance = 'high' | 'medium' | 'low' | 'rejected';

export type SuggestionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'extracted'
  | 'failed';

export interface Suggestion {
  Id: number;
  org_id: number;
  url: string;
  title: string | null;
  /** The LLM-generated search query that surfaced this URL. */
  query: string | null;
  relevance: SuggestionRelevance;
  /** 0-100 LLM-assigned. */
  score: number;
  /** One-sentence classifier justification. */
  reason: string | null;
  status: SuggestionStatus;
  error_message: string | null;
  /** ISO-8601, null until reviewed. */
  reviewed_at: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ListSuggestionsResponse {
  status: 'ok' | 'failed';
  rows: Suggestion[];
  error?: string;
}

export interface ApproveSuggestionResponse {
  status: 'queued' | 'not_found' | 'failed';
  suggested_id?: number;
  job_id?: string;
  org_id?: number;
  error?: string;
}

export interface RejectSuggestionResponse {
  status: 'ok' | 'not_found' | 'failed';
  error?: string;
}

export interface PathfinderDiscoverResponse {
  status: 'queued' | 'failed';
  suggested_id?: number;
  job_id?: string;
  url?: string;
  error?: 'invalid_url' | 'invalid_org_id' | 'insert_failed' | string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/types/Suggestion.ts
git commit -m "feat(ops): add Suggestion type + response shapes for review queue"
```

---

## Task 2: Add `suggestions.ts` API module

**Files:**
- Create: `frontend/src/api/enrichment/suggestions.ts`

- [ ] **Step 1: Create the module**

Write `frontend/src/api/enrichment/suggestions.ts`:

```typescript
import { http } from '../../lib/http';
import type {
  ApproveSuggestionResponse,
  ListSuggestionsResponse,
  PathfinderDiscoverResponse,
  RejectSuggestionResponse,
  Suggestion,
  SuggestionStatus,
} from '../types/Suggestion';
import { normalizeList } from './_normalizeList';

export interface ListSuggestionsParams {
  org_id: number;
  /** Empty string requests all statuses. Default server-side: pending. */
  status?: SuggestionStatus | '';
  limit?: number;
}

export async function listSuggestions(
  params: ListSuggestionsParams,
): Promise<ListSuggestionsResponse> {
  const qs = new URLSearchParams();
  qs.set('org_id', String(params.org_id));
  if (params.status !== undefined) qs.set('status', params.status);
  if (params.limit != null) qs.set('limit', String(params.limit));
  const raw = await http.get(`api/enrichment/discovery/suggestions?${qs}`).json<unknown>();
  const normalized = normalizeList<Suggestion>(raw, 'discovery/suggestions');
  const status =
    raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).status === 'string'
      ? ((raw as Record<string, unknown>).status as ListSuggestionsResponse['status'])
      : 'ok';
  return { status, rows: normalized.items };
}

export function approveSuggestion(id: number): Promise<ApproveSuggestionResponse> {
  return http
    .post(`api/enrichment/discovery/suggestions/${encodeURIComponent(String(id))}/approve`)
    .json<ApproveSuggestionResponse>();
}

export function rejectSuggestion(
  id: number,
  reason?: string,
): Promise<RejectSuggestionResponse> {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  return http
    .post(`api/enrichment/discovery/suggestions/${encodeURIComponent(String(id))}/reject${qs}`)
    .json<RejectSuggestionResponse>();
}

export function pathfinderDiscover(
  seed_url: string,
  org_id: number,
): Promise<PathfinderDiscoverResponse> {
  return http
    .post('api/enrichment/pathfinder/discover', { json: { seed_url, org_id } })
    .json<PathfinderDiscoverResponse>();
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/enrichment/suggestions.ts
git commit -m "feat(ops): add suggestions API module (list/approve/reject + manual discover)"
```

---

## Task 3: Update `QueueStatus.backoff` to single-gate shape

**Files:**
- Modify: `frontend/src/api/types/QueueStatus.ts`

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `frontend/src/api/types/QueueStatus.ts` with:

```typescript
export type BackoffState = 'clear' | 'waiting_for_idle';

export interface QueueStatus {
  counts: Record<string, { queued: number; running: number; completed: number }>;
  workers: Record<string, number>;
  backoff: {
    state: BackoffState;
    /** -1 if no chat activity has been recorded yet. */
    idle_seconds: number;
    /** Single BACKGROUND_CHAT_IDLE_S gate. Default 30. */
    threshold: number;
  };
  huey?: {
    enabled?: boolean;
    consumer_running?: boolean;
    workers?: number;
    sqlite_path?: string;
    queue_ready?: boolean;
  };
}
```

- [ ] **Step 2: Typecheck — expect failures in call sites**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: errors at these lines — they will be fixed in Task 10 (BackoffLight) and in OpsTab cleanup:
- `frontend/src/features/hub/tabs/ops/OpsTab.tsx:153-154` (reads `state`, `idle_seconds` — names unchanged, ok)
- `frontend/src/features/hub/tabs/ops/components/PipelineRibbon.tsx:60-61` (reads `state`, `idle_seconds` — names unchanged, ok)

If only those two files still compile (because the field names `state` and `idle_seconds` still exist), typecheck will pass. If there are other references (e.g. `thresholds.priority_1`), note them. Proceed if no errors; otherwise defer commit to after Task 10.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/types/QueueStatus.ts
git commit -m "refactor(ops): collapse QueueStatus.backoff to single idle-gate shape"
```

---

## Task 4: Extend `ScrapeTargetRow`, drop `DiscoveryRow`, add `suggestions` to dashboard

**Files:**
- Modify: `frontend/src/api/types/Enrichment.ts`
- Modify: `frontend/src/api/types/OpsDashboard.ts`

- [ ] **Step 1: Edit Enrichment.ts — delete legacy types, add fields**

In `frontend/src/api/types/Enrichment.ts`, delete the `DiscoveryRow`, `DiscoveryListResponse`, `ScraperRunRequest`, and `ScraperNextResponse` interfaces (lines 1–26). Replace with nothing — the rest of the file stays.

Then, inside the `ScrapeTargetRow` interface, add these two fields near the end, just before `CreatedAt`:

```typescript
  /** Populated by the summarise_page job. */
  summary?: string | null;
  /** FK back to suggested_scrape_targets if discovered via pathfinder. */
  suggested_id?: number | null;
```

The file should now start with `export type ScrapeTargetStatus = ...` and no longer reference discovery.

- [ ] **Step 2: Edit OpsDashboard.ts — suggestions key**

In `frontend/src/api/types/OpsDashboard.ts`, delete the `discovery?: {...}` block (lines 35-38) and replace with:

```typescript
  suggestions?: {
    count?: number;
    rows?: import('./Suggestion').Suggestion[];
  };
```

(Keep `scrape_targets`, `queue_jobs`, `active_summary`, `queue_center`, `pipeline` as-is.)

- [ ] **Step 3: Typecheck — expect failures in legacy callers**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: errors in:
- `frontend/src/api/enrichment/pathfinder.ts` (imports `DiscoveryListResponse`, `DiscoveryRow`)
- `frontend/src/api/enrichment/getDiscoveryRow.ts` (may reference discovery)
- `frontend/src/features/hub/tabs/ops/components/DiscoveryPanel.tsx` (reads `discovery` from dashboard)
- `frontend/src/features/hub/tabs/DiscoveryTab.tsx`, `ScraperTab.tsx`, `ScrapeTargetsTab.tsx` (import legacy types)

These callers are all scheduled for deletion/rewrite in later tasks. Do NOT fix them here. Note the file list in your head and proceed — the ensuing tasks fix them in order.

- [ ] **Step 4: Do NOT commit yet**

Holding the commit — the codebase is currently not typechecking. Next tasks will restore type cleanliness before any commit. Skip ahead.

---

## Task 5: Rewrite `pathfinder.ts` and `scraper.ts` to remove dead API

**Files:**
- Modify: `frontend/src/api/enrichment/pathfinder.ts`
- Modify: `frontend/src/api/enrichment/scraper.ts`
- Delete: `frontend/src/api/enrichment/getDiscoveryRow.ts`

- [ ] **Step 1: Rewrite `pathfinder.ts`**

Replace `frontend/src/api/enrichment/pathfinder.ts` entirely with:

```typescript
import { http } from '../../lib/http';
import type { ChainKickResponse } from './chainKick';

/** Alias of the shared chain-kick response used by pathfinder start. */
export type PathfinderStartResponse = ChainKickResponse;

export function startPathfinder(orgId?: number) {
  const qs = orgId != null ? `?org_id=${encodeURIComponent(String(orgId))}` : '';
  return http
    .post(`api/enrichment/pathfinder/start${qs}`)
    .json<PathfinderStartResponse>();
}
```

Notes:
- `pathfinderDiscover` (manual seed for the Suggestions UI) lives in `suggestions.ts` — do not re-export it here.
- `fetchNextPathfinderSeed` already lives in its own file at `frontend/src/api/enrichment/fetchNextPathfinderSeed.ts` and is consumed by `useNextCandidatePreview`. Leave that file and its caller untouched.
- `fetchNextUrl`, `markUrlProcessed`, `listDiscovery`, `discover`, `ListDiscoveryParams`, `DiscoverRequest`, `PathfinderDiscoverResponse` are all removed.

- [ ] **Step 2: Rewrite `scraper.ts`**

Replace `frontend/src/api/enrichment/scraper.ts` entirely with:

```typescript
import { http } from '../../lib/http';
import type { ChainKickResponse } from './chainKick';

/** Alias of the shared chain-kick response used by scraper start. */
export type ScraperStartResponse = ChainKickResponse;

export function startScraper(orgId?: number) {
  const qs = orgId != null ? `?org_id=${encodeURIComponent(String(orgId))}` : '';
  return http
    .post(`api/enrichment/scraper/start${qs}`)
    .json<ScraperStartResponse>();
}
```

- [ ] **Step 3: Delete `getDiscoveryRow.ts`**

```bash
git rm frontend/src/api/enrichment/getDiscoveryRow.ts
```

- [ ] **Step 4: Typecheck — expect failures only in UI files scheduled for deletion**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected remaining failures:
- `frontend/src/features/hub/tabs/ops/components/DiscoveryPanel.tsx` (imports `getDiscoveryRow`, uses `discovery` dashboard key)
- `frontend/src/features/hub/tabs/DiscoveryTab.tsx` (imports `discover`, `listDiscovery`, `fetchNextUrl`)
- `frontend/src/features/hub/tabs/ScraperTab.tsx` (imports `runScraper`, `scrapeNext`, `listDiscovery`, `DiscoveryRow`)
- `frontend/src/features/hub/tabs/ScrapeTargetsTab.tsx` (may be fine; uses only `listScrapeTargets` + `startScraper`)
- `frontend/src/api/enrichment/fetchNextPathfinderSeed.ts` and `fetchNextScraperTarget.ts` — check both; if they reference removed types, fix them (likely unaffected since they use `PipelineSummary` types).

All of these are deleted/rewritten in Tasks 8, 15, 16. No commit yet.

- [ ] **Step 5: Do NOT commit yet**

Hold until Task 8 lands the Suggestions UI and the DiscoveryPanel import is removed.

---

## Task 6: Add `taskTypeLabels.ts` helper

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/lib/taskTypeLabels.ts`

- [ ] **Step 1: Create the helper**

Write `frontend/src/features/hub/tabs/ops/lib/taskTypeLabels.ts`:

```typescript
/** Current (post-redesign) task types emitted by new jobs. */
export const CURRENT_TASK_TYPES = [
  'planned_search_execute',
  'planned_search_scrape',
  'research_planner',
  'research_agent',
  'summarise_page',
  'graph_extract',
  'scrape_page',
  'pathfinder_extract',
  'extract_relationships',
  'discover_agent_run',
] as const;

/** Deprecated task types that may still appear on pre-redesign rows. */
export const LEGACY_TASK_TYPES = new Set<string>([
  'scrape_target',       // → scrape_page
  'pathfinder_crawl',    // → pathfinder_extract
  'classify_relevance',  // removed (inline in discover_agent_run)
]);

const LABELS: Record<string, string> = {
  scrape_page: 'Scrape page',
  pathfinder_extract: 'Pathfinder extract',
  extract_relationships: 'Extract relationships',
  discover_agent_run: 'Discover agent',
  summarise_page: 'Summarise page',
  graph_extract: 'Graph extract',
  planned_search_execute: 'Planned search (execute)',
  planned_search_scrape: 'Planned search (scrape)',
  research_planner: 'Research planner',
  research_agent: 'Research agent',
};

export function taskTypeLabel(type: string | null | undefined): string {
  if (!type) return '-';
  return LABELS[type] ?? type;
}

export function isLegacyTaskType(type: string | null | undefined): boolean {
  return !!type && LEGACY_TASK_TYPES.has(type);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: same set of failures as Task 5 (no new errors introduced).

- [ ] **Step 3: Commit — combine Tasks 1-6 into one foundation commit**

This is the first safe commit point since Task 3. It rolls up types, API modules, and the label helper.

```bash
git add frontend/src/api/types/Suggestion.ts \
        frontend/src/api/types/QueueStatus.ts \
        frontend/src/api/types/Enrichment.ts \
        frontend/src/api/types/OpsDashboard.ts \
        frontend/src/api/enrichment/suggestions.ts \
        frontend/src/api/enrichment/pathfinder.ts \
        frontend/src/api/enrichment/scraper.ts \
        frontend/src/features/hub/tabs/ops/lib/taskTypeLabels.ts
git rm --cached frontend/src/api/enrichment/getDiscoveryRow.ts 2>/dev/null || true
git add -A frontend/src/api/enrichment/getDiscoveryRow.ts
git commit -m "feat(ops): add suggestion types, API module, task-type labels; collapse backoff shape"
```

Note: the repo will not fully typecheck yet. Consumer code (DiscoveryPanel, HubPage, legacy tabs) is fixed in the next tasks. This mid-state is acceptable because the next commit (Task 8) restores typecheck green. If you want a green-only commit history, squash this with Task 8 when finishing. Prefer separate commits for reviewability.

---

## Task 7: Build `SuggestionsPanel` component

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/components/SuggestionsPanel.tsx`

- [ ] **Step 1: Create the component**

Write `frontend/src/features/hub/tabs/ops/components/SuggestionsPanel.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react';
import {
  approveSuggestion,
  listSuggestions,
  pathfinderDiscover,
  rejectSuggestion,
} from '../../../../../api/enrichment/suggestions';
import type {
  Suggestion,
  SuggestionRelevance,
  SuggestionStatus,
} from '../../../../../api/types/Suggestion';
import { extractApiFailure } from '../lib/formatters';
import { RelativeTime } from './RelativeTime';

type StatusTab = SuggestionStatus | 'all';

const STATUS_TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'extracted', label: 'Extracted' },
  { id: 'failed', label: 'Failed' },
  { id: 'all', label: 'All' },
];

const RELEVANCE_STYLE: Record<SuggestionRelevance, string> = {
  high: 'bg-emerald-500/20 text-emerald-300',
  medium: 'bg-blue-500/20 text-blue-300',
  low: 'bg-panel text-muted',
  rejected: 'bg-red-500/20 text-red-400',
};

export interface SuggestionsPanelProps {
  orgId: number | null;
  onActionComplete: () => void;
  loading?: boolean;
}

export function SuggestionsPanel({ orgId, onActionComplete, loading }: SuggestionsPanelProps) {
  const [tab, setTab] = useState<StatusTab>('pending');
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState<{ done: number; total: number } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [seedUrl, setSeedUrl] = useState('');
  const [seedBusy, setSeedBusy] = useState(false);

  const counts = useMemo(() => countByStatus(rows), [rows]);

  // Load on tab/org change.
  useEffect(() => {
    if (orgId == null) return;
    let cancelled = false;
    setListing(true);
    setListError(null);
    const status = tab === 'all' ? '' : tab;
    listSuggestions({ org_id: orgId, status, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'ok') {
          setRows(res.rows);
        } else {
          setListError(res.error ?? 'failed to load suggestions');
          setRows([]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(extractApiFailure(err).message);
      })
      .finally(() => {
        if (!cancelled) setListing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, tab]);

  function flashMessage(msg: string) {
    setActionMessage(msg);
    window.setTimeout(() => setActionMessage(null), 6000);
  }

  function removeLocally(id: number) {
    setRows((prev) => prev.filter((r) => r.Id !== id));
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleApprove(id: number) {
    setBusyId(id);
    try {
      const res = await approveSuggestion(id);
      if (res.status === 'queued') {
        removeLocally(id);
        flashMessage(`approved & queued job ${res.job_id ?? '?'}`);
        onActionComplete();
      } else {
        flashMessage(`approve ${res.status}: ${res.error ?? ''}`);
      }
    } catch (err) {
      flashMessage(`approve error: ${extractApiFailure(err).message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: number) {
    setBusyId(id);
    try {
      const reason = rejectReason[id]?.trim() || undefined;
      const res = await rejectSuggestion(id, reason);
      if (res.status === 'ok') {
        removeLocally(id);
        flashMessage(`rejected ${id}`);
        onActionComplete();
      } else {
        flashMessage(`reject ${res.status}: ${res.error ?? ''}`);
      }
    } catch (err) {
      flashMessage(`reject error: ${extractApiFailure(err).message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulk(action: 'approve' | 'reject') {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy({ done: 0, total: ids.length });
    let done = 0;
    for (const id of ids) {
      try {
        if (action === 'approve') {
          const res = await approveSuggestion(id);
          if (res.status === 'queued') removeLocally(id);
        } else {
          const res = await rejectSuggestion(id);
          if (res.status === 'ok') removeLocally(id);
        }
      } catch {
        // Continue on error; per-row errors surface via flashMessage only for single actions.
      }
      done += 1;
      setBulkBusy({ done, total: ids.length });
    }
    setBulkBusy(null);
    flashMessage(`${action}d ${done}/${ids.length}`);
    onActionComplete();
  }

  async function handleManualSeed(e: React.FormEvent) {
    e.preventDefault();
    const url = seedUrl.trim();
    if (!url || orgId == null) return;
    setSeedBusy(true);
    try {
      const res = await pathfinderDiscover(url, orgId);
      if (res.status === 'queued') {
        flashMessage(`seed queued — extracting links in background, refresh in a minute`);
        setSeedUrl('');
        onActionComplete();
      } else {
        flashMessage(`seed failed: ${res.error ?? 'unknown'}`);
      }
    } catch (err) {
      flashMessage(`seed error: ${extractApiFailure(err).message}`);
    } finally {
      setSeedBusy(false);
    }
  }

  const visibleRows = rows;
  const isLoading = loading || listing;
  const allSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.Id));

  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set(visibleRows.map((r) => r.Id));
    });
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={handleManualSeed}
        className="flex items-end gap-2 border border-border rounded p-3"
      >
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">
            Add seed URL
          </label>
          <input
            type="url"
            required
            value={seedUrl}
            onChange={(e) => setSeedUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          />
        </div>
        <button
          type="submit"
          disabled={!seedUrl.trim() || orgId == null || seedBusy}
          className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
        >
          {seedBusy ? 'Queueing…' : 'Seed pathfinder'}
        </button>
      </form>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <nav className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'px-2.5 py-1 rounded border text-[10px] uppercase tracking-[0.14em]',
                tab === t.id ? 'border-fg text-fg' : 'border-border text-muted hover:text-fg',
              ].join(' ')}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums text-muted">
                {t.id === 'all' ? rows.length : counts[t.id] ?? 0}
              </span>
            </button>
          ))}
        </nav>
        {actionMessage && (
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {actionMessage}
          </span>
        )}
      </div>

      {tab === 'pending' && visibleRows.length > 0 && (
        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={toggleAll}
            className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
          >
            {allSelected ? 'Clear selection' : 'Select all'}
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || bulkBusy != null}
            onClick={() => void handleBulk('approve')}
            className="px-2 py-1 rounded border border-emerald-500/40 text-emerald-400 text-[10px] uppercase tracking-[0.12em] hover:bg-emerald-500/10 disabled:opacity-50"
          >
            Approve selected ({selected.size})
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || bulkBusy != null}
            onClick={() => void handleBulk('reject')}
            className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel disabled:opacity-50"
          >
            Reject selected ({selected.size})
          </button>
          {bulkBusy && (
            <span className="text-muted text-[11px]">
              {bulkBusy.done}/{bulkBusy.total}
            </span>
          )}
        </div>
      )}

      {listError && <p className="text-xs text-red-400">{listError}</p>}

      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm font-sans">
          <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-2 py-2 w-8">
                {tab === 'pending' && visibleRows.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                )}
              </th>
              <th className="px-3 py-2 text-left">Title / URL</th>
              <th className="px-3 py-2 text-left">Query</th>
              <th className="px-3 py-2 text-left">Relevance</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Reason</th>
              <th className="px-3 py-2 text-left">Age</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map((s) => (
              <tr key={s.Id} className="hover:bg-panel/30 align-top">
                <td className="px-2 py-2">
                  {tab === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selected.has(s.Id)}
                      onChange={() => toggleOne(s.Id)}
                      aria-label={`Select ${s.Id}`}
                    />
                  )}
                </td>
                <td className="px-3 py-2 max-w-[22rem]">
                  <div className="truncate font-medium">{s.title ?? '(untitled)'}</div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block text-[11px] text-muted hover:underline truncate"
                    title={s.url}
                  >
                    {s.url}
                  </a>
                </td>
                <td className="px-3 py-2 text-muted max-w-[14rem] truncate" title={s.query ?? ''}>
                  {s.query ?? '-'}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={[
                      'inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em]',
                      RELEVANCE_STYLE[s.relevance],
                    ].join(' ')}
                  >
                    {s.relevance}
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums">{s.score}</td>
                <td className="px-3 py-2 text-muted max-w-[18rem]" title={s.reason ?? ''}>
                  <span className="line-clamp-2">{s.reason ?? '-'}</span>
                </td>
                <td className="px-3 py-2 text-muted text-[11px]">
                  <RelativeTime iso={s.CreatedAt} />
                </td>
                <td className="px-3 py-2">
                  {s.status === 'pending' ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busyId === s.Id}
                          onClick={() => void handleApprove(s.Id)}
                          className="px-2 py-1 rounded border border-emerald-500/40 text-emerald-400 text-[10px] uppercase tracking-[0.12em] hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          {busyId === s.Id ? '…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === s.Id}
                          onClick={() => void handleReject(s.Id)}
                          className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Reject reason (optional)"
                        value={rejectReason[s.Id] ?? ''}
                        onChange={(e) =>
                          setRejectReason((prev) => ({ ...prev, [s.Id]: e.target.value }))
                        }
                        className="px-2 py-1 rounded border border-border bg-panel text-fg text-[11px] w-44"
                      />
                    </div>
                  ) : (
                    <span className="text-muted text-[11px]">{s.status}</span>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted text-xs">
                  {tab === 'pending'
                    ? 'No pending suggestions. The discover agent runs every ~20 min.'
                    : `No ${tab === 'all' ? '' : tab + ' '}suggestions.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function countByStatus(rows: Suggestion[]): Partial<Record<SuggestionStatus, number>> {
  const out: Partial<Record<SuggestionStatus, number>> = {};
  for (const r of rows) {
    out[r.status] = (out[r.status] ?? 0) + 1;
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: same failures as after Task 5 (in `DiscoveryPanel.tsx`, legacy Hub tabs). New file typechecks cleanly.

If Tailwind does not know `line-clamp-2`, add the `@tailwindcss/line-clamp` plugin or replace with `overflow-hidden text-ellipsis`. Check `frontend/tailwind.config.js`; Tailwind 3.3+ ships `line-clamp` by default, so no change needed.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/SuggestionsPanel.tsx
git commit -m "feat(ops): add SuggestionsPanel (review queue) with approve/reject + manual seed"
```

---

## Task 8: Wire `SuggestionsPanel` into `OpsTab`; delete `DiscoveryPanel`

**Files:**
- Modify: `frontend/src/features/hub/tabs/ops/OpsTab.tsx`
- Delete: `frontend/src/features/hub/tabs/ops/components/DiscoveryPanel.tsx`

- [ ] **Step 1: Edit OpsTab.tsx**

In `frontend/src/features/hub/tabs/ops/OpsTab.tsx`:

(a) Replace the import line `import { DiscoveryPanel } from './components/DiscoveryPanel';` with:
```typescript
import { SuggestionsPanel } from './components/SuggestionsPanel';
```

(b) Change the SubTab union type on line 17:
```typescript
type SubTab = 'suggestions' | 'scrape-targets' | 'queue';
```

(c) Change the default sub-tab on line 30:
```typescript
const [subTab, setSubTab] = useState<SubTab>('suggestions');
```

(d) In the nav (lines 218-232), replace the `discovery` entry and label mapping. The whole block becomes:

```tsx
<nav className="flex gap-1 border-b border-border">
  {(['suggestions', 'scrape-targets', 'queue'] as const).map((id) => (
    <button
      key={id}
      type="button"
      onClick={() => setSubTab(id)}
      className={[
        'px-3 py-2 text-[11px] uppercase tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors',
        subTab === id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
      ].join(' ')}
    >
      {id === 'suggestions' ? 'Suggestions' : id === 'scrape-targets' ? 'Scrape targets' : 'Queue jobs'}
    </button>
  ))}
</nav>
```

(e) Replace the `{subTab === 'discovery' && <DiscoveryPanel ... />}` block with:

```tsx
{subTab === 'suggestions' && (
  <SuggestionsPanel
    orgId={orgId}
    onActionComplete={dashboard.reload}
    loading={dashboard.loading}
  />
)}
```

- [ ] **Step 2: Delete DiscoveryPanel**

```bash
git rm frontend/src/features/hub/tabs/ops/components/DiscoveryPanel.tsx
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected remaining failures (all in doomed Hub-tab files):
- `frontend/src/features/hub/tabs/DiscoveryTab.tsx`
- `frontend/src/features/hub/tabs/ScrapeTargetsTab.tsx`
- `frontend/src/features/hub/tabs/ScraperTab.tsx`
- (Possibly `HubPage.tsx` if it imports from them)

If `HubPage.tsx` starts failing here (it imports `DiscoveryTab`, `ScrapeTargetsTab`), that's expected — Task 15 fixes it.

- [ ] **Step 4: Do NOT commit yet** — proceed to the Ribbon and Backoff work. The state here is: Suggestions UI rendered via `OpsTab`; legacy Hub tabs still dangling. Next milestone is a green typecheck after Task 10 (legacy Hub tabs removal in Task 15 finalises).

Actually, we can commit now since this was a user-facing atomic change. The dangling Hub-tab typecheck failures predate this task. Commit:

```bash
git add frontend/src/features/hub/tabs/ops/OpsTab.tsx
git rm frontend/src/features/hub/tabs/ops/components/DiscoveryPanel.tsx 2>/dev/null || true
git commit -m "feat(ops): swap Discovery sub-tab for Suggestions review queue in OpsTab"
```

---

## Task 9: Update `QueueJobsPanel` to use friendly task-type labels + legacy badge

**Files:**
- Modify: `frontend/src/features/hub/tabs/ops/components/QueueJobsPanel.tsx`

- [ ] **Step 1: Import the helper**

In `frontend/src/features/hub/tabs/ops/components/QueueJobsPanel.tsx`, add to the import block near the top:

```typescript
import { isLegacyTaskType, taskTypeLabel } from '../lib/taskTypeLabels';
```

- [ ] **Step 2: Render label + legacy badge**

Locate the row `<td>` rendering `job.type` (line 141):
```tsx
<td className="px-3 py-2">{job.type}</td>
```

Replace with:
```tsx
<td className="px-3 py-2">
  <div className="flex items-center gap-1.5">
    <span>{taskTypeLabel(job.type)}</span>
    {isLegacyTaskType(job.type) && (
      <span
        className="px-1.5 py-0.5 rounded border border-border text-[9px] uppercase tracking-[0.12em] text-muted"
        title={`Legacy task type: ${job.type}. New jobs no longer use this name.`}
      >
        legacy
      </span>
    )}
  </div>
</td>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: no new errors introduced.

- [ ] **Step 4: Manual browser check**

Run `cd frontend && pnpm dev`, open `/hub`, go to Queue Center → Queue jobs. Friendly labels render. Any legacy-typed rows (from pre-redesign history) show the `legacy` pill.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/QueueJobsPanel.tsx
git commit -m "feat(ops): friendly task-type labels + legacy badge in QueueJobsPanel"
```

---

## Task 10: Add `BackoffLight` and integrate into `OpsTab`

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/components/BackoffLight.tsx`
- Modify: `frontend/src/features/hub/tabs/ops/OpsTab.tsx`

- [ ] **Step 1: Create BackoffLight**

Write `frontend/src/features/hub/tabs/ops/components/BackoffLight.tsx`:

```typescript
import type { QueueStatus } from '../../../../../api/types/QueueStatus';

export interface BackoffLightProps {
  backoff?: QueueStatus['backoff'];
}

export function BackoffLight({ backoff }: BackoffLightProps) {
  if (!backoff) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] text-muted">
        <Dot className="bg-border" />
        <span>backoff: —</span>
      </div>
    );
  }

  const { state, idle_seconds, threshold } = backoff;
  const isClear = state === 'clear';
  const dotClass = isClear ? 'bg-emerald-400' : 'bg-amber-400';
  const stateLabel = isClear ? 'clear' : 'waiting for idle';
  const idleLabel = idle_seconds < 0 ? 'no chat yet' : `${idle_seconds}s idle`;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] text-muted"
      title={`Threshold ${threshold}s — background jobs run when idle_seconds ≥ threshold`}
    >
      <Dot className={dotClass} />
      <span className="text-fg">{stateLabel}</span>
      <span>· {idleLabel}</span>
      <span>· threshold {threshold}s</span>
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${className}`} />;
}
```

- [ ] **Step 2: Wire into OpsTab; remove old runtime triptych and ribbon-tile leak**

In `frontend/src/features/hub/tabs/ops/OpsTab.tsx`:

(a) Add import:
```typescript
import { BackoffLight } from './components/BackoffLight';
```

(b) Delete the triptych (lines 146-187 in the original — the three `<section>` blocks for "Runtime health", "Scheduler", "Active summary"). This entire `<div className="grid grid-cols-1 lg:grid-cols-3 gap-3">…</div>` block goes away — the ribbon + queue-jobs sub-tab already cover this.

(c) Delete the "Recent failures" section (lines 189-214) — it's duplicated by the Queue jobs sub-tab (filter chip "Failed"). Remove the surrounding `<section>`.

(d) Delete the now-unused `retry`, `retryBusy`, `retryStatus`, `setRetryBusy`, `setRetryStatus` hooks in `OpsTab` and the `retryQueueJob` import. They were only referenced by Recent failures.

(e) Delete the `groupActive` helper function (lines 267-283) and its call site (`const groupedActive = ...`). It's only referenced by the deleted Active summary section.

(f) Add the BackoffLight to the header row. In the header `<div className="flex items-end gap-3 flex-wrap">`, insert this after the Refresh button and before `{kickStatus && …}`:

```tsx
<BackoffLight backoff={dashboard.data?.queue_center?.backoff ?? dashboard.data?.queue?.backoff} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: same failures as before, localized to legacy Hub tabs. No new errors.

- [ ] **Step 4: Manual browser check**

`cd frontend && pnpm dev`. Go to Queue Center. Confirm:
- Green dot + "clear" when idle.
- Amber dot + "waiting for idle" when a chat turn has fired recently.
- Hover tooltip shows the threshold.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/BackoffLight.tsx \
        frontend/src/features/hub/tabs/ops/OpsTab.tsx
git commit -m "refactor(ops): replace per-priority backoff widget with single-gate BackoffLight"
```

---

## Task 11: Four-tile `PipelineRibbon` with deep-link on click

**Files:**
- Modify: `frontend/src/features/hub/tabs/ops/components/PipelineCard.tsx`
- Modify: `frontend/src/features/hub/tabs/ops/components/PipelineRibbon.tsx`
- Modify: `frontend/src/features/hub/tabs/ops/OpsTab.tsx`

- [ ] **Step 1: Extend PipelineCard**

In `frontend/src/features/hub/tabs/ops/components/PipelineCard.tsx`:

(a) Extend the `PipelineCardProps` interface (currently ends at line 25) with two optional props:

```typescript
  /** When defined, the card itself becomes clickable to deep-link into a detail panel. */
  onFocus?: () => void;
  /** Badge rendered in the header — used to show pending-count, queue depth, etc. */
  stageBadge?: { label: string; tone: 'info' | 'warn' | 'muted' };
```

(b) At the top of the component body, add a container `onClick`:

Replace the outermost `<div>` (line 41):
```tsx
<div className="border border-border rounded p-3 space-y-2 min-w-[14rem]">
```
With:
```tsx
<div
  className={[
    'border border-border rounded p-3 space-y-2 min-w-[14rem]',
    onFocus ? 'cursor-pointer hover:border-fg transition-colors' : '',
  ].join(' ')}
  onClick={onFocus}
>
```

Destructure `onFocus`, `stageBadge` in the component arg list.

(c) In the header `<div className="flex items-center justify-between">` (line 42-45), replace the enabled label span with:

```tsx
<div className="flex items-center gap-1.5">
  {stageBadge && (
    <span
      className={[
        'px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.12em]',
        stageBadge.tone === 'warn'
          ? 'bg-amber-500/20 text-amber-300'
          : stageBadge.tone === 'info'
            ? 'bg-blue-500/20 text-blue-300'
            : 'bg-panel text-muted',
      ].join(' ')}
    >
      {stageBadge.label}
    </span>
  )}
  <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{enabledLabel}</span>
</div>
```

(d) Make the Kick button stop propagation so clicking it doesn't also fire `onFocus`:
```tsx
onClick={(e) => { e.stopPropagation(); onKick(); }}
```

- [ ] **Step 2: Rewrite PipelineRibbon**

Replace `frontend/src/features/hub/tabs/ops/components/PipelineRibbon.tsx` entirely:

```typescript
import type { OpsDashboardResponse } from '../../../../../api/types/OpsDashboard';
import type { PipelineSummary } from '../../../../../api/types/PipelineSummary';
import { PipelineCard } from './PipelineCard';

export type PipelineStage = 'discover_agent' | 'suggestions' | 'pathfinder' | 'scraper';

export interface PipelineRibbonProps {
  pipeline?: PipelineSummary;
  suggestionsCount?: number;
  scrapeTargetsCount?: number;
  triggersDisabled?: boolean;
  busy?: 'scraper' | 'pathfinder' | 'discover' | null;
  onKick: (kind: 'scraper' | 'pathfinder' | 'discover') => void;
  onFocusStage: (stage: PipelineStage) => void;
}

export function PipelineRibbon({
  pipeline,
  suggestionsCount,
  scrapeTargetsCount,
  triggersDisabled,
  busy,
  onKick,
  onFocusStage,
}: PipelineRibbonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <PipelineCard
        kind="discover_agent"
        config={pipeline?.config?.discover_agent}
        schedule={pipeline?.schedule?.discover_agent}
        lastJob={pipeline?.last_jobs?.discover_agent}
        disabled={triggersDisabled}
        busy={busy === 'discover'}
        onKick={() => onKick('discover')}
        onFocus={() => onFocusStage('discover_agent')}
      />
      <SuggestionsTile
        count={suggestionsCount}
        onFocus={() => onFocusStage('suggestions')}
      />
      <PipelineCard
        kind="pathfinder"
        config={pipeline?.config?.pathfinder}
        schedule={pipeline?.schedule?.pathfinder}
        lastJob={pipeline?.last_jobs?.pathfinder}
        disabled={triggersDisabled}
        busy={busy === 'pathfinder'}
        onKick={() => onKick('pathfinder')}
        onFocus={() => onFocusStage('pathfinder')}
      />
      <PipelineCard
        kind="scraper"
        config={pipeline?.config?.scraper}
        schedule={pipeline?.schedule?.scraper}
        lastJob={pipeline?.last_jobs?.scraper}
        disabled={triggersDisabled}
        busy={busy === 'scraper'}
        onKick={() => onKick('scraper')}
        onFocus={() => onFocusStage('scraper')}
        stageBadge={
          scrapeTargetsCount != null
            ? { label: `${scrapeTargetsCount} pile`, tone: 'muted' }
            : undefined
        }
      />
    </div>
  );
}

// The Suggestions stage has no Huey job of its own (it is gated by user review),
// so we render a dedicated tile instead of a PipelineCard.
function SuggestionsTile({
  count,
  onFocus,
}: {
  count: number | undefined;
  onFocus: () => void;
}) {
  const pending = count ?? 0;
  return (
    <div
      className="border border-border rounded p-3 space-y-2 min-w-[14rem] cursor-pointer hover:border-fg transition-colors"
      onClick={onFocus}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFocus();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Suggestions</p>
        <span
          className={[
            'px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.12em]',
            pending > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-panel text-muted',
          ].join(' ')}
        >
          {pending} pending
        </span>
      </div>
      <p className="text-muted text-[11px] uppercase tracking-[0.14em]">Action</p>
      <p className="text-fg text-sm">
        {pending === 0 ? 'No review needed' : `${pending} waiting for review`}
      </p>
      <p className="text-muted text-[11px]">
        Discover agent proposes URLs; approve to enqueue pathfinder_extract.
      </p>
    </div>
  );
}

// Keep the OpsDashboardResponse import reachable for future expansion (currently unused here).
export type _Keep = OpsDashboardResponse;
```

(Remove the `export type _Keep = OpsDashboardResponse;` line if it trips `noUnusedLocals` — inspect `tsconfig.json`. If present, just remove both it and the import.)

- [ ] **Step 3: Update OpsTab to pass the new props**

In `frontend/src/features/hub/tabs/ops/OpsTab.tsx`, locate the `<PipelineRibbon ... />` call (around line 137). Replace its props with:

```tsx
<PipelineRibbon
  pipeline={dashboard.data?.pipeline}
  suggestionsCount={dashboard.data?.suggestions?.count}
  scrapeTargetsCount={dashboard.data?.scrape_targets?.count}
  triggersDisabled={triggersDisabled}
  busy={busyKick}
  onKick={kick}
  onFocusStage={(stage) => {
    if (stage === 'suggestions' || stage === 'discover_agent') setSubTab('suggestions');
    else if (stage === 'scraper') setSubTab('scrape-targets');
    else if (stage === 'pathfinder') setSubTab('suggestions'); // Pathfinder consumes approved suggestions
  }}
/>
```

Remove the `runtime=` and `backoff=` props (they no longer exist on PipelineRibbon) and the `import type { QueueStatus }` line if unused elsewhere.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: no new errors.

- [ ] **Step 5: Manual browser check**

`pnpm dev`, open Queue Center. Confirm four ribbon tiles render in Discover → Suggestions → Pathfinder → Scraper order. Clicking a tile switches the sub-tab below it. Kick buttons still work and don't also fire the deep-link.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/PipelineCard.tsx \
        frontend/src/features/hub/tabs/ops/components/PipelineRibbon.tsx \
        frontend/src/features/hub/tabs/ops/OpsTab.tsx
git commit -m "feat(ops): four-stage PipelineRibbon with deep-link on tile click"
```

---

## Task 12: Refine `ScrapeTargetsPanel` — sort, chips, drawer summary

**Files:**
- Modify: `frontend/src/features/hub/tabs/ops/components/ScrapeTargetsPanel.tsx`

- [ ] **Step 1: Add brief-aligned filter chips + default sort**

Replace the `Filter` union and `filterRows` function at the top/bottom of the file with:

```typescript
type Filter = 'all' | 'ok' | 'error' | 'scraping' | 'rejected';
```

Replace the `options` array on the `FilterChips` call (line 95-103):

```tsx
options={[
  { id: 'all', label: 'All' },
  { id: 'ok', label: 'Ok' },
  { id: 'scraping', label: 'Scraping' },
  { id: 'error', label: 'Error' },
  { id: 'rejected', label: 'Rejected' },
]}
```

Replace the `filterRows` function body:

```typescript
function filterRows(rows: Array<Record<string, unknown>>, filter: Filter) {
  if (filter === 'all') return rows;
  return rows.filter((r) => String(valueAt(r, 'status') ?? '') === filter);
}
```

- [ ] **Step 2: Add "Active only" toggle**

After the `<FilterChips>` render (currently wrapped in `flex items-center justify-between`), add a sibling control. Change the outer header div so it has three children:

```tsx
<div className="flex items-center justify-between gap-3 flex-wrap">
  <div className="flex items-center gap-3 flex-wrap">
    <FilterChips ... />
    <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted">
      <input
        type="checkbox"
        checked={activeOnly}
        onChange={(e) => setActiveOnly(e.target.checked)}
      />
      Active only
    </label>
  </div>
  {actionMessage && (
    <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{actionMessage}</span>
  )}
</div>
```

Add `const [activeOnly, setActiveOnly] = useState(true);` near the other `useState`s.

Modify the `filtered` memo to pre-filter by `active` field when `activeOnly` is on:

```typescript
const filtered = useMemo(() => {
  const stageOne = activeOnly ? rows.filter((r) => valueAt(r, 'active') === 1) : rows;
  return filterRows(stageOne, filter);
}, [rows, filter, activeOnly]);
```

- [ ] **Step 3: Default sort `next_crawl_at` ASC (nulls first)**

Replace the `const filtered` expression above with a sort-after-filter:

```typescript
const filtered = useMemo(() => {
  const stageOne = activeOnly ? rows.filter((r) => valueAt(r, 'active') === 1) : rows;
  const filtered = filterRows(stageOne, filter);
  return [...filtered].sort(compareByNextCrawlAt);
}, [rows, filter, activeOnly]);
```

Add this module-level helper at the bottom of the file:

```typescript
function compareByNextCrawlAt(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const av = valueAt(a, 'next_crawl_at');
  const bv = valueAt(b, 'next_crawl_at');
  const ae = av == null || av === '';
  const be = bv == null || bv === '';
  if (ae && be) {
    // Tie-breaker: CreatedAt ascending.
    const ca = Date.parse(String(valueAt(a, 'CreatedAt') ?? ''));
    const cb = Date.parse(String(valueAt(b, 'CreatedAt') ?? ''));
    return (Number.isNaN(ca) ? 0 : ca) - (Number.isNaN(cb) ? 0 : cb);
  }
  if (ae) return -1;
  if (be) return 1;
  const aT = Date.parse(String(av));
  const bT = Date.parse(String(bv));
  return (Number.isNaN(aT) ? 0 : aT) - (Number.isNaN(bT) ? 0 : bT);
}
```

- [ ] **Step 4: Flag `consecutive_failures >= 3` red**

In the row render, replace the `<td>` for consecutive_failures (line 149):

```tsx
<td className="px-3 py-2">{fmt(valueAt(r, 'consecutive_failures'))}</td>
```

With:

```tsx
<td className="px-3 py-2">
  {(() => {
    const n = Number(valueAt(r, 'consecutive_failures') ?? 0);
    const cls = n >= 3 ? 'text-red-400 font-medium' : '';
    return <span className={cls}>{n}</span>;
  })()}
</td>
```

- [ ] **Step 5: Drawer renders the `summary` field for scrape-target rows**

The existing `<RowDrawer ... kind="target" data={drawerData} />` only shows raw JSON. The brief wants the drawer to show the full ScrapeTarget + summary + recent tool_jobs touching it. We have the row body in `drawerData`; the summary column is already on the row. Pass an `extra` prop that pulls it out:

Replace the RowDrawer JSX (line 199-208) with:

```tsx
<RowDrawer
  open={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  kind="target"
  id={drawerId}
  loading={drawerLoading}
  error={drawerError}
  data={drawerData}
  extra={renderTargetExtra(drawerData)}
/>
```

And add at the bottom of the file:

```typescript
function renderTargetExtra(data: unknown): React.ReactNode {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const summary = row.summary;
  if (typeof summary !== 'string' || summary.trim() === '') return null;
  return (
    <details open>
      <summary className="text-[11px] uppercase tracking-[0.14em] text-muted cursor-pointer">
        Summary
      </summary>
      <p className="mt-2 p-3 rounded border border-border bg-panel/60 text-sm whitespace-pre-wrap">
        {summary}
      </p>
    </details>
  );
}
```

Note: "recent tool_jobs touching it" is NOT implemented in this task — the ops dashboard does not return per-target job history and adding a new endpoint is out of scope. Leaving this as a follow-up item documented in the final task.

- [ ] **Step 6: Typecheck + browser check**

`npx tsc --noEmit -p frontend/tsconfig.json` — no new errors.

`pnpm dev`, open Queue Center → Scrape targets. Verify:
- Default sort: never-scraped rows first (null `next_crawl_at`), then earliest `next_crawl_at`.
- Status filter chips work.
- Active-only toggle defaults to on, hides inactive rows.
- A row with `consecutive_failures ≥ 3` shows red digits.
- Opening the drawer on a row with a non-empty `summary` shows a Summary section above the Raw JSON.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/ScrapeTargetsPanel.tsx
git commit -m "feat(ops): refine ScrapeTargetsPanel — status chips, next_crawl sort, drawer summary"
```

---

## Task 13: Remove legacy Hub tabs (Discovery, Scrape Targets, Scraper)

**Files:**
- Modify: `frontend/src/features/hub/HubPage.tsx`
- Modify: `frontend/src/features/hub/types/HubTab.ts`
- Delete: `frontend/src/features/hub/tabs/DiscoveryTab.tsx`
- Delete: `frontend/src/features/hub/tabs/ScrapeTargetsTab.tsx`
- Delete: `frontend/src/features/hub/tabs/ScraperTab.tsx`

- [ ] **Step 1: Check HubTab.ts contents**

Read `frontend/src/features/hub/types/HubTab.ts` and note its current literals. If it contains `'discovery'` and `'scrape-targets'`, remove both. The result should be roughly:

```typescript
export type HubTab = 'home' | 'logs' | 'stats' | 'queue' | 'research';
```

(If there are unrelated literals like `'code'` or `'agents'`, keep them.)

- [ ] **Step 2: Edit HubPage.tsx**

In `frontend/src/features/hub/HubPage.tsx`:

(a) Remove these imports (lines 6-7):
```typescript
import { DiscoveryTab } from './tabs/DiscoveryTab';
import { ScrapeTargetsTab } from './tabs/ScrapeTargetsTab';
```

(b) Remove these tab entries from the `tabs` array (lines 32-33):
```typescript
{ id: 'discovery', label: 'Discovery' },
{ id: 'scrape-targets', label: 'Scrape Targets' },
```

(c) Remove the tab body render lines (lines 77-78):
```tsx
{tab === 'discovery' && <DiscoveryTab />}
{tab === 'scrape-targets' && <ScrapeTargetsTab />}
```

- [ ] **Step 3: Delete the files**

```bash
git rm frontend/src/features/hub/tabs/DiscoveryTab.tsx \
       frontend/src/features/hub/tabs/ScrapeTargetsTab.tsx \
       frontend/src/features/hub/tabs/ScraperTab.tsx
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: clean, no errors. This is the first green typecheck since Task 3.

If any files still reference the deleted tabs (e.g., other routes), search and remove. Use Grep for `DiscoveryTab`, `ScrapeTargetsTab`, `ScraperTab`, `'discovery'`, `'scrape-targets'` across `frontend/src/` and clean up. Expected: no remaining imports.

- [ ] **Step 5: Browser check**

`cd frontend && pnpm dev`. Open `/hub`. Top-level tabs are now: Home, Logs, Stats, Queue Center, Research. Queue Center still works; Discovery and Scrape Targets top-level tabs are gone.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/hub/HubPage.tsx \
        frontend/src/features/hub/types/HubTab.ts
git commit -m "refactor(hub): drop legacy Discovery/ScrapeTargets/Scraper top-level tabs"
```

---

## Task 14: Check for and remove remaining dead imports & types

**Files:**
- Potentially: `frontend/src/api/enrichment/_normalizeList.ts` (verify still used)
- Potentially: `frontend/src/api/enrichment/fetchNextPathfinderSeed.ts`, `fetchNextScraperTarget.ts` (verify still used)
- Potentially: `frontend/src/api/enrichment/chainKick.ts` (still used by `startScraper`/`startPathfinder`/`startDiscoverAgent` — keep)

- [ ] **Step 1: Grep for ghost references**

Use Grep across `frontend/src/` for each of these symbols and confirm zero matches:
- `DiscoveryRow`
- `DiscoveryListResponse`
- `listDiscovery`
- `runScraper`
- `scrapeNext`
- `ScraperRunRequest`
- `ScraperNextResponse`
- `markUrlProcessed`
- `fetchNextUrl`
- `getDiscoveryRow`
- `/discovery/list`
- `/scraper/run`
- `/scraper/scrape-next`
- `/pathfinder/mark-processed`
- `pathfinder_recrawl_dispatcher`
- `classify_relevance` (in frontend/src only)

Any surviving reference is either dead (delete it) or a genuine use (keep + fix to current shape).

- [ ] **Step 2: Fix or delete each finding**

If you find references, fix them one by one. Typical fixes:
- Dead import lines → delete.
- Dead file → `git rm`.
- Reference to legacy task type in a comment → update or remove.

- [ ] **Step 3: Verify the `_normalizeList.ts` helper**

Read `frontend/src/api/enrichment/_normalizeList.ts`. Confirm it's imported by at least one surviving file (`scrapeTargets.ts`, `suggestions.ts`). If not, delete it.

- [ ] **Step 4: Typecheck + build**

Run:
```bash
npx tsc --noEmit -p frontend/tsconfig.json
cd frontend && pnpm build
```
Both must succeed.

- [ ] **Step 5: Commit (if any changes)**

```bash
git add -A
git commit -m "chore(ops): prune dead enrichment imports and legacy references"
```

If there were no findings, skip the commit — nothing to record.

---

## Task 15: End-to-end manual QA pass

**Files:** none (verification only)

- [ ] **Step 1: Start dev and sanity-check the golden path**

```bash
cd frontend && pnpm dev
```

Open `http://localhost:5173/hub` in a browser. Log in if required. Select `Queue Center`.

Run through:

1. **Ribbon**: four tiles render in order Discover → Suggestions → Pathfinder → Scraper. The Suggestions tile shows the pending count.
2. **Click Discover tile**: sub-tab switches to Suggestions.
3. **Click Scraper tile**: sub-tab switches to Scrape targets.
4. **Suggestions tab**:
   - Default view shows Pending status chips.
   - Row shows title / URL (clickable to new tab), query, relevance pill (color per `high/medium/low/rejected`), score, reason, age.
   - Click Approve on a row — row removes optimistically, toast shows `approved & queued job <id>`.
   - Click Reject on a row, after typing a reason — row removes, toast shows `rejected <id>`.
   - Select 2+ rows, click "Approve selected" — progress counter ticks up, rows disappear.
   - Switch to All status chip — row counts per status are visible on each chip.
   - Enter a URL in the "Add seed URL" form, submit — toast says `seed queued — extracting links in background`.
   - Empty state on Pending with no rows: "No pending suggestions. The discover agent runs every ~20 min."
5. **Scrape targets tab**:
   - Default: active-only on, sorted with never-scraped rows first.
   - Filter chip "Error" hides non-error rows.
   - Row with 3+ consecutive failures shows red digit.
   - Click Open on a row with a populated `summary` field — drawer shows Summary section above Raw JSON.
   - Click Run now — toast shows queued job id; the row's `next_crawl_at` updates on next poll.
6. **Queue jobs tab**:
   - Types show friendly labels (e.g. `Scrape page`, `Pathfinder extract`, `Discover agent`).
   - A row with a legacy `type` shows a `legacy` pill.
   - Retry / Cancel / priority ±1 controls still work.
7. **BackoffLight**:
   - Header strip shows green dot + "clear" when you haven't chatted recently.
   - Trigger a chat turn in another tab, watch the light flip amber + "waiting for idle".
8. **Banner**:
   - If tool-queue is stopped, a prominent amber banner appears above the panels (existing behavior).

- [ ] **Step 2: Kick checks**

Click `Kick` on Discover, Pathfinder, and Scraper tiles in turn. Each should produce a status line like `scraper: kicked (queued N)` near the header. Tool queue jobs should appear momentarily.

- [ ] **Step 3: Edge cases**

- Approve a suggestion that is already approved in another tab → expect `approve not_found` or `approve failed` toast, row still displayed.
- Submit an invalid URL via the seed form → expect `seed failed: invalid_url`.
- Toggle Active only off → inactive targets (auto-deactivated after 8 failures) appear.

- [ ] **Step 4: No commit needed**

This task is QA only. If you find a bug, open a new task with a fix; do not silently patch.

---

## Task 16: Follow-ups (documented, not implemented here)

- [ ] **Step 1: Record the out-of-scope items**

Append to this plan file (at the very bottom) a `## Follow-ups` section listing:

1. Drawer in `ScrapeTargetsPanel` does not yet list recent `tool_jobs` touching the target. Backend would need a `/scrape-targets/{id}/jobs` endpoint or the dashboard would need to join `queue_jobs` by `payload.target_id`. Deferred.
2. No unit/integration tests were added — the frontend has no test harness configured. A vitest + @testing-library scaffold + tests for `SuggestionsPanel`, `BackoffLight`, `taskTypeLabel` is a standalone follow-up.
3. SSE event `job_completed` for a `pathfinder_extract` job could nudge the Suggestions panel to re-fetch (currently relies on the 30s-style polling via `useOpsDashboard` + manual Refresh). Low priority.
4. Manual seed form accepts only one URL at a time. Bulk-import from CSV / textarea is a future UX win, not in scope.

Commit the updated plan:

```bash
git add docs/superpowers/plans/2026-04-21-enrichment-pipeline-redesign.md
git commit -m "docs(plan): record enrichment UI follow-ups for later cycles"
```

---

## Self-Review Checklist (run after completing all tasks)

- [ ] Suggestions Review Queue renders at Queue Center → Suggestions.
- [ ] `/discovery/suggestions` list/approve/reject endpoints wired with optimistic removal + bulk support.
- [ ] Manual seed form calls `POST /pathfinder/discover`.
- [ ] Scraper Pile: oldest-first sort with nulls-first, filter chips, Active-only toggle, fails red at ≥3, drawer summary.
- [ ] Pathfinder Preview + Discover Agent kick surface via existing `NextCandidatePanel` + ribbon kick buttons.
- [ ] Four-tile PipelineRibbon with deep-link tile click.
- [ ] Tool Queue shows friendly labels + legacy pill.
- [ ] BackoffLight shows the single-gate traffic light; old per-priority widget removed.
- [ ] Legacy DiscoveryPanel, DiscoveryTab, ScrapeTargetsTab, ScraperTab all deleted; HubPage no longer has `discovery` / `scrape-targets` top tabs.
- [ ] Dead endpoints `/scraper/run`, `/scraper/scrape-next`, `/pathfinder/mark-processed`, `/discovery/list`, `getDiscoveryRow` all removed from frontend.
- [ ] `DiscoveryRow` type removed; `Suggestion` type added.
- [ ] `QueueStatus.backoff` collapsed to `{state, idle_seconds, threshold}`.
- [ ] `ScrapeTargetRow` gains `summary` + `suggested_id`.
- [ ] `pnpm build` and `npx tsc --noEmit` both succeed.
