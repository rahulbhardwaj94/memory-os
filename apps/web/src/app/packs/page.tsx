'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { api, type MemoryPack, type Namespace } from '@/lib/api';

export default function PacksPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [packs, setPacks] = useState<MemoryPack[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [selectedNs, setSelectedNs] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<
    Record<string, { count: number; ts: number }>
  >({});

  useEffect(() => {
    if (!isPending && !session) router.push('/login');
  }, [session, isPending, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ps, ns] = await Promise.all([api.listPacks(), api.listNamespaces()]);
      setPacks(ps);
      setNamespaces(ns);
      // Default each pack to the first namespace
      if (ns.length > 0) {
        const defaults: Record<string, string> = {};
        ps.forEach((p) => {
          defaults[p.id] = ns[0]!.id;
        });
        setSelectedNs(defaults);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const handleImport = async (packId: string) => {
    const namespaceId = selectedNs[packId];
    if (!namespaceId) return;
    setImporting(packId);
    try {
      const result = await api.importPack(packId, namespaceId);
      setImportResult((prev) => ({
        ...prev,
        [packId]: { count: result.imported, ts: Date.now() },
      }));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(null);
    }
  };

  if (isPending || !session) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Memory Packs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import curated knowledge into your vault instantly.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-gray-900 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => {
            const result = importResult[pack.id];
            const justImported = result !== undefined && Date.now() - result.ts < 5000;
            const isImporting = importing === pack.id;

            return (
              <div
                key={pack.id}
                className="flex flex-col rounded-xl border border-gray-800 bg-gray-900 p-5 gap-4"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-gray-100 leading-snug">{pack.name}</h3>
                    <span className="shrink-0 text-xs text-gray-600">v{pack.version}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{pack.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pack.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">
                    {pack.memoryCount} memories · by {pack.author}
                  </p>
                </div>

                <div className="space-y-2">
                  {namespaces.length > 0 ? (
                    <select
                      value={selectedNs[pack.id] ?? ''}
                      onChange={(e) =>
                        setSelectedNs((prev) => ({ ...prev, [pack.id]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-gray-500"
                    >
                      {namespaces.map((ns) => (
                        <option key={ns.id} value={ns.id}>
                          {ns.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-gray-600">
                      Create a namespace first to import packs.
                    </p>
                  )}

                  <button
                    onClick={() => void handleImport(pack.id)}
                    disabled={isImporting || namespaces.length === 0}
                    className="w-full rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-950 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isImporting
                      ? 'Importing…'
                      : justImported
                        ? `Imported ${result!.count} memories`
                        : 'Import Pack'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
