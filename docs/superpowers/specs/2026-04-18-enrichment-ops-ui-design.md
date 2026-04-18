# Enrichment Operations UI — Design

**Date:** 2026-04-18
**Status:** Approved for planning
**Owner:** Michael Turner

## Goal

Make pathfinder, scraper, discovery, and queue behavior transparent and operator-friendly. An operator should be able to answer, at a glance:

- What will run next?
- Why is something not running (cooldown, backoff, no candidates, queue down)?
- Is discovery finding new URLs?
- Is the scraper repeatedly working the same docs?
- Can I manually trigger or retry work without using admin tools?

Replaces the body of the existing **Hub → Ops** tab. Standalone Discovery, Scrape Targets, and Queue tabs remain for deep filtering and historical views.

## Layout

Three regions plus a runtime banner:

1. **Pipeline ribbon** (top). Three pipeline cards (Scraper, Pathfinder, Discover-agent) showing next dispatch + last job result + Kick button, plus a Queue/Huey health card showing backoff state, consumer running, workers.
2. **Sub-tab area** (left, ~70% width). Three sub-tabs: Discovery, Scrape Targets, Queue Jobs. Each is a filter chip strip + a table + a row drawer.
3. **Next candidate side panel** (right, ~30% width, sticky). Pathfinder seed and scraper target previews from `pipeline.next_candidates` with a Re-evaluate button.

Banner appears above the ribbon when the queue runtime is unavailable; it disables every trigger and Run-now button while shown.

## Data sources

Single dashboard call drives nearly everything:

- `GET /api/ops/dashboard?org_id=…&limit=20` returns `pipeline.{config,schedule,last_jobs,next_candidates}`, `discovery.rows`, `scrape_targets.rows`, `queue_jobs.rows`, `runtime`, `queue.backoff`, `scheduler`. Feeds the ribbon, side panel, and all three tables.

On-demand:

- `POST /api/enrichment/pathfinder/fetch-next` — preview the exact next pathfinder seed.
- `POST /api/enrichment/scraper/scrape-next` — preview the exact next scraper target (includes `_selection_bucket`).

These are treated as non-mutating preview probes per the latest backend behavior; the side panel calls them on mount and on Re-evaluate.

Action endpoints (each followed by an optimistic dashboard reload):

- `POST /api/enrichment/scraper/start`
- `POST /api/enrichment/pathfinder/start`
- `POST /api/enrichment/discover-agent/start`
- `POST /api/enrichment/scrape-targets/:id/run-now` *(new gateway passthrough)*
- `POST /api/queue/jobs/:job_id/retry` *(new gateway passthrough)*
- `PATCH /api/queue/jobs/:job_id/priority`
- `DELETE /api/queue/jobs/:job_id`

## Refresh strategy

- **SSE** on `/api/queue/events` → debounced full-dashboard reload (~400 ms after the last event). Same wiring as today's OpsTab.
- **10 s periodic ticker** as a fallback for non-queue state changes (next-candidate timing, scheduler ticks, discovery rows added by pathfinder).
- Both pause when the tab is hidden (`document.visibilityState !== 'visible'`).
- Side panel preview is **not polled** — fires on mount and on the Re-evaluate button only.

## File structure

```
frontend/src/features/hub/tabs/ops/
  OpsTab.tsx                       — orchestrator: org input, layout, sub-tab state
  hooks/
    useOpsDashboard.ts             — fetch + SSE + debounced reload + 10s ticker + visibility pause
    useNextCandidatePreview.ts     — POST fetch-next / scrape-next on demand
  components/
    PipelineRibbon.tsx             — three pipeline cards + queue/huey health card + kick buttons
    PipelineCard.tsx               — single pipeline card
    NextCandidatePanel.tsx         — pathfinder + scraper preview + re-evaluate
    DiscoveryPanel.tsx             — sub-tab: filter chips + table + drawer
    ScrapeTargetsPanel.tsx         — sub-tab: filter chips + table + Run-now + drawer
    QueueJobsPanel.tsx             — sub-tab: filter chips + table + Retry/Cancel/Priority + drawer
    StatusChip.tsx                 — shared status pill, prescribed palette
    RelativeTime.tsx               — "due in 4m" / "2h ago" with absolute timestamp tooltip
    HelpTooltip.tsx                — small (i) tooltip for the two scheduling explainers
    RowDrawer.tsx                  — shared right-side Sheet wrapper for raw JSON + payload/result
  lib/
    formatters.ts                  — fmt, fmtWhen, formatRelative, formatKick, extractApiFailure
    selectionBucket.ts             — bucket label + color helpers

frontend/src/api/
  enrichment/
    runScrapeTargetNow.ts          — POST /api/enrichment/scrape-targets/:id/run-now
    fetchNextPathfinderSeed.ts     — POST /api/enrichment/pathfinder/fetch-next  (preview)
    fetchNextScraperTarget.ts      — POST /api/enrichment/scraper/scrape-next   (preview)
  queue/
    retryQueueJob.ts               — POST /api/queue/jobs/:job_id/retry
  types/
    OpsDashboard.ts                — extend with PipelineSummary, PipelineConfig, PipelineSchedule, PipelineLastJobs, NextCandidates, ScraperPreviewRow, PathfinderPreviewRow, RetryQueueJobResponse, RunNowResponse

gateway/src/routes/
  enrichment.ts                    — add POST /scrape-targets/:id/run-now passthrough
  queue.ts                         — add POST /jobs/:id/retry passthrough
```

The existing `frontend/src/features/hub/tabs/OpsTab.tsx` is removed; `HubPage.tsx` updates its import to `./tabs/ops/OpsTab`.

## Component contracts (key bits)

### `useOpsDashboard(orgId)`
Returns `{ data, loading, error, queueUnavailable, runtime, reload, lastReloadedAt }`. Internally manages SSE, debounced reload, 10 s ticker, and visibility-pause. `error` is the formatted server message; `queueUnavailable` is a boolean derived from `runtime.tool_queue_ready === false` or `data.error === 'tool_queue_unavailable'`.

### `useNextCandidatePreview(orgId)`
Returns `{ pathfinder, scraper, loadingPath, loadingScrape, errorPath, errorScrape, reevaluate }`. `reevaluate` re-fires both POSTs in parallel.

### `PipelineCard`
Props: `kind` (`'scraper' | 'pathfinder' | 'discover'`), `config`, `schedule`, `lastJob`, `disabled`, `onKick`. Shows configured cadence vs actual last result so an operator can spot "should run every 10 min, last skipped due to cooldown" without leaving the screen.

### `NextCandidatePanel`
Two stacked sub-cards. Each shows the source URL/Id, status chip, bucket badge (scraper only), source-of-fallback badge (pathfinder only), and a Re-evaluate button bound to `useNextCandidatePreview.reevaluate`. When the candidate is `null`, shows "No candidate selected right now" with a help tooltip explaining the selection order.

### `DiscoveryPanel`
Quick filter chips: All / New / Failed / Recently Updated. Columns: Id, url, status, score, depth, source_url, UpdatedAt, error_message. Status chip per row. Open drawer → `getDiscoveryRow`.

### `ScrapeTargetsPanel`
Quick filter chips: Due Now / Never Scraped / Auto / Manual / Failed / Unchanged / All. Columns: Id, url, name, status, active, auto_crawled, depth, frequency_hours, last_scraped_at, next_crawl_at (with relative-time), consecutive_failures, consecutive_unchanged, chunk_count, last_scrape_error. Selection-bucket column is populated only for the row(s) returned in `next_candidates.scraper`. Per-row actions: Run now (`runScrapeTargetNow`), Open drawer.

### `QueueJobsPanel`
Quick filter chips: Running / Failed / Waiting / Completed / All. Columns: job_id, type, status, priority (± controls when queued), source, task, result_status, error, started_at, completed_at, claimed_by. Per-row actions:
- queued → Raise priority, Cancel
- running → Cancel
- completed / failed / cancelled → Retry
Drawer shows payload, result, raw JSON.

## Visual rules

Status chip palette (shared via `StatusChip`):

| Status                                  | Class                          |
| --------------------------------------- | ------------------------------ |
| `discovered`                            | blue                           |
| `scraped` / `ok` / `completed`          | emerald                        |
| `queued`                                | amber                          |
| `running`                               | violet                         |
| `failed` / `error`                      | red                            |
| `idle` / `no_chunks` / `no_queries` / `cancelled` / null | muted                |

Relative time: `<RelativeTime iso=…>` renders e.g. `due in 4m` when in the future, `2h ago` when past, with the full ISO timestamp as the title attribute.

Help tooltips:

- **Scraper selection order** — pinned next to the Scrape Targets sub-tab title:
  > Current scraper target order: manual never-scraped → manual due → auto due → auto never-scraped. Brand-new auto URLs do not always win; due auto rows are processed before fresh ones.
- **Pathfinder fallback** — pinned next to the side-panel "Next pathfinder seed" header:
  > Pathfinder seed can come from discovery roots or scrape-target fallback. Fallback is intentionally limited to manual targets and shallow/root-like auto targets so deep old docs are not re-used as seeds endlessly.

## Edge cases

- Render unknown columns safely; tables read full NocoDB rows. Use `valueAt(r, key)` + `fmt(v)` everywhere; never assume every row has every field.
- `pipeline.next_candidates.pathfinder == null` → side panel shows "No candidate selected right now" plus the help tooltip.
- `runtime` unavailable or `tool_queue_unavailable` → top banner; all trigger and per-row action buttons disable.
- Trigger response with `status: 'failed'` → render `error` string in toast/inline status; do not reload.
- Retry response with new `job_id` → optimistic insert at top of the queue table, then full reload.
- Cancel/priority on a job that has since completed → swallow the 409, full reload.
- SSE disconnect → auto-retry every 2 s (existing pattern). Periodic ticker keeps data fresh while disconnected.

## Out of scope

- Modifying the standalone Discovery / Scrape Targets / Queue tabs.
- Adding charts/timelines (reserved for a later iteration).
- Editing scrape-target rows inline.
- Bulk actions across queue jobs.
- URL-state sync for filters (session-only this round).

## Success criteria

After this ships, an operator can answer the listed questions without leaving the screen, and can run a target or retry a job without admin tools.