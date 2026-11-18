import { Eye, Menu, Shield, X } from 'lucide-react';
import { useState } from 'react';
import type { ModuleTab } from '../types/security';

interface TopNavProps {
  activeTab: ModuleTab;
  onSelectTab: (tab: ModuleTab) => void;
  onOpenArchitecture: () => void;
  godsEyeOpen: boolean;
  onToggleGodsEye: () => void;
}

const NAV_ITEMS: { id: ModuleTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'logs', label: 'Log Analyzer' },
  { id: 'vulnerabilities', label: 'Vulnerabilities' },
  { id: 'network', label: 'Network Monitor' },
  { id: 'phishing', label: 'Phishing Sim' },
];

export function TopNav({
  activeTab,
  onSelectTab,
  onOpenArchitecture,
  godsEyeOpen,
  onToggleGodsEye,
}: TopNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (tab: ModuleTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#090D16]/95">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('overview')}
          className="flex items-center gap-2.5 text-left font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00F0FF]"
        >
          <Shield className="h-5 w-5 text-[#00F0FF] shrink-0" aria-hidden="true" />
          <span>SentinelCore</span>
        </button>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav
          aria-label="Primary modules"
          className="hidden lg:flex items-center gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00F0FF] ${
                  isActive
                    ? 'text-[#00F0FF]'
                    : 'text-slate-300 hover:text-slate-50'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-[#00F0FF]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Global God's Eye Toggle + Architecture & Docs + Mobile Drawer Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleGodsEye}
            aria-pressed={godsEyeOpen}
            data-testid="topnav-godseye-toggle"
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF] ${
              godsEyeOpen
                ? 'border-[#00F0FF] bg-[#00F0FF] text-[#090D16]'
                : 'border-[#00F0FF]/45 bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20'
            }`}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>God&apos;s Eye</span>
          </button>

          <button
            type="button"
            onClick={onOpenArchitecture}
            className="hidden sm:inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF]"
          >
            Architecture & Docs
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex lg:hidden items-center justify-center rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-slate-500 min-h-[40px] min-w-[40px]"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden border-t border-slate-800 bg-[#0B101B] px-4 py-3 space-y-1"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#00F0FF]/12 text-[#00F0FF]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onOpenArchitecture();
            }}
            className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-left text-sm font-semibold text-slate-200"
          >
            Architecture & Docs
          </button>
        </nav>
      )}
    </header>
  );
}

