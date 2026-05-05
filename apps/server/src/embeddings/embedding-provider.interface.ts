/**
 * Abstraction over embedding backends.
 * Swap implementations by changing the EMBEDDING_PROVIDER env var.
 */
export interface EmbeddingProvider {
  /** Embed a single string and return its vector representation. */
  embed(text: string): Promise<number[]>;

  /** Embed multiple strings in a single batch call. */
  embedBatch(texts: string[]): Promise<number[][]>;

  /** Dimensionality of vectors produced by this provider. */
  readonly dimensions: number;
}

/** DI injection token for the active EmbeddingProvider. */
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
