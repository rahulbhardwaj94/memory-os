import type { EmbeddingProvider } from '../embedding-provider.interface';

type CohereResponse = { embeddings: { float: number[][] } };

export class CohereEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string, dimensions: number) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const [result] = await this.embedBatch([text]);
    if (!result) throw new Error('Cohere returned no embedding');
    return result;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch('https://api.cohere.ai/v2/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        texts,
        input_type: 'search_document',
        embedding_types: ['float'],
      }),
    });
    if (!res.ok) throw new Error(`Cohere embed failed (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as CohereResponse;
    return json.embeddings.float;
  }
}
