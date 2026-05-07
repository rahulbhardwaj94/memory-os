import type { EmbeddingProvider } from '../embedding-provider.interface';

type VoyageResponse = { data: Array<{ embedding: number[] }> };

export class VoyageEmbeddingProvider implements EmbeddingProvider {
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
    if (!result) throw new Error('Voyage returned no embedding');
    return result;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts, input_type: 'document' }),
    });
    if (!res.ok) throw new Error(`Voyage embed failed (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as VoyageResponse;
    return json.data.map(d => d.embedding);
  }
}
