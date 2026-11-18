import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  Layers,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  GodsEyeLayerFilter,
  GodsEyeSensorMode,
  ModuleTab,
  NetworkLink,
  NetworkNode,
  PhishingCampaign,
  SecurityLogEntry,
  VulnerabilityItem,
} from '../types/security';
import { summarizeGodsEyeProjection } from '../utils/securityLogic';
import {
  GodsEyeProjection3D,
  type GodsEyeInspectedEntity,
} from './scenes/GodsEyeProjection3D';

interface GodsEyeOverlayProps {
  activeTab: ModuleTab;
  logs: SecurityLogEntry[];
  cves: VulnerabilityItem[];
  nodes: NetworkNode[];
  links: NetworkLink[];
  campaigns: PhishingCampaign[];
  onClose: () => void;
  onJumpToModule: (tab: ModuleTab) => void;
  isSoftwareGl: boolean;
}

const MODULE_LABELS: Record<ModuleTab, string> = {
  overview: 'Overview Command',
  logs: 'Log Analyzer',
  vulnerabilities: 'Vulnerability Dashboard',
  network: 'Network Monitor',
  phishing: 'Phishing Simulator',
};

const SENSOR_MODES: { id: GodsEyeSensorMode; label: string }[] = [
  { id: 'wireframe', label: 'Wireframe' },
  { id: 'nvg', label: 'NVG' },
  { id: 'flir', label: 'FLIR' },
  { id: 'crt', label: 'CRT' },
];

export function GodsEyeOverlay({
  activeTab,
  logs,
  cves,
  nodes,
  links,
  campaigns,
  onClose,
  onJumpToModule,
  isSoftwareGl,
}: GodsEyeOverlayProps) {
  const [layerFilter, setLayerFilter] = useState<GodsEyeLayerFilter>('all');
  const [sensorMode, setSensorMode] = useState<GodsEyeSensorMode>('wireframe');
  const [showWireframeCage, setShowWireframeCage] = useState<boolean>(true);
  const [showTargetBoxes, setShowTargetBoxes] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [inspectedEntity, setInspectedEntity] = useState<GodsEyeInspectedEntity | null>(null);

  const summary = useMemo(
    () =>
      summarizeGodsEyeProjection({
        logs,
        cves,
        nodes,
        links,
        campaigns,
      }),
    [logs, cves, nodes, links, campaigns],
  );

  const handleInspectJump = (tab: ModuleTab) => {
    onJumpToModule(tab);
    onClose();
  };

  const backdropTint =
    sensorMode === 'nvg'
      ? 'bg-[#04120A]/82'
      : sensorMode === 'flir'
        ? 'bg-[#110806]/82'
        : 'bg-[#060A12]/80';

  const bracketColor =
    sensorMode === 'nvg'
      ? 'border-[#10B981]/50'
      : sensorMode === 'flir'
        ? 'border-amber-400/50'
        : 'border-[#00F0FF]/45';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gods-eye-overlay-title"
      data-testid="gods-eye-overlay"
      data-sensor-mode={sensorMode}
      className={`fixed inset-0 z-50 flex flex-col ${backdropTint} text-slate-100 transition-colors duration-200`}
    >
      {/* Full-Viewport Translucent 3D Wireframe Projection */}
      <div className="absolute inset-0">
        <GodsEyeProjection3D
          nodes={nodes}
          links={links}
          threatArcs={summary.threatArcs}
          layerFilter={layerFilter}
          sensorMode={sensorMode}
          searchQuery={searchQuery}
          showWireframeCage={showWireframeCage}
          showTargetBoxes={showTargetBoxes}
          onInspectEntity={setInspectedEntity}
          isSoftwareGl={isSoftwareGl}
        />
      </div>

      {/* Tactical Optical Corner Reticle Brackets */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-3 z-10">
        <div className={`absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 ${bracketColor}`} />
        <div className={`absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 ${bracketColor}`} />
        <div className={`absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 ${bracketColor}`} />
        <div className={`absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 ${bracketColor}`} />
      </div>

      {/* Top HUD Bar (Non-obstructive perimeter strip) */}
      <div className="pointer-events-none relative z-20 flex flex-wrap items-start justify-between gap-4 px-5 pt-5 sm:px-8 sm:pt-6">
        <div className="pointer-events-auto rounded-xl border border-[#00F0FF]/30 bg-[#090D16]/92 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Eye className="h-4 w-4 text-[#00F0FF] shrink-0" aria-hidden="true" />
            <h2
              id="gods-eye-overlay-title"
              className="font-[family-name:var(--font-display)] text-sm sm:text-base font-bold tracking-tight text-slate-50"
            >
              God&apos;s Eye Tactical Wireframe Projection
            </h2>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 font-mono tabular-nums">
            <span className="text-slate-400">
              Active View: <strong className="text-slate-100 font-medium">{MODULE_LABELS[activeTab]}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              Threats:{' '}
              <strong className="text-[#EF4444]">
                {summary.totalActiveThreats} ({summary.criticalThreatCount} Critical)
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              Open CVEs: <strong className="text-amber-400">{summary.openCveCount}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              Traffic:{' '}
              <strong className="text-[#00F0FF]">
                {summary.monitoredLinks} links · {summary.totalBandwidthMbps.toLocaleString()} Mbps
              </strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close God's Eye 3D overlay"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#090D16]/92 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-[#00F0FF] hover:text-[#00F0FF] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span>Exit God&apos;s Eye</span>
        </button>
      </div>

      {/* Unified Collapsible Bottom Control Dock (Zero Center Occlusion) */}
      <div className="pointer-events-none relative z-20 mt-auto flex flex-col items-center px-4 pb-5">
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="pointer-events-auto mb-2 inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-700 bg-[#090D16]/92 px-3 py-1 text-[11px] font-medium text-slate-300 hover:text-[#00F0FF]"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Show Projection Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hide Projection Controls</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full max-w-[1040px] rounded-xl border border-slate-800 bg-[#090D16]/94 p-3.5 space-y-3">
            {/* Inspected Entity Readout (if user clicked a node, threat arc, or bounding box) */}
            {inspectedEntity && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#00F0FF]/35 bg-[#0D1320] px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-100 truncate">
                      {inspectedEntity.title}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span
                      className={`font-mono font-medium ${
                        inspectedEntity.severityLabel.toLowerCase().includes('critical') ||
                        inspectedEntity.severityLabel.toLowerCase().includes('alert')
                          ? 'text-[#EF4444]'
                          : 'text-[#00F0FF]'
                      }`}
                    >
                      {inspectedEntity.severityLabel}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-400 truncate mt-0.5">
                    {inspectedEntity.subtitle} · {inspectedEntity.metricLabel}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleInspectJump(inspectedEntity.targetModule)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#00F0FF] px-3 py-1.5 text-xs font-semibold text-[#090D16] hover:bg-[#38F5FF] whitespace-nowrap shrink-0"
                >
                  <span>Inspect in {MODULE_LABELS[inspectedEntity.targetModule]}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Main Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Layer Visibility Selector */}
              <div
                role="group"
                aria-label="Projection layer visibility"
                className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#0D1320] p-1"
              >
                {(
                  [
                    { id: 'all', label: 'All Layers' },
                    { id: 'threats', label: 'Threats Only' },
                    { id: 'traffic', label: 'Traffic Only' },
                  ] as const
                ).map((item) => {
                  const active = layerFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLayerFilter(item.id)}
                      aria-pressed={active}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#00F0FF]/18 text-[#00F0FF]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Sensor Optics Modes (God's Eye View style: Wireframe / NVG / FLIR / CRT) */}
              <div
                role="group"
                aria-label="Optical sensor mode"
                className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#0D1320] p-1"
              >
                {SENSOR_MODES.map((opt) => {
                  const active = sensorMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSensorMode(opt.id)}
                      aria-pressed={active}
                      className={`rounded-md px-2.5 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#10B981]/18 text-[#10B981]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Search Entity Filter + HUD / Lattice Toggles */}
              <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                <div className="relative w-full sm:w-52">
                  <label htmlFor="gods-eye-overlay-search" className="sr-only">
                    Highlight IP, host, or threat signature in 3D projection
                  </label>
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="gods-eye-overlay-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Highlight IP, host..."
                    className="w-full rounded-lg border border-slate-700 bg-[#0D1320] py-1.5 pl-8 pr-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowTargetBoxes((prev) => !prev)}
                  aria-pressed={showTargetBoxes}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    showTargetBoxes
                      ? 'border-[#00F0FF]/50 bg-[#00F0FF]/12 text-[#00F0FF]'
                      : 'border-slate-700 bg-[#0D1320] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Targets</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWireframeCage((prev) => !prev)}
                  aria-pressed={showWireframeCage}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    showWireframeCage
                      ? 'border-[#10B981]/50 bg-[#10B981]/12 text-[#10B981]'
                      : 'border-slate-700 bg-[#0D1320] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Lattice</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
