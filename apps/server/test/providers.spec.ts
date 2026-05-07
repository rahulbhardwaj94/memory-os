import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaEmbeddingProvider } from '../src/embeddings/providers/ollama.provider';
import { VoyageEmbeddingProvider } from '../src/embeddings/providers/voyage.provider';
import { CohereEmbeddingProvider } from '../src/embeddings/providers/cohere.provider';
import { GeminiEmbeddingProvider } from '../src/embeddings/providers/gemini.provider';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const vec = (n: number) => new Array(n).fill(0.01) as number[];

function mockFetch(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      text: async () => (ok ? '' : JSON.stringify(body)),
      json: async () => body,
    } as Response),
  );
}

// ─── Ollama ───────────────────────────────────────────────────────────────────

describe('OllamaEmbeddingProvider', () => {
  const provider = new OllamaEmbeddingProvider('http://localhost:11434', 'nomic-embed-text', 768);

  afterEach(() => vi.unstubAllGlobals());

  it('reports correct dimensions', () => {
    expect(provider.dimensions).toBe(768);
  });

  it('embed returns the vector from Ollama', async () => {
    mockFetch({ embedding: vec(768) });
    const result = await provider.embed('hello');
    expect(result).toHaveLength(768);
  });

  it('embedBatch issues one request per text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: vec(768) }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const results = await provider.embedBatch(['a', 'b', 'c']);
    expect(results).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws on non-ok response', async () => {
    mockFetch('Server error', false, 500);
    await expect(provider.embed('test')).rejects.toThrow('Ollama embed failed (500)');
  });

  it('throws when embedding field is missing', async () => {
    mockFetch({ something_else: [] });
    await expect(provider.embed('test')).rejects.toThrow('Ollama returned no embedding');
  });
});

// ─── Voyage ───────────────────────────────────────────────────────────────────

describe('VoyageEmbeddingProvider', () => {
  const provider = new VoyageEmbeddingProvider('pa-test', 'voyage-3-lite', 512);

  afterEach(() => vi.unstubAllGlobals());

  it('reports correct dimensions', () => {
    expect(provider.dimensions).toBe(512);
  });

  it('embed returns the vector', async () => {
    mockFetch({ data: [{ embedding: vec(512) }] });
    const result = await provider.embed('hello');
    expect(result).toHaveLength(512);
  });

  it('embedBatch sends all texts in a single request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: vec(512) }, { embedding: vec(512) }] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const results = await provider.embedBatch(['a', 'b']);
    expect(results).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('embedBatch returns empty array for empty input', async () => {
    expect(await provider.embedBatch([])).toEqual([]);
  });

  it('throws on API error', async () => {
    mockFetch('Unauthorized', false, 401);
    await expect(provider.embed('test')).rejects.toThrow('Voyage embed failed (401)');
  });
});

// ─── Cohere ───────────────────────────────────────────────────────────────────

describe('CohereEmbeddingProvider', () => {
  const provider = new CohereEmbeddingProvider('co-test', 'embed-english-v3.0', 1024);

  afterEach(() => vi.unstubAllGlobals());

  it('reports correct dimensions', () => {
    expect(provider.dimensions).toBe(1024);
  });

  it('embed returns the vector', async () => {
    mockFetch({ embeddings: { float: [vec(1024)] } });
    const result = await provider.embed('hello');
    expect(result).toHaveLength(1024);
  });

  it('embedBatch sends all texts in a single request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: { float: [vec(1024), vec(1024)] } }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const results = await provider.embedBatch(['a', 'b']);
    expect(results).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('embedBatch returns empty array for empty input', async () => {
    expect(await provider.embedBatch([])).toEqual([]);
  });

  it('throws on API error', async () => {
    mockFetch('Forbidden', false, 403);
    await expect(provider.embed('test')).rejects.toThrow('Cohere embed failed (403)');
  });
});

// ─── Gemini ───────────────────────────────────────────────────────────────────

describe('GeminiEmbeddingProvider', () => {
  const provider = new GeminiEmbeddingProvider('AIza-test', 768);

  afterEach(() => vi.unstubAllGlobals());

  it('reports correct dimensions', () => {
    expect(provider.dimensions).toBe(768);
  });

  it('embed calls the single-embed endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: { values: vec(768) } }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.embed('hello');
    expect(result).toHaveLength(768);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain('embedContent');
  });

  it('embedBatch calls the batch endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [{ values: vec(768) }, { values: vec(768) }] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const results = await provider.embedBatch(['a', 'b']);
    expect(results).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain('batchEmbedContents');
  });

  it('embedBatch returns empty array for empty input', async () => {
    expect(await provider.embedBatch([])).toEqual([]);
  });

  it('throws on API error', async () => {
    mockFetch('Bad Request', false, 400);
    await expect(provider.embed('test')).rejects.toThrow('Gemini embed failed (400)');
  });
});
