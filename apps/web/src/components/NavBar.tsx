'use client';

export function NavBar() {
  return (
    <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
      <span className="font-semibold tracking-tight text-white">memory-os</span>
      <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Vault</a>
      <a href="/search" className="text-sm text-gray-400 hover:text-white transition-colors">Search</a>
      <a href="/graph" className="text-sm text-gray-400 hover:text-white transition-colors">Graph</a>
      <a href="/packs" className="text-sm text-gray-400 hover:text-white transition-colors">Packs</a>
      <a href="/settings" className="ml-auto text-sm text-gray-400 hover:text-white transition-colors">Settings</a>
    </nav>
  );
}
