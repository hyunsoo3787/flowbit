import { z } from 'zod';

export const healthCheckStatusSchema = z.enum(['up', 'down', 'disabled']);

export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({
    database: healthCheckStatusSchema,
    valkey: healthCheckStatusSchema,
  }),
});
export type Health = z.infer<typeof healthSchema>;
