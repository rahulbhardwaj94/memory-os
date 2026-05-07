'use client';

import type { Memory } from '@/lib/api';

const TYPE_COLOR = {
  EPISODIC: 'bg-blue-900/40 text-blue-300',
  SEMANTIC: 'bg-purple-900/40 text-purple-300',
  PROCEDURAL: 'bg-green-900/40 text-green-300',
} as const;

const STATUS_DOT = {
  READY: 'bg-green-400',
  PENDING_EMBEDDING: 'bg-yellow-400',
  FAILED: 'bg-red-400',
} as const;

type Props = {
  memory: Memory & { score?: number };
  onForget?: (id: string) => void;
};

export function MemoryCard({ memory, onForget }: Props) {
  const date = new Date(memory.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-100 leading-relaxed line-clamp-3">{memory.content}</p>
        {onForget && (
          <button
            onClick={() => onForget(memory.id)}
            className="shrink-0 text-xs text-gray-600 hover:text-red-400 transition-colors"
            title="Forget this memory"
          >
            forget
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[memory.type]}`}>
          {memory.type.toLowerCase()}
        </span>
        <span className="flex items-center gap-1 text-gray-500">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT[memory.status]}`} />
          {memory.status === 'PENDING_EMBEDDING' ? 'indexing' : memory.status.toLowerCase()}
        </span>
        {memory.score !== undefined && (
          <span className="text-gray-500">score {memory.score.toFixed(3)}</span>
        )}
        {memory.tags.map(t => (
          <span key={t.tag} className="text-gray-500">#{t.tag}</span>
        ))}
        <span className="ml-auto text-gray-600">{date}</span>
      </div>
    </div>
  );
}
