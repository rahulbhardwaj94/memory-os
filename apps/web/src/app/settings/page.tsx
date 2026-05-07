'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

type ApiKey = {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: string;
  expiresAt: string | null;
  enabled: boolean;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export default function SettingsPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      const data = await apiRequest<ApiKey[]>('/auth/api-keys');
      setKeys(data);
    } catch {
      // no-op on load failure
    }
  }, []);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
      return;
    }
    if (session) void loadKeys();
  }, [session, isPending, router, loadKeys]);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setLoading(true);
    setError(null);
    setCreatedKey(null);
    try {
      const result = await apiRequest<{ key: string; id: string }>('/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      setCreatedKey(result.key);
      setNewKeyName('');
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (id: string) => {
    try {
      await apiRequest<void>(`/auth/api-keys/${id}`, { method: 'DELETE' });
      setKeys(prev => prev.filter(k => k.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    }
  };

  if (isPending || !session) return null;

  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Signed in as {session.user.email}</p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-medium">API Keys</h2>
          <p className="text-sm text-gray-400 mt-1">
            Use an API key to authenticate MCP clients (Claude Desktop, Cursor, Cline).
            Set{' '}
            <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">MCP_API_KEY</code>{' '}
            in your Claude Desktop env config with the generated key.
          </p>
        </div>

        {createdKey && (
          <div className="rounded-lg border border-green-900 bg-green-950/30 p-4 space-y-2">
            <p className="text-sm font-medium text-green-300">
              Key created — copy it now, it won&apos;t be shown again.
            </p>
            <code className="block text-xs bg-gray-900 px-3 py-2 rounded text-green-400 break-all select-all">
              {createdKey}
            </code>
            <button
              onClick={() => void navigator.clipboard.writeText(createdKey)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Copy to clipboard
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void createKey(e)} className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="e.g. Claude Desktop"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-gray-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !newKeyName.trim()}
            className="px-5 py-2.5 rounded-lg bg-white text-gray-950 text-sm font-medium hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating…' : 'Create key'}
          </button>
        </form>

        {keys.length > 0 ? (
          <div className="space-y-2">
            {keys.map(key => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{key.name ?? 'Unnamed key'}</p>
                  <p className="text-xs text-gray-500">
                    {key.start ? `${key.start}…` : ''} · Created{' '}
                    {new Date(key.createdAt).toLocaleDateString()}
                    {!key.enabled && <span className="ml-2 text-red-400">disabled</span>}
                  </p>
                </div>
                <button
                  onClick={() => void revokeKey(key.id)}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No API keys yet.</p>
        )}
      </section>
    </div>
  );
}
