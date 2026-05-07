'use client';

import { useState, useRef } from 'react';
import { api, type MemoryWithScore } from '@/lib/api';
import { MemoryCard } from '@/components/MemoryCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemoryWithScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const hits = await api.recall(q, { limit: 10 });
      setResults(hits);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Semantic Search</h1>

      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void search()}
          placeholder="What do you want to recall?"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-gray-500 transition-colors"
        />
        <button
          onClick={() => void search()}
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 rounded-lg bg-white text-gray-950 text-sm font-medium hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {searched && !loading && (
        <p className="text-xs text-gray-500">
          {results.length === 0 ? 'No results. Try a different query or add more memories.' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
        </p>
      )}

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-900 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {results.map(m => (
            <MemoryCard key={m.id} memory={m} />
          ))}
        </div>
      )}
    </div>
  );
}
