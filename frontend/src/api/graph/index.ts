// Graph Explorer API client.
// All endpoints accept ?org_id; we default to defaultOrgId().
import { http } from '../../lib/http';
import { defaultOrgId } from '../home/config';

export interface GraphSearchHit {
  id: string;
  label: string;
  type: string;
  degree: number;
}
export interface GraphNode {
  id: string;
  label: string;
  type: string;
  aliases?: string[];
  degree?: number;
}
export interface GraphEdge {
  src: string;
  dst: string;
  type: string;
  weight: number;
}
export interface GraphNeighbourhood {
  nodes: GraphNode[];
  edges: GraphEdge[];
  center: string;
}
export interface GraphEvidence {
  edge: GraphEdge;
  chunks: Array<{ id: string; text: string; url?: string; source?: string; score?: number }>;
}
export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
export interface GraphResolutionPair {
  id: string;
  a: GraphNode;
  b: GraphNode;
  score: number;
  reason?: string;
}
export interface GraphStats {
  nodes_total: number;
  edges_total: number;
  by_type: Array<{ type: string; count: number }>;
  by_edge_type: Array<{ type: string; count: number }>;
}
export interface GraphMaintenanceEvent {
  ts: string;
  kind: string;
  detail?: string;
}

const sp = (extra: Record<string, string | number | undefined> = {}) => {
  const params: Record<string, string | number> = { org_id: defaultOrgId() };
  for (const [k, v] of Object.entries(extra)) if (v != null) params[k] = v;
  return params;
};

export const graphApi = {
  search: (q: string, limit = 25) =>
    http.get('api/graph/search', { searchParams: sp({ q, limit }) }).json<{ hits: GraphSearchHit[] }>(),
  neighbourhood: (id: string, hops = 2) =>
    http
      .get(`api/graph/neighbourhood/${encodeURIComponent(id)}`, { searchParams: sp({ hops }) })
      .json<GraphNeighbourhood>(),
  node: (id: string) =>
    http.get(`api/graph/node/${encodeURIComponent(id)}`, { searchParams: sp() }).json<GraphNode>(),
  edgeEvidence: (src: string, dst: string) =>
    http
      .get(`api/graph/edge/${encodeURIComponent(src)}/${encodeURIComponent(dst)}/evidence`, {
        searchParams: sp(),
      })
      .json<GraphEvidence>(),
  path: (src: string, dst: string) =>
    http.get('api/graph/path', { searchParams: sp({ src, dst }) }).json<GraphPath>(),
  resolutionCandidates: (limit = 50) =>
    http
      .get('api/graph/resolution/candidates', { searchParams: sp({ limit }) })
      .json<{ pairs: GraphResolutionPair[] }>(),
  resolutionDecide: (id: string, decision: 'merge' | 'skip' | 'never') =>
    http
      .post('api/graph/resolution/decide', { json: { org_id: defaultOrgId(), id, decision } })
      .json<{ ok: boolean }>(),
  stats: () => http.get('api/graph/stats', { searchParams: sp() }).json<GraphStats>(),
  maintenanceEvents: (limit = 100) =>
    http
      .get('api/graph/maintenance/events', { searchParams: sp({ limit }) })
      .json<{ events: GraphMaintenanceEvent[] }>(),
};
