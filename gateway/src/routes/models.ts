import { Hono } from 'hono';
import { env } from '../env.js';

export const modelsRoute = new Hono();

modelsRoute.get('/', async (c) => {
  try {
    const res = await fetch(`${env.HARNESS_URL}/models`);
    if (!res.ok) return c.json({ error: 'harness_error', status: res.status }, 502);
    const body = await res.json();
    return c.json(body);
  } catch (err) {
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
