import type { EmbeddingProvider } from '../embedding-provider.interface';

type OllamaEmbedResponse = { embedding: number[] };

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl: string, model: string, dimensions: number) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });
    if (!res.ok) {
      throw new Error(`Ollama embed failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as OllamaEmbedResponse;
    if (!Array.isArray(json.embedding)) {
      throw new Error('Ollama returned no embedding');
    }
    return json.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }
}
