'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { api, type Memory, type Namespace } from '@/lib/api';
import { MemoryCard } from '@/components/MemoryCard';

export default function VaultPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [selectedNs, setSelectedNs] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scratchpadForm, setScratchpadForm] = useState(false);
  const [scratchpadName, setScratchpadName] = useState('');
  const [scratchpadTtl, setScratchpadTtl] = useState<'1h' | '24h' | '7d'>('24h');
  const [creatingScratchpad, setCreatingScratchpad] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.push('/login');
  }, [session, isPending, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mems, ns] = await Promise.all([
        api.listMemories({ limit: 50, namespaceId: selectedNs }),
        api.listNamespaces(),
      ]);
      setMemories(mems);
      setNamespaces(ns);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [selectedNs]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const handleForget = async (id: string) => {
    await api.forgetMemory(id);
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleCreateScratchpad = async () => {
    const name = scratchpadName.trim();
    if (!name) return;
    setCreatingScratchpad(true);
    try {
      const ns = await api.createEphemeralNamespace(name, scratchpadTtl);
      setNamespaces(prev => [...prev, ns]);
      setSelectedNs(ns.id);
      setScratchpadForm(false);
      setScratchpadName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create scratchpad');
    } finally {
      setCreatingScratchpad(false);
    }
  };

  if (isPending || !session) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Memory Vault</h1>
        <span className="text-sm text-gray-500">{memories.length} memories</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedNs(undefined)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            !selectedNs ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          all
        </button>
        {namespaces.map(ns => (
          <button
            key={ns.id}
            onClick={() => setSelectedNs(ns.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedNs === ns.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {ns.isEphemeral && (
              <span
                className="text-yellow-500"
                title={`Expires ${ns.expiresAt ? new Date(ns.expiresAt).toLocaleString() : 'soon'}`}
              >
                ⏱
              </span>
            )}
            {ns.name}
          </button>
        ))}
        {scratchpadForm ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={scratchpadName}
              onChange={e => setScratchpadName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleCreateScratchpad(); if (e.key === 'Escape') setScratchpadForm(false); }}
              placeholder="scratchpad name"
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1 text-xs text-gray-100 placeholder-gray-600 outline-none focus:border-gray-500 w-36"
            />
            <select
              value={scratchpadTtl}
              onChange={e => setScratchpadTtl(e.target.value as '1h' | '24h' | '7d')}
              className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300 outline-none"
            >
              <option value="1h">1h</option>
              <option value="24h">24h</option>
              <option value="7d">7d</option>
            </select>
            <button
              onClick={() => void handleCreateScratchpad()}
              disabled={creatingScratchpad || !scratchpadName.trim()}
              className="px-3 py-1 rounded-lg bg-white text-gray-950 text-xs font-medium hover:bg-gray-100 disabled:opacity-40"
            >
              {creatingScratchpad ? '…' : 'Create'}
            </button>
            <button onClick={() => setScratchpadForm(false)} className="text-gray-600 hover:text-gray-400 text-xs">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setScratchpadForm(true)}
            className="px-3 py-1 rounded-full text-xs text-gray-600 border border-dashed border-gray-700 hover:border-gray-500 hover:text-gray-400 transition-colors"
          >
            + scratchpad
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-900 animate-pulse" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <p className="text-gray-500 text-sm">No memories yet. Start using the MCP tools to store some.</p>
      ) : (
        <div className="grid gap-3">
          {memories.map(m => (
            <MemoryCard key={m.id} memory={m} onForget={handleForget} />
          ))}
        </div>
      )}
    </div>
  );
}
