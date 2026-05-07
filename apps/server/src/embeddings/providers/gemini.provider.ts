import type { EmbeddingProvider } from '../embedding-provider.interface';

type GeminiEmbedResponse = { embedding: { values: number[] } };
type GeminiBatchResponse = { embeddings: Array<{ values: number[] }> };

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, dimensions: number, model = 'text-embedding-004') {
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = dimensions;
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}`;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}:embedContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text }] } }),
    });
    if (!res.ok) throw new Error(`Gemini embed failed (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as GeminiEmbedResponse;
    return json.embedding.values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch(`${this.baseUrl}:batchEmbedContents?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map(text => ({
          model: `models/${this.model}`,
          content: { parts: [{ text }] },
        })),
      }),
    });
    if (!res.ok) throw new Error(`Gemini batch embed failed (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as GeminiBatchResponse;
    return json.embeddings.map(e => e.values);
  }
}
