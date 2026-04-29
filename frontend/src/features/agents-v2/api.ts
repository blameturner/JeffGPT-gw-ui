// HTTP clients for the new agents experience. All endpoints live under the
// gateway's /api/* proxy that maps to the backend's root paths
// (agents_admin.py).
import { http } from '../../lib/http';
import type {
  Agent,
  AgentApproval,
  AgentIncident,
  AgentListRow,
  AgentRunDetail,
  AgentRunSummary,
  AgentTemplate,
  ArtifactVersion,
  Assignment,
  NocoTable,
  RunNowBody,
  TestPromptResult,
  ToolCatalogEntry,
} from './types';

// -------- Agents --------

export function listAgentsRich(params?: { q?: string; type?: string; status?: string; tag?: string }) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.type) sp.set('type', params.type);
  if (params?.status) sp.set('status', params.status);
  if (params?.tag) sp.set('tag', params.tag);
  // Opt into rich rows so the sidebar can render without per-row roundtrips.
  sp.set('include', 'full');
  const qs = sp.toString();
  return http.get(`api/agents${qs ? `?${qs}` : ''}`).json<{ agents: AgentListRow[] }>();
}

export function getAgentFull(id: number) {
  return http.get(`api/agents/${id}`).json<Agent>();
}

export function createAgent(body: Partial<Agent>) {
  return http.post('api/agents', { json: body }).json<Agent>();
}

export function patchAgent(id: number, body: Partial<Agent>) {
  return http.patch(`api/agents/${id}`, { json: body }).json<Agent>();
}

export function deleteAgent(id: number) {
  return http.delete(`api/agents/${id}`).json<{ ok: true }>();
}

export function runAgentNow(id: number, body: RunNowBody) {
  return http.post(`api/agents/${id}/run`, { json: body }).json<{ assignment_id: number }>();
}

export function pauseAgent(id: number, until?: string) {
  return http.post(`api/agents/${id}/pause`, { json: { until } }).json<Agent>();
}

export function resumeAgent(id: number) {
  return http.post(`api/agents/${id}/resume`).json<Agent>();
}

export function resetCircuit(id: number) {
  return http.post(`api/agents/${id}/reset-circuit`).json<Agent>();
}

export function resetCounters(id: number) {
  return http.post(`api/agents/${id}/reset-counters`).json<Agent>();
}

export function cloneAgent(id: number, body: { name: string; overrides?: Partial<Agent> }) {
  return http.post(`api/agents/${id}/clone`, { json: body }).json<Agent>();
}

export function testPrompt(id: number, body: { task: string }) {
  return http.post(`api/agents/${id}/test-prompt`, { json: body, timeout: 120_000 }).json<TestPromptResult>();
}

// -------- Per-agent sub-resources --------

export function listAgentRuns(id: number, params?: { cursor?: string; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.cursor) sp.set('cursor', params.cursor);
  if (params?.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return http
    .get(`api/agents/${id}/runs${qs ? `?${qs}` : ''}`)
    .json<{ runs: AgentRunSummary[]; next_cursor?: string | null }>();
}

export function getAgentRun(id: number, runId: number) {
  return http.get(`api/agents/${id}/runs/${runId}`).json<AgentRunDetail>();
}

export function listAgentAssignments(id: number, params?: { status?: string; cursor?: string; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.cursor) sp.set('cursor', params.cursor);
  if (params?.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return http
    .get(`api/agents/${id}/assignments${qs ? `?${qs}` : ''}`)
    .json<{ assignments: Assignment[]; next_cursor?: string | null }>();
}

export function listAgentArtifactVersions(id: number, params?: { cursor?: string; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.cursor) sp.set('cursor', params.cursor);
  if (params?.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return http
    .get(`api/agents/${id}/artifacts/versions${qs ? `?${qs}` : ''}`)
    .json<{ versions: ArtifactVersion[]; next_cursor?: string | null }>();
}

// -------- Universal inbox --------

export function listAssignments(params?: {
  q?: string;
  agent_id?: number | string;
  status?: string;
  source?: string;
  start?: string;
  end?: string;
  cursor?: string;
  limit?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.agent_id != null) sp.set('agent_id', String(params.agent_id));
  if (params?.status) sp.set('status', params.status);
  if (params?.source) sp.set('source', params.source);
  if (params?.start) sp.set('start', params.start);
  if (params?.end) sp.set('end', params.end);
  if (params?.cursor) sp.set('cursor', params.cursor);
  if (params?.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return http
    .get(`api/assignments${qs ? `?${qs}` : ''}`)
    .json<{ assignments: Assignment[]; next_cursor?: string | null }>();
}

export function createAssignment(body: { agent_id: number; task: string; priority?: number; dedup_key?: string }) {
  return http.post('api/assignments', { json: body }).json<Assignment>();
}

export function getAssignment(id: number) {
  return http.get(`api/assignments/${id}`).json<Assignment>();
}

export function patchAssignment(id: number, body: Partial<Assignment>) {
  return http.patch(`api/assignments/${id}`, { json: body }).json<Assignment>();
}

export function cancelAssignment(id: number) {
  return http.post(`api/assignments/${id}/cancel`).json<Assignment>();
}

export function retryAssignment(id: number) {
  return http.post(`api/assignments/${id}/retry`).json<Assignment>();
}

// -------- Approvals --------

export function listApprovals(params?: { agent_id?: number }) {
  const sp = new URLSearchParams();
  if (params?.agent_id != null) sp.set('agent_id', String(params.agent_id));
  const qs = sp.toString();
  return http.get(`api/approvals${qs ? `?${qs}` : ''}`).json<{ approvals: AgentApproval[] }>();
}

export function approveApproval(id: number, note?: string) {
  return http.post(`api/approvals/${id}/approve`, { json: { note } }).json<AgentApproval>();
}

export function rejectApproval(id: number, note?: string) {
  return http.post(`api/approvals/${id}/reject`, { json: { note } }).json<AgentApproval>();
}

// -------- Incidents --------

export function listIncidents(params?: { agent_id?: number; resolved?: boolean }) {
  const sp = new URLSearchParams();
  if (params?.agent_id != null) sp.set('agent_id', String(params.agent_id));
  if (params?.resolved != null) sp.set('resolved', String(params.resolved));
  const qs = sp.toString();
  return http.get(`api/incidents${qs ? `?${qs}` : ''}`).json<{ incidents: AgentIncident[] }>();
}

export function resolveIncident(id: number, note: string) {
  return http.post(`api/incidents/${id}/resolve`, { json: { note } }).json<AgentIncident>();
}

// -------- Templates --------

export function listTemplates() {
  return http.get('api/templates').json<{ templates: AgentTemplate[] }>();
}

export function instantiateTemplate(id: number, body: { name: string; overrides?: Partial<Agent> }) {
  return http.post(`api/templates/${id}/instantiate`, { json: body }).json<Agent>();
}

// -------- Artifact versions --------

export function getArtifactVersion(id: number) {
  return http.get(`api/artifact-versions/${id}`).json<ArtifactVersion>();
}

export function rollbackArtifactVersion(id: number) {
  return http.post(`api/artifact-versions/${id}/rollback`).json<ArtifactVersion>();
}

// -------- Catalog / metadata helpers --------

// These are best-effort; the backend may not implement them yet. The UI should
// fall back to free-text inputs if the request fails.
export async function fetchToolCatalog(): Promise<ToolCatalogEntry[]> {
  try {
    const res = await http.get('api/tools/catalog').json<{ tools: ToolCatalogEntry[] }>();
    return res.tools;
  } catch {
    return [];
  }
}

export async function fetchNocoTables(): Promise<NocoTable[]> {
  try {
    const res = await http.get('api/nocodb/tables').json<{ tables: NocoTable[] }>();
    return res.tables;
  } catch {
    return [];
  }
}

export async function fetchModelList(): Promise<string[]> {
  try {
    const res = await http.get('api/models').json<{ models: Array<{ id: string; name?: string }> }>();
    return res.models.map((m) => m.id);
  } catch {
    return [];
  }
}
