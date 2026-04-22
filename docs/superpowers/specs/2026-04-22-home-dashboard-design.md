# Home Dashboard — Design

**Date:** 2026-04-22
**Status:** Approved (brainstorming gate)
**Scope:** Frontend only. Backend is live and unchanged.

## 1. Purpose

Build a single-page Home Dashboard at `/home` as the daily driver for the
solo-user JeffGPT system. The dashboard surfaces today's digest, insights,
pending questions, a rolling chat, schedules, and contextual widgets. The
existing `/hub` operator surface is folded into this page as tabs, and `/hub`
is deleted.

## 2. Routing changes

- **New:** `src/routes/home.tsx` renders `HomePage`.
- **Changed:** `src/routes/index.tsx` redirects to `/home` instead of `/chat`.
- **Changed:** `src/routes/hub.tsx` becomes a redirect to `/home`.
- **Deleted:** `src/features/hub/` after its tab content has been migrated.

## 3. Page shell

`HomePage.tsx` owns:

- Header: page title + health dot (`/home/health`), reusing the style from the
  old `HubPage` header.
- Tab nav with four tabs: **Dashboard** (default) | **Logs** | **Stats** |
  **Queue**.
- An `UnhealthyBanner` that renders above the tab content whenever
  `/home/health` reports `scheduler_running=false` or any required table
  missing.

The dashboard content (section 4) lives in the Dashboard tab. Logs and Queue
tabs are thin wrappers that re-export the existing pages. The Stats tab gains
two new sections (section 5).

## 4. Dashboard tab

Desktop-first three-column layout:

```
┌──────────────────────── GreetingStrip ────────────────────────┐
│ date · time-since-last-chat · [Brief me][Run digest][Produce] │
├─────────────┬──────────────────────────────┬──────────────────┤
│ Schedules   │ QuestionsPanel               │ HomeChat         │
│ WidgetRail  │ Feed (load more)             │ (SSE stream)     │
│  Email                                                        │
│  Calendar                                                     │
│  Graph                                                        │
│  CodeConvos   (existing hub endpoints)                        │
│  ChatConvos   (existing hub endpoints)                        │
│  Scrapers     (existing hub endpoints)                        │
└─────────────┴──────────────────────────────┴──────────────────┘
```

### 4.1 GreetingStrip

- Shows today's date (absolute) and time-since-last-chat from
  `/home/health.seconds_since_chat`.
- Three quick-action buttons:
  - **Brief me** → `POST /home/briefing?org_id=…` → subscribe to returned
    job, stream into the home chat.
  - **Run digest** → `POST /home/digest/run` → toast, poll
    `GET /home/digest` every 10s for up to 2 min.
  - **Produce insight** → opens a small inline input for optional
    `topic_hint` → `POST /home/insights/produce` → toast, poll
    `GET /home/insights` after 60s.

### 4.2 QuestionsPanel

- Source: `pending_questions` from `/home/overview` (and standalone
  `/home/questions?status=pending` for refreshes after mutations).
- Each question renders:
  - `question_text`
  - `suggested_options` as quick-reply buttons
  - free-text fallback
  - dismiss (`POST /home/questions/{id}/dismiss`) and, for answered items
    surfaced from chat, retract (`POST /home/questions/{id}/retract`).
- Answering posts `POST /home/questions/{id}/answer`, subscribes to the
  returned `job_id`, streams the ack into HomeChat, optimistically marks
  the question answered, rolls back on error.

### 4.3 Feed

- Source: `GET /home/feed?org_id=…&limit=25`, with a Load more button that
  appends using the oldest `created_at` as cursor (client-side skip
  duplicates).
- Item types: `digest`, `insight`, `question`, `run`.
- Click targets:
  - `digest` → opens `DigestModal`, fetching full body via
    `GET /home/digest?date=…`.
  - `insight` → opens `InsightModal`, fetching full body via
    `GET /home/insights/{id}`.
  - `question` → scrolls to the QuestionsPanel entry and focuses its
    first quick reply.
  - `run` → small detail popover using the snippet already in the feed
    item (no dedicated endpoint in v1).
- Empty state and skeletons.

### 4.4 HomeChat

- Hydrates from `home_conversation` metadata on `/home/overview`. Message
  history for the existing conversation is loaded via the existing chat
  conversation endpoints (to be identified during implementation — this is
  the only possible unknown and will fall back to "new conversation" if no
  endpoint exists).
- Send: `POST /home/chat` with `search_mode: "basic"`,
  `search_consent_confirmed: false` by default (mirrors existing default);
  a search-mode selector sits above the input for parity with the chat
  route.
- Streaming: `subscribeJob(jobId)` wraps `EventSource` on
  `/stream/{job_id}`, emits typed events (`status | chunk | error | done`)
  and ends on the `[DONE]` sentinel.
- 429 surfaces as a toast ("Rate limited — slow down").
- Markdown rendered via `react-markdown` + `remark-gfm`.
- Download button: `GET /home/conversation/export?org_id=…` → save as
  `.md`.

### 4.5 SchedulesPanel

- Source: `/home/overview.schedules` (refreshed with overview polling).
- Each row shows agent name, description, cron, timezone, next run time
  (relative), and a **Run now** button
  (`POST /home/schedules/{id}/run-now`).
- Inactive schedules are dimmed.

### 4.6 WidgetRail

Rendered vertically below schedules. Each widget fetches on mount and on
overview refresh.

| Widget | Source | Notes |
| --- | --- | --- |
| Email | `GET /home/widgets/email` | Placeholder unless `enabled: true`. |
| Calendar | `GET /home/widgets/calendar` | Placeholder unless `enabled: true`. |
| Graph | `GET /home/widgets/graph` | Lists `top_entities`, `sparse_concepts`, `recent_edges`. No viz in v1. |
| Code conversations | existing hub client (e.g. code conversations list) | Small list, click → existing route. |
| Chat conversations | existing chat conversation list client | Small list, click → existing `/chat` deep link. |
| Scrapers | existing queue/scraper client (e.g. `listQueueJobs` filtered, or research plan list) | Status counts + 3 most recent. |

Exact hub endpoints reused are identified during implementation by reading
`src/api/chat`, `src/api/code`, `src/api/queue`, `src/api/enrichment` — no
new backend work.

## 5. Stats tab additions

Two sections rendered above the existing Stats content:

- **Today** — derived from `/home/overview`: digest cluster/source counts
  for today, count of today's insights, count of today's pending
  questions, count of today's feed items by kind.
- **Overview** — the full operator overview previously in
  `src/features/hub/tabs/HomeTab.tsx`, lifted unchanged: connected
  indicator, queue status, 5 recent jobs, 7-day harness stats, research
  pipeline counts.

## 6. File layout

```
src/features/home/
  HomePage.tsx
  tabs/
    DashboardTab.tsx
    StatsTab.tsx
    LogsTab.tsx
    QueueTab.tsx
  dashboard/
    GreetingStrip.tsx
    UnhealthyBanner.tsx
    Feed.tsx
    FeedItem.tsx
    QuestionsPanel.tsx
    QuestionCard.tsx
    HomeChat.tsx
    ChatMessage.tsx
    SchedulesPanel.tsx
    WidgetRail.tsx
    widgets/
      EmailWidget.tsx
      CalendarWidget.tsx
      GraphWidget.tsx
      CodeConvosWidget.tsx
      ChatConvosWidget.tsx
      ScrapersWidget.tsx
    modals/
      DigestModal.tsx
      InsightModal.tsx
  stats/
    TodaySection.tsx
    OverviewSection.tsx
  hooks/
    useOverview.ts
    useHomeChat.ts
    useSseJob.ts
    useKeyboardShortcuts.ts
    useToast.ts (or reuse)

src/api/home/
  overview.ts · feed.ts · health.ts · digest.ts · insights.ts
  questions.ts · chat.ts · schedules.ts · briefing.ts · search.ts
  widgets.ts · conversationExport.ts · types.ts

src/lib/sse/
  subscribeJob.ts
```

## 7. Data flow and hooks

- `useOverview()` — fetches `/home/overview` on mount, on 60s interval, and
  on `window.focus`. Returns `{ data, loading, error, refetch }` and also
  exposes a `refetchAfter(ms)` helper used by mutation callers.
- `useSseJob(jobId)` — returns `{ status, chunks, done, error }` from
  `/stream/{job_id}` and closes the `EventSource` on unmount.
- `useHomeChat()` — owns the chat state: messages, current streaming
  assistant message, send function. Built on `useSseJob`.
- `useKeyboardShortcuts()` — binds `/` (focus chat), `b` (briefing),
  `d` (digest run) at the `DashboardTab` scope, ignoring when an input is
  focused.
- `useToast()` — tiny custom hook if none exists.

## 8. Configuration

- `VITE_API_BASE` (default `http://localhost:3800`) — base for `/home/*`
  and `/stream/*`.
- `VITE_DEFAULT_ORG_ID` (default `1`) — injected into every call.

## 9. Styling

- Reuse existing Tailwind theme tokens (`bg-bg`, `text-fg`, `text-muted`,
  `border-border`, `font-display`, etc.) so the new surface matches the
  rest of the app.
- System theme default (honored by existing setup).
- Markdown: basic prose styles via Tailwind typography utilities already
  present, or a minimal scoped stylesheet if absent.

## 10. Error and empty states

- Every panel renders a skeleton while loading and a distinct empty state.
- `UnhealthyBanner` appears whenever `/home/health` flags trouble and
  disappears automatically.
- 404 from `/home/digest` → digest empty state with **Run digest** CTA.
- 503 from `POST /home/digest/{id}/feedback` → inline note
  "Feedback storage not configured yet".
- 429 from `POST /home/chat` → toast "Rate limited — slow down".
- `markdown_available: false` on a digest → warning line inside the
  digest modal.

## 11. Out of scope

- No login / multi-user.
- No admin UI for creating or editing schedules.
- No graph visualization beyond a list.
- No real email / calendar integration.
- No mobile layout polish.
- No agent-run detail page — feed `run` items show only their snippet.

## 12. Verification checklist

1. `/home/overview` paints without errors when tables are missing.
2. Run digest → toast → digest appears in feed within 2 min.
3. Produce insight → toast → insight appears within ~60s.
4. Answer a pending question → SSE ack appears in chat → question clears
   from pending list.
5. Dismiss → question disappears immediately.
6. Retract an answered question → reappears as pending.
7. Chat message → SSE streams chunks → final assistant message visible in
   `GET /home/conversation/export`.
8. "Brief me" → SSE streams into chat.
9. Health banner disappears once all tables are provisioned.
10. `/` lands on `/home`; `/hub` redirects to `/home`; no route imports
    `src/features/hub/*`.
