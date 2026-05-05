import { Module } from '@nestjs/common';
import { env } from '../config/env';
import { EMBEDDING_PROVIDER } from './embedding-provider.interface';
import { OpenAIEmbeddingProvider } from './providers/openai.provider';

@Module({
  providers: [
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: () => {
        if (env.EMBEDDING_PROVIDER === 'openai') {
          return new OpenAIEmbeddingProvider(env.OPENAI_API_KEY);
        }
        throw new Error(`Unknown embedding provider: ${String(env.EMBEDDING_PROVIDER)}`);
      },
    },
  ],
  exports: [EMBEDDING_PROVIDER],
})
export class EmbeddingsModule {}
