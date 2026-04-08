/**
 * Tables the GATEWAY queries directly. The gateway only owns the auth and
 * tenancy bootstrap — everything else (agents, conversations, messages,
 * tasks, observations, etc.) is the harness's responsibility and must not
 * be touched from here. This list is also used by the soft-delete helper
 * to auto-append (deleted_at,is,null) filters.
 */
export const SOFT_DELETE_TABLES: ReadonlySet<string> = new Set([
  'organisation',
  'users',
]);
