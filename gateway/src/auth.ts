import { betterAuth, type BetterAuthOptions } from 'better-auth';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from './env.js';
import { countActive, createRow, listWhere } from './nocodb.js';

// Resolve file:... DATABASE_URL to a path and ensure its directory exists.
const dbPath = env.DATABASE_URL.replace(/^file:/, '');
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

type OrgRow = { Id: number; name: string; slug: string };
type UserRow = { Id: number; org_id: number; email: string };

/**
 * Used by the Better-Auth user.create.after hook for signups that happen AFTER
 * first-run setup (i.e. additional users invited into the existing org).
 * First-run setup is driven explicitly by POST /api/setup which passes
 * `skipOrgHook=true` in the user metadata so this does not double-create.
 */
async function attachToExistingOrg(email: string, displayName?: string): Promise<number> {
  const orgs = await listWhere<OrgRow>('organisations', '', 1);
  if (orgs.length === 0) {
    throw new Error('No organisation exists — run /api/setup first');
  }
  const orgId = orgs[0].Id;
  const existing = await listWhere<UserRow>('users', `(email,eq,${email})`, 1);
  if (existing.length === 0) {
    await createRow<UserRow>('users', {
      org_id: orgId,
      email,
      display_name: displayName ?? email,
      role: 'member',
      last_active_at: new Date().toISOString(),
    });
  }
  return orgId;
}

export const authOptions: BetterAuthOptions = {
  database: sqlite,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 8,
  },
  trustedOrigins: [env.FRONTEND_ORIGIN],
  // Cross-origin (frontend:3000 ↔ gateway:3900). Browsers allow sameSite=none
  // on localhost HTTP as an exemption to the secure requirement.
  advanced: {
    defaultCookieAttributes: {
      sameSite: env.ENVIRONMENT === 'production' ? 'none' : 'lax',
      secure: env.ENVIRONMENT === 'production',
      httpOnly: true,
    },
  },
  user: {
    additionalFields: {
      orgId: { type: 'number', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // First-run setup path uses auth.api.signUpEmail with a marker we can check via
          // an existing org count: if zero orgs exist, allow signup (setup route pre-created it).
          if (!env.ALLOW_REGISTRATION) {
            const count = await countActive('organisations');
            if (count > 0) {
              throw new Error('registration_disabled');
            }
          }
          return { data: user };
        },
        after: async (user) => {
          try {
            // If an org already exists, link to it. If we're in first-run setup, the setup
            // route has already created the org + users row, so this attach is idempotent.
            const orgId = await attachToExistingOrg(user.email, (user as any).name);
            sqlite.prepare('UPDATE user SET "orgId" = ? WHERE id = ?').run(orgId, user.id);
          } catch (err) {
            console.error('[auth] attachToExistingOrg failed', err);
            throw err;
          }
        },
      },
    },
  },
};

export const auth = betterAuth(authOptions);

export async function getOrgIdForUser(userId: string): Promise<number | null> {
  const row = sqlite.prepare('SELECT "orgId" as orgId FROM user WHERE id = ?').get(userId) as
    | { orgId: number | null }
    | undefined;
  return row?.orgId ?? null;
}