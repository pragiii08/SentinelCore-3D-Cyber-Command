import { ExternalLink, FileText, GitBranch, Layers, ShieldCheck, Video, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ArchitectureLayer } from '../types/security';
import { SystemArchitecture3D } from './scenes/SystemArchitecture3D';

interface CapstoneDeliverablesSectionProps {
  layers: ArchitectureLayer[];
  isSoftwareGl: boolean;
}

type DeliverableModal = 'github' | 'report' | 'video' | null;

export function CapstoneDeliverablesSection({
  layers,
  isSoftwareGl,
}: CapstoneDeliverablesSectionProps) {
  const [selectedLayerId, setSelectedLayerId] = useState<string>(layers[0].id);
  const [exploded, setExploded] = useState<boolean>(true);
  const [activeModal, setActiveModal] = useState<DeliverableModal>(null);

  useEffect(() => {
    if (!activeModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal]);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? layers[0];

  return (
    <footer
      id="capstone-architecture"
      aria-labelledby="capstone-heading"
      className="mt-12 border-t border-slate-800/90 bg-[#0B101B]"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {/* Top Row: Capstone Title + Authorized Testing Scope Badge + Deliverables Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 px-3 py-1 text-xs font-medium text-[#10B981]">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Authorized Testing Scope: Owned Lab Subnets (10.42.0.0/16 · 172.16.8.0/24)</span>
            </div>
            <h2
              id="capstone-heading"
              className="font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold tracking-tight text-slate-50"
            >
              System Architecture & Capstone Deliverables
            </h2>
            <p className="text-sm text-slate-400">
              Four-tier defensive architecture combining isolated RFC1918 targets, zero-trust telemetry sensors, deterministic scoring, and WebGL command interfaces.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveModal('github')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1320] px-4 py-2.5 text-xs font-semibold text-slate-100 transition-colors hover:border-[#00F0FF]/60 hover:text-[#00F0FF] whitespace-nowrap"
            >
              <GitBranch className="h-4 w-4" aria-hidden="true" />
              GitHub Repository
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('report')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1320] px-4 py-2.5 text-xs font-semibold text-slate-100 transition-colors hover:border-[#10B981]/60 hover:text-[#10B981] whitespace-nowrap"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Testing Report
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('video')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00F0FF] px-4 py-2.5 text-xs font-semibold text-[#090D16] transition-colors hover:bg-[#38F5FF] whitespace-nowrap"
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              Demo Video
            </button>
          </div>
        </div>

        {/* Interactive 3D Layered System Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-800/90 bg-[#0D1320] overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#00F0FF]" aria-hidden="true" />
                <span className="text-xs font-semibold text-slate-200">
                  Interactive 3D Layered Architecture
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExploded((prev) => !prev)}
                aria-pressed={exploded}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  exploded
                    ? 'border-[#00F0FF]/50 bg-[#00F0FF]/12 text-[#00F0FF]'
                    : 'border-slate-700 bg-[#090D16] text-slate-300 hover:text-white'
                }`}
              >
                {exploded ? 'Collapse Stack' : 'Explode Layers'}
              </button>
            </div>

            <div className="h-[310px] w-full bg-[#0B101B]">
              <SystemArchitecture3D
                layers={layers}
                selectedLayerId={selectedLayer.id}
                onSelectLayer={setSelectedLayerId}
                exploded={exploded}
                isSoftwareGl={isSoftwareGl}
              />
            </div>
          </div>

          {/* Layer Details Inspector */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#0D1320] p-5 space-y-4">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {layers.map((layer) => {
                  const active = layer.id === selectedLayer.id;
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => setSelectedLayerId(layer.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF]'
                          : 'border-slate-800 bg-[#090D16] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Layer 0{layer.index}
                    </button>
                  );
                })}
              </div>

              <div>
                <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-slate-100">
                  {selectedLayer.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedLayer.role}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/80 pt-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-300 mb-1.5">Core Components</p>
                  <ul className="space-y-1 text-slate-400">
                    {selectedLayer.components.map((comp) => (
                      <li key={comp}>· {comp}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-300 mb-1.5">Security Controls</p>
                  <ul className="space-y-1 text-[#10B981]">
                    {selectedLayer.securityControls.map((ctrl) => (
                      <li key={ctrl}>· {ctrl}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <p className="border-t border-slate-800/80 pt-3 text-[11px] text-slate-500">
              SentinelCore Cybersecurity Capstone · All offensive/defensive drills restricted to authorized lab environments.
            </p>
          </div>
        </div>
      </div>

      {/* Deliverable Viewer Modal */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deliverable-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-[#0D1320] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <h3
                id="deliverable-modal-title"
                className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-100"
              >
                {activeModal === 'github' && 'GitHub Repository & Architecture Manifest'}
                {activeModal === 'report' && 'Authorized Security Testing Report'}
                {activeModal === 'video' && 'Capstone Interactive Demo Walkthrough'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Close deliverable modal"
                className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeModal === 'github' && (
              <div className="space-y-3 text-xs text-slate-300">
                <p>
                  Modular TypeScript + React 19 + Three.js WebGL architecture with deterministic unit-tested security scoring and zero external runtime dependencies.
                </p>
                <pre className="rounded-lg border border-slate-800 bg-[#090D16] p-3.5 font-mono text-[11px] text-[#00F0FF] overflow-x-auto">
{`sentinelcore-command-center/
├── src/components/scenes/     # 6 interactive Three.js WebGL viewports
├── src/components/views/      # Overview, Log Analyzer, CVEs, Network, Phishing
├── src/utils/securityLogic.ts # Pure SIEM, CVSS, & funnel calculations
├── src/utils/securityLogic.test.ts # Node test suite (tsx --test)
└── src/data/seedData.ts       # Authorized RFC1918 lab telemetry dataset`}
                </pre>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Build: Vite 8 · TypeScript · Tailwind v4</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[#10B981]">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Repository Ready
                  </span>
                </div>
              </div>
            )}

            {activeModal === 'report' && (
              <div className="space-y-3 text-xs text-slate-300">
                <p>
                  Verification executed strictly against sandbox hosts inside <span className="font-mono text-[#00F0FF]">10.42.0.0/16</span> and <span className="font-mono text-[#00F0FF]">172.16.8.0/24</span>.
                </p>
                <table className="w-full border-collapse text-left font-mono text-[11px] border border-slate-800">
                  <thead className="bg-[#090D16] text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Control Area</th>
                      <th className="px-3 py-2">Test Probe</th>
                      <th className="px-3 py-2 text-right">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="px-3 py-2">WAF / SQLi Filter</td>
                      <td className="px-3 py-2">UNION SELECT probe (185.220.101.44)</td>
                      <td className="px-3 py-2 text-right text-[#10B981]">Blocked (100%)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">OIDC Callback</td>
                      <td className="px-3 py-2">CVE-2026-0984 redirect validation</td>
                      <td className="px-3 py-2 text-right text-[#EF4444]">Patch Pending</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">DMARC / SPF Relay</td>
                      <td className="px-3 py-2">Spoofed header quarantine drill</td>
                      <td className="px-3 py-2 text-right text-[#10B981]">Quarantined</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeModal === 'video' && (
              <div className="space-y-3 text-xs text-slate-300">
                <p>
                  Walkthrough chapters covering all four SentinelCore defensive & offensive security modules:
                </p>
                <ol className="space-y-2 rounded-lg border border-slate-800 bg-[#090D16] p-4">
                  <li><strong className="text-[#00F0FF]">00:00 — 3D Cyber Globe & Topology:</strong> Orbiting threat nodes, inspecting packet rates, and pivoting directly to SIEM logs.</li>
                  <li><strong className="text-[#00F0FF]">01:15 — Log Analyzer:</strong> Filtering live SQLi/SSRF telemetry chips and clicking 3D anomaly bar buckets.</li>
                  <li><strong className="text-[#00F0FF]">02:30 — Vulnerability Posture:</strong> Completing remediation checklist items and observing the 3D radial gauge update.</li>
                  <li><strong className="text-[#00F0FF]">03:45 — Network Monitor & Phishing Sim:</strong> Isolating 3D subnet links, launching awareness drills, and reviewing the 3D funnel.</li>
                </ol>
              </div>
            )}

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
