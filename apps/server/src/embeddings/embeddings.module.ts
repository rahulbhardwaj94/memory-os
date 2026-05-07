import { Module } from '@nestjs/common';
import { env } from '../config/env';
import { EMBEDDING_PROVIDER } from './embedding-provider.interface';
import { OpenAIEmbeddingProvider } from './providers/openai.provider';
import { OllamaEmbeddingProvider } from './providers/ollama.provider';
import { VoyageEmbeddingProvider } from './providers/voyage.provider';
import { CohereEmbeddingProvider } from './providers/cohere.provider';
import { GeminiEmbeddingProvider } from './providers/gemini.provider';

@Module({
  providers: [
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: () => {
        if (env.EMBEDDING_PROVIDER === 'openai') {
          if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai');
          return new OpenAIEmbeddingProvider(env.OPENAI_API_KEY);
        }
        if (env.EMBEDDING_PROVIDER === 'ollama') {
          return new OllamaEmbeddingProvider(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL, env.OLLAMA_DIMENSIONS);
        }
        if (env.EMBEDDING_PROVIDER === 'voyage') {
          if (!env.VOYAGE_API_KEY) throw new Error('VOYAGE_API_KEY is required when EMBEDDING_PROVIDER=voyage');
          return new VoyageEmbeddingProvider(env.VOYAGE_API_KEY, env.VOYAGE_MODEL, env.VOYAGE_DIMENSIONS);
        }
        if (env.EMBEDDING_PROVIDER === 'cohere') {
          if (!env.COHERE_API_KEY) throw new Error('COHERE_API_KEY is required when EMBEDDING_PROVIDER=cohere');
          return new CohereEmbeddingProvider(env.COHERE_API_KEY, env.COHERE_MODEL, env.COHERE_DIMENSIONS);
        }
        if (env.EMBEDDING_PROVIDER === 'gemini') {
          if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini');
          return new GeminiEmbeddingProvider(env.GEMINI_API_KEY, env.GEMINI_DIMENSIONS);
        }
        throw new Error(`Unknown embedding provider: ${String(env.EMBEDDING_PROVIDER)}`);
      },
    },
  ],
  exports: [EMBEDDING_PROVIDER],
})
export class EmbeddingsModule {}
