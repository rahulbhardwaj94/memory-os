'use client';

import { useState } from 'react';

const MCP_CONFIG = `{
  "mcpServers": {
    "memory-os": {
      "command": "node",
      "args": ["/absolute/path/to/memory-os/apps/server/dist/mcp/mcp-server.js"],
      "env": {
        "DATABASE_URL": "postgresql://memory_os:memory_os@localhost:5432/memory_os",
        "EMBEDDING_PROVIDER": "ollama"
      }
    }
  }
}`;

const CLIENTS: { name: string; path: string }[] = [
  { name: 'Claude Desktop (macOS)', path: '~/Library/Application Support/Claude/claude_desktop_config.json' },
  { name: 'Claude Desktop (Windows)', path: '%APPDATA%\\Claude\\claude_desktop_config.json' },
  { name: 'Cursor', path: '~/.cursor/mcp.json' },
  { name: 'Cline / Zed', path: 'See client docs for MCP config path' },
];

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(MCP_CONFIG);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Configure MCP clients to connect to your local vault.</p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-medium">MCP Client Setup</h2>
          <p className="text-sm text-gray-400 mt-1">
            Add the following to your MCP client config file. Replace the{' '}
            <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">args</code> path with the
            absolute path to your local checkout.
          </p>
        </div>

        <div className="relative">
          <pre className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-xs text-gray-300 overflow-x-auto">
            {MCP_CONFIG}
          </pre>
          <button
            onClick={() => void copy()}
            className="absolute top-2 right-2 text-xs px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <p className="text-sm text-gray-500">
          Change <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">EMBEDDING_PROVIDER</code> to
          match the provider you chose during setup (
          <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">ollama</code>,{' '}
          <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">openai</code>,{' '}
          <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">voyage</code>, etc.).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Config file locations</h2>
        <div className="space-y-2">
          {CLIENTS.map(c => (
            <div key={c.name} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 flex items-start justify-between gap-4">
              <span className="text-sm font-medium">{c.name}</span>
              <code className="text-xs text-gray-400 text-right">{c.path}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Available MCP tools</h2>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
          {[
            'remember', 'recall', 'forget', 'list_namespaces',
            'create_namespace', 'get_memory', 'list_recent',
            'relate', 'traverse',
            'session_remember', 'session_recall', 'session_clear',
          ].map(tool => (
            <code key={tool} className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs">
              {tool}
            </code>
          ))}
        </div>
      </section>
    </div>
  );
}
