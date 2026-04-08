import { createAuthClient } from 'better-auth/react';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3900';

export const authClient = createAuthClient({
  baseURL: GATEWAY_URL,
  fetchOptions: { credentials: 'include' },
});

export const { signIn, signOut, useSession } = authClient;
