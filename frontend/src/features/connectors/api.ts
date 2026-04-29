// All HTTP clients for the Connectors feature. Co-located in one file so the
// surface is easy to grok; individual call-sites import the named functions.
import { http } from '../../lib/http';
import type {
  ApiConnection,
  HttpMethod,
  InspectResult,
  Secret,
  SecretKind,
  SmtpAccount,
  SmtpTestResult,
  TestCallResult,
} from './types';

// -------- APIs --------

export function listApis(params?: { q?: string; status?: string }) {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.status && params.status !== 'all') search.set('status', params.status);
  const qs = search.toString();
  return http.get(`api/connectors/apis${qs ? `?${qs}` : ''}`).json<{ apis: ApiConnection[] }>();
}

export function getApi(id: number) {
  return http.get(`api/connectors/apis/${id}`).json<ApiConnection>();
}

export function registerApi(body: Partial<ApiConnection>) {
  return http.post('api/connectors/apis', { json: body }).json<ApiConnection>();
}

export function patchApi(id: number, body: Partial<ApiConnection>) {
  return http.patch(`api/connectors/apis/${id}`, { json: body }).json<ApiConnection>();
}

export function deleteApi(id: number) {
  return http.delete(`api/connectors/apis/${id}`).json<{ ok: true }>();
}

export function inspectApi(id: number) {
  return http.post(`api/connectors/apis/${id}/inspect`, { timeout: 120_000 }).json<InspectResult>();
}

export function testCallApi(
  id: number,
  body: { method: HttpMethod; path: string; params?: Record<string, string>; headers?: Record<string, string>; body?: unknown },
) {
  return http
    .post(`api/connectors/apis/${id}/test-call`, { json: body, timeout: 120_000 })
    .json<TestCallResult>();
}

// -------- SMTP --------

export function listSmtp(params?: { q?: string; status?: string }) {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.status && params.status !== 'all') search.set('status', params.status);
  const qs = search.toString();
  return http.get(`api/connectors/smtp${qs ? `?${qs}` : ''}`).json<{ accounts: SmtpAccount[] }>();
}

export function getSmtp(id: number) {
  return http.get(`api/connectors/smtp/${id}`).json<SmtpAccount>();
}

export function registerSmtp(body: Partial<SmtpAccount>) {
  return http.post('api/connectors/smtp', { json: body }).json<SmtpAccount>();
}

export function patchSmtp(id: number, body: Partial<SmtpAccount>) {
  return http.patch(`api/connectors/smtp/${id}`, { json: body }).json<SmtpAccount>();
}

export function deleteSmtp(id: number) {
  return http.delete(`api/connectors/smtp/${id}`).json<{ ok: true }>();
}

export function testSmtp(id: number) {
  return http
    .post(`api/connectors/smtp/${id}/test`, { timeout: 120_000 })
    .json<SmtpTestResult>();
}

// -------- Secrets --------

export function listSecrets(params?: { q?: string }) {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  const qs = search.toString();
  return http.get(`api/connectors/secrets${qs ? `?${qs}` : ''}`).json<{ secrets: Secret[] }>();
}

export function getSecret(id: number) {
  return http.get(`api/connectors/secrets/${id}`).json<Secret>();
}

export function createSecret(body: { name: string; kind: SecretKind; value: string; description?: string; expires_at?: string | null }) {
  return http.post('api/connectors/secrets', { json: body }).json<Secret>();
}

export function patchSecret(id: number, body: Partial<Pick<Secret, 'description' | 'kind' | 'expires_at'>>) {
  return http.patch(`api/connectors/secrets/${id}`, { json: body }).json<Secret>();
}

export function deleteSecret(id: number) {
  return http.delete(`api/connectors/secrets/${id}`).json<{ ok: true }>();
}

export function rotateSecret(id: number, value: string) {
  return http.post(`api/connectors/secrets/${id}/rotate`, { json: { value } }).json<Secret>();
}

export function revealSecret(id: number) {
  // Server returns the cleartext briefly; client is responsible for re-masking.
  // Server should also write a reveal-event audit log.
  return http.post(`api/connectors/secrets/${id}/reveal`).json<{ value: string }>();
}
