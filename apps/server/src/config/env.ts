import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  EMBEDDING_PROVIDER: z.enum(['openai', 'ollama', 'voyage', 'cohere', 'gemini']).default('openai'),
  // OpenAI — required when EMBEDDING_PROVIDER=openai
  OPENAI_API_KEY: z.string().default(''),
  // Ollama — used when EMBEDDING_PROVIDER=ollama
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('nomic-embed-text'),
  OLLAMA_DIMENSIONS: z.coerce.number().int().positive().default(768),
  // Voyage AI — required when EMBEDDING_PROVIDER=voyage
  VOYAGE_API_KEY: z.string().default(''),
  VOYAGE_MODEL: z.string().default('voyage-3-lite'),
  VOYAGE_DIMENSIONS: z.coerce.number().int().positive().default(512),
  // Cohere — required when EMBEDDING_PROVIDER=cohere
  COHERE_API_KEY: z.string().default(''),
  COHERE_MODEL: z.string().default('embed-english-v3.0'),
  COHERE_DIMENSIONS: z.coerce.number().int().positive().default(1024),
  // Gemini — required when EMBEDDING_PROVIDER=gemini
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_DIMENSIONS: z.coerce.number().int().positive().default(768),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DEFAULT_USER_EMAIL: z.string().email().default('default@memory-os.local'),
  MCP_CLIENT_NAME: z.string().default('mcp'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  // Rate limiting — applies to the REST API only (not the MCP stdio server)
  RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  // CORS — comma-separated list of allowed origins in production
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  // Better Auth — required for the HTTP server; not used by the MCP stdio server
  BETTER_AUTH_SECRET: z.string().min(32).default('change-me-to-a-random-32-char-secret!!'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  // MCP_API_KEY — optional. When set, the MCP server authenticates as the owner
  // of this key instead of DEFAULT_USER_EMAIL. Generate in the Web UI → Settings → API Keys.
  MCP_API_KEY: z.string().optional(),
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
