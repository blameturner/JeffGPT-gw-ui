import { Hono } from 'hono';
import { env } from '../env.js';

export const healthRoute = new Hono();

healthRoute.get('/', async (c) => {
  let harness: 'ok' | 'error' = 'error';
  try {
    const res = await fetch(`${env.HARNESS_URL}/health`);
    if (res.ok) harness = 'ok';
  } catch {}
  return c.json({ status: 'ok', harness });
});
