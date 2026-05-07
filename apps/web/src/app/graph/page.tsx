'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { api, type GraphNode, type Namespace } from '@/lib/api';

// Re-export convenience alias used in this file only
type ForceNode = GraphNode & { x?: number; y?: number; [key: string]: unknown };
type ForceLink = { source: string | ForceNode; target: string | ForceNode; relationType: string; weight: number };

const ForceGraph2D = dynamic(
  () => import('react-force-graph').then((m) => m.ForceGraph2D),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Loading graph engine…
      </div>
    ),
  },
);

const TYPE_COLOR: Record<string, string> = {
  EPISODIC: '#3b82f6',
  SEMANTIC: '#a855f7',
  PROCEDURAL: '#22c55e',
};

export default function GraphPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [graphData, setGraphData] = useState<{ nodes: ForceNode[]; links: ForceLink[] }>({
    nodes: [],
    links: [],
  });
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [selectedNs, setSelectedNs] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPending && !session) router.push('/login');
  }, [session, isPending, router]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, ns] = await Promise.all([
        api.getGraph({ namespaceId: selectedNs, limit: 200 }),
        api.listNamespaces(),
      ]);
      setNamespaces(ns);
      setGraphData({
        nodes: data.nodes as ForceNode[],
        links: data.edges.map((e) => ({
          source: e.source,
          target: e.target,
          relationType: e.relationType,
          weight: e.weight,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, [selectedNs]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  if (isPending || !session) return null;

  const nodeCount = graphData.nodes.length;
  const edgeCount = graphData.links.length;

  return (
    <div className="flex flex-col h-[calc(100vh-53px)]">
      {/* Controls bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Namespace</span>
          <select
            value={selectedNs ?? ''}
            onChange={(e) => setSelectedNs(e.target.value || undefined)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-gray-500"
          >
            <option value="">All</option>
            {namespaces.map((ns) => (
              <option key={ns.id} value={ns.id}>
                {ns.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{nodeCount} nodes</span>
          <span>{edgeCount} edges</span>
        </div>
        {/* Legend */}
        <div className="ml-auto flex items-center gap-4">
          {Object.entries(TYPE_COLOR).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-400 capitalize">{type.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-gray-950">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-gray-500 text-sm">Loading memory graph…</div>
          </div>
        )}

        {!loading && !error && nodeCount === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-gray-400 text-sm">No memories yet.</p>
            <p className="text-gray-600 text-xs">
              Use the MCP tools to store memories, then come back here to see your knowledge graph.
            </p>
          </div>
        )}

        {!loading && !error && nodeCount > 0 && (
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            backgroundColor="#030712"
            nodeColor={(node) => TYPE_COLOR[(node as ForceNode).type] ?? '#6b7280'}
            nodeRelSize={5}
            nodeVal={(node) => {
              const n = node as ForceNode;
              const degree = graphData.links.filter((l) => {
                const src =
                  typeof l.source === 'object'
                    ? (l.source as ForceNode).id
                    : l.source;
                const tgt =
                  typeof l.target === 'object'
                    ? (l.target as ForceNode).id
                    : l.target;
                return src === n.id || tgt === n.id;
              }).length;
              return Math.max(1, degree);
            }}
            nodeLabel={() => ''}
            linkColor={(link) => {
              const w = (link as ForceLink).weight ?? 0.5;
              const alpha = Math.round(80 + w * 120)
                .toString(16)
                .padStart(2, '0');
              return `#6b7280${alpha}`;
            }}
            linkWidth={(link) =>
              Math.max(0.5, ((link as ForceLink).weight ?? 0.5) * 2)
            }
            onNodeHover={(node) => {
              if (node) {
                const n = node as ForceNode;
                const content = String(n.content ?? '');
                setTooltip({
                  content:
                    content.length > 150 ? content.slice(0, 150) + '…' : content,
                  x: 0,
                  y: 0,
                });
              } else {
                setTooltip(null);
              }
            }}
            onNodeClick={(node) => {
              const n = node as ForceNode;
              navigator.clipboard?.writeText(String(n.content ?? '')).catch(() => {});
            }}
            cooldownTicks={100}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={1.5}
            linkDirectionalParticleSpeed={0.005}
          />
        )}

        {/* Tooltip — canvas-relative, shown at fixed bottom-left of canvas when hovering */}
        {tooltip && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-50 max-w-xs rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 text-xs text-gray-200 shadow-xl backdrop-blur-sm">
            {tooltip.content}
            <div className="mt-1 text-gray-500">Click to copy</div>
          </div>
        )}
      </div>
    </div>
  );
}
