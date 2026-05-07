const BASE = '/api';

export type Memory = {
  id: string;
  userId: string;
  namespaceId: string;
  type: 'EPISODIC' | 'SEMANTIC' | 'PROCEDURAL';
  content: string;
  status: 'PENDING_EMBEDDING' | 'READY' | 'FAILED';
  metadata: Record<string, unknown>;
  source: { client: string; sessionId: string; timestamp: string };
  createdAt: string;
  updatedAt: string;
  accessCount: number;
  lastAccessedAt: string | null;
  deletedAt: string | null;
  tags: Array<{ memoryId: string; tag: string; createdAt: string }>;
};

export type MemoryWithScore = Memory & { score: number };

export type Namespace = {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  isEphemeral?: boolean;
  expiresAt?: string | null;
};

export type MemoryPack = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  memoryCount: number;
  tags: string[];
};

export type GraphNode = {
  id: string;
  content: string;
  type: 'EPISODIC' | 'SEMANTIC' | 'PROCEDURAL';
  status: string;
  tags: string[];
};

export type GraphEdge = {
  source: string;
  target: string;
  relationType: string;
  weight: number;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    return undefined as unknown as T;
  }
  if (!res.ok) throw new Error(`API ${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  listMemories(params?: { limit?: number; namespaceId?: string; cursor?: string }): Promise<Memory[]> {
    const q = new URLSearchParams();
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.namespaceId) q.set('namespaceId', params.namespaceId);
    if (params?.cursor) q.set('cursor', params.cursor);
    return request<Memory[]>(`/memories?${q}`);
  },

  recall(query: string, opts?: { limit?: number; namespaceId?: string; minScore?: number }): Promise<MemoryWithScore[]> {
    return request<MemoryWithScore[]>('/memories/recall', {
      method: 'POST',
      body: JSON.stringify({ query, limit: opts?.limit ?? 10, minScore: opts?.minScore ?? 0.5, ...opts }),
    });
  },

  getMemory(id: string): Promise<Memory | null> {
    return request<Memory | null>(`/memories/${id}`).catch(() => null);
  },

  forgetMemory(id: string): Promise<void> {
    return request<void>(`/memories/${id}`, { method: 'DELETE' });
  },

  listNamespaces(parentId?: string): Promise<Namespace[]> {
    const q = new URLSearchParams();
    if (parentId) q.set('parentId', parentId);
    return request<Namespace[]>(`/memories/namespaces?${q}`);
  },

  getGraph(opts?: { namespaceId?: string; limit?: number }): Promise<GraphData> {
    const q = new URLSearchParams();
    if (opts?.namespaceId) q.set('namespaceId', opts.namespaceId);
    if (opts?.limit !== undefined) q.set('limit', String(opts.limit));
    return request<GraphData>(`/memories/graph?${q}`);
  },

  listPacks(): Promise<MemoryPack[]> {
    return request<MemoryPack[]>('/memories/packs');
  },

  importPack(packId: string, namespaceId: string): Promise<{ imported: number }> {
    return request<{ imported: number }>('/memories/packs/import', {
      method: 'POST',
      body: JSON.stringify({ packId, namespaceId }),
    });
  },

  createEphemeralNamespace(name: string, ttl: '1h' | '24h' | '7d'): Promise<Namespace> {
    return request<Namespace>('/memories/namespaces/ephemeral', {
      method: 'POST',
      body: JSON.stringify({ name, ttl }),
    });
  },
};
