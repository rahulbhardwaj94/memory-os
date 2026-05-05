import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  EMBEDDING_PROVIDER: z.enum(['openai']).default('openai'),
  OPENAI_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DEFAULT_USER_EMAIL: z.string().email().default('default@memory-os.local'),
  MCP_CLIENT_NAME: z.string().default('mcp'),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    process.stderr.write(`[memory-os] Invalid environment variables: ${JSON.stringify(errors, null, 2)}\n`);
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
