import { z } from 'zod';

export const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contextual_grounding_enabled: z.boolean().optional(),
  deleted_at: z.string().datetime().optional(),
  system_note: z.string().max(2000).nullable().optional(),
  default_response_style: z.string().max(80).nullable().optional(),
  polish_pass_default: z.boolean().optional(),
  strict_grounding_default: z.boolean().optional(),
  ask_back_default: z.boolean().optional(),
  memory_extract_every_n_turns: z.number().int().min(0).max(50).optional(),
  memory_token_budget: z.number().int().min(0).max(8000).optional(),
  saved_fragments_json: z
    .array(z.object({ label: z.string().min(1).max(80), text: z.string().min(1).max(4000) }))
    .max(50)
    .optional(),
  rag_enabled: z.boolean().optional(),
  rag_collection: z.string().nullable().optional(),
  knowledge_enabled: z.boolean().optional(),
  model: z.string().min(1).max(120).optional(),
});
