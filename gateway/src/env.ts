import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3900),
  HARNESS_URL: z.string().url().default('http://mst-ag-harness:3800'),
  NOCODB_URL: z.string().url(),
  NOCODB_TOKEN: z.string().min(1),
  NOCODB_BASE_ID: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3900'),
  DATABASE_URL: z.string().default('file:./data/auth.db'),
  ALLOW_REGISTRATION: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  ENVIRONMENT: z.enum(['development', 'production']).default('production'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
