import OpenAI from 'openai';
import type { EmbeddingProvider } from '../embedding-provider.interface';

/**
 * OpenAI text-embedding-3-small provider.
 * Produces 1536-dimensional vectors; best compared with cosine similarity.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 1536;

  private static readonly MODEL = 'text-embedding-3-small';
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  /**
   * @example
   * const vec = await provider.embed("I prefer TypeScript over Python");
   */
  async embed(text: string): Promise<number[]> {
    const res = await this.client.embeddings.create({
      model: OpenAIEmbeddingProvider.MODEL,
      input: text,
    });
    const first = res.data[0];
    if (!first) throw new Error('OpenAI returned no embedding data');
    return first.embedding;
  }

  /**
   * @example
   * const vecs = await provider.embedBatch(["text1", "text2"]);
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await this.client.embeddings.create({
      model: OpenAIEmbeddingProvider.MODEL,
      input: texts,
    });
    return res.data.map(d => d.embedding);
  }
}
