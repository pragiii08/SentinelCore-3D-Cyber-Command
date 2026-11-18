import {
  Activity,
  ArrowRight,
  Eye,
  Globe,
  Layers,
  Lock,
  MailWarning,
  Search,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  ActivePortStatus,
  ModuleTab,
  NetworkNode,
  SecurityLogEntry,
  ThreatGlobeNode,
  VulnerabilityItem,
} from '../../types/security';
import { correlateGodsEye } from '../../utils/securityLogic';
import { HeroCyberScene, type HeroSceneMode } from '../scenes/HeroCyberScene';

interface OverviewViewProps {
  threatNodes: ThreatGlobeNode[];
  logs: SecurityLogEntry[];
  cves: VulnerabilityItem[];
  nodes: NetworkNode[];
  ports: ActivePortStatus[];
  onNavigateModule: (tab: ModuleTab) => void;
  totalLogsCount: number;
  criticalAlertsCount: number;
  systemHealthScore: number;
  activePortsCount: number;
  phishingClickRatePct: number;
  isSoftwareGl: boolean;
}

const QUICK_TRACE_TARGETS = [
  '185.220.101.44',
  'lab-edge-fw-01',
  'lab-api-gw-01',
  'CVE-2026-1042',
];

export function OverviewView({
  threatNodes,
  logs,
  cves,
  nodes,
  ports,
  onNavigateModule,
  totalLogsCount,
  criticalAlertsCount,
  systemHealthScore,
  activePortsCount,
  phishingClickRatePct,
  isSoftwareGl,
}: OverviewViewProps) {
  const [sceneMode, setSceneMode] = useState<HeroSceneMode>('globe');
  const [selectedNode, setSelectedNode] = useState<ThreatGlobeNode>(threatNodes[0]);
  const [godsEyeQuery, setGodsEyeQuery] = useState<string>('185.220.101.44');

  const correlation = useMemo(
    () => correlateGodsEye(godsEyeQuery, { logs, cves, nodes, ports }),
    [godsEyeQuery, logs, cves, nodes, ports],
  );

  const handleSelectNode = (node: ThreatGlobeNode) => {
    setSelectedNode(node);
    setGodsEyeQuery(node.ip);
  };

  const moduleCards: {
    tab: ModuleTab;
    title: string;
    metric: string;
    detail: string;
    icon: typeof Terminal;
    accent: string;
  }[] = [
    {
      tab: 'logs',
      title: 'Log Analyzer',
      metric: `${totalLogsCount} Events · ${criticalAlertsCount} Critical`,
      detail: 'Live SIEM terminal stream, IP/signature parsing, and 3D anomaly spike bars.',
      icon: Terminal,
      accent: 'text-[#00F0FF]',
    },
    {
      tab: 'vulnerabilities',
      title: 'Vulnerability Dashboard',
      metric: `${systemHealthScore}% Health Score`,
      detail: '3D radial posture gauge, CVSS severity breakdown, and remediation checklist.',
      icon: ShieldAlert,
      accent: 'text-[#10B981]',
    },
    {
      tab: 'network',
      title: 'Network Monitor',
      metric: `${activePortsCount} Guarded Services`,
      detail: '3D node-link subnet graph, live bandwidth throughput, and port auditing.',
      icon: Activity,
      accent: 'text-[#00F0FF]',
    },
    {
      tab: 'phishing',
      title: 'Phishing Simulator',
      metric: `${phishingClickRatePct}% Click Rate`,
      detail: 'Campaign builder, 3D conversion funnel, and awareness training drills.',
      icon: MailWarning,
      accent: 'text-[#EF4444]',
    },
  ];

  const verdictColor =
    correlation.verdict === 'Critical'
      ? 'text-[#EF4444]'
      : correlation.verdict === 'Elevated'
        ? 'text-amber-400'
        : 'text-[#10B981]';

  return (
    <section aria-labelledby="hero-heading" className="space-y-8">
      {/* Hero 2-Column Split: 3D Interactive Centerpiece + Threat Node Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col rounded-xl border border-slate-800/90 bg-[#0D1320] overflow-hidden">
          {/* Viewport Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
            <div>
              <h1
                id="hero-heading"
                className="font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold tracking-tight text-slate-50 text-balance"
              >
                Cybersecurity Operations Command Center
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Authorized Sandbox Scope · Drag to orbit, click any glowing node to trace across modules
              </p>
            </div>

            <div
              role="group"
              aria-label="3D viewport mode"
              className="flex flex-wrap items-center gap-1 rounded-lg bg-[#090D16] p-1 border border-slate-800 shrink-0"
            >
              <button
                type="button"
                onClick={() => setSceneMode('globe')}
                aria-pressed={sceneMode === 'globe'}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sceneMode === 'globe'
                    ? 'bg-[#00F0FF]/15 text-[#00F0FF]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                Cyber Globe
              </button>
              <button
                type="button"
                onClick={() => setSceneMode('topology')}
                aria-pressed={sceneMode === 'topology'}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sceneMode === 'topology'
                    ? 'bg-[#00F0FF]/15 text-[#00F0FF]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                Server Topology
              </button>
              <button
                type="button"
                onClick={() => setSceneMode('godseye')}
                aria-pressed={sceneMode === 'godseye'}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sceneMode === 'godseye'
                    ? 'bg-[#00F0FF]/15 text-[#00F0FF]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                God&apos;s Eye
              </button>
            </div>
          </div>

          {/* 3D Canvas Container */}
          <div className="relative h-[400px] sm:h-[460px] w-full bg-[#090D16]">
            <HeroCyberScene
              mode={sceneMode}
              threatNodes={threatNodes}
              selectedNodeId={selectedNode.id}
              onSelectNode={handleSelectNode}
              isSoftwareGl={isSoftwareGl}
            />
          </div>
        </div>

        {/* Right Column: Selected Node Inspector & Quick Telemetry */}
        <aside className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#0D1320] p-5 space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-slate-100">
                Active Threat Node Inspector
              </h2>
              <span
                className={`text-xs font-mono font-medium ${
                  selectedNode.severity === 'Critical'
                    ? 'text-[#EF4444]'
                    : selectedNode.severity === 'Warning'
                      ? 'text-amber-400'
                      : 'text-[#00F0FF]'
                }`}
              >
                {selectedNode.severity}
              </span>
            </div>

            <div className="space-y-3 border-t border-slate-800/80 pt-4">
              <div>
                <p className="text-xs text-slate-400">Node & Region</p>
                <p className="text-sm font-semibold text-slate-100 mt-0.5">
                  {selectedNode.label} · {selectedNode.region}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Source IP</p>
                  <p className="font-mono text-sm text-[#00F0FF] tabular-nums mt-0.5">
                    {selectedNode.ip}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Ingress Rate</p>
                  <p className="font-mono text-sm text-slate-100 tabular-nums mt-0.5">
                    {selectedNode.packetsPerSec.toLocaleString()} pps
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400">Detected Signature</p>
                <p className="font-mono text-sm text-slate-200 mt-0.5">
                  {selectedNode.attackType}
                </p>
              </div>
            </div>

            {/* Node quick switcher */}
            <div className="border-t border-slate-800/80 pt-4">
              <p className="text-xs text-slate-400 mb-2">Tracked Perimeter Nodes</p>
              <div className="space-y-1.5">
                {threatNodes.map((node) => {
                  const active = node.id === selectedNode.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => handleSelectNode(node)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                        active
                          ? 'bg-[#00F0FF]/12 text-[#00F0FF] border border-[#00F0FF]/35'
                          : 'bg-[#090D16]/70 text-slate-300 border border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-medium truncate pr-2">{node.label}</span>
                      <span className="font-mono tabular-nums shrink-0 text-[11px]">
                        {node.severity}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-800/80 pt-4">
            <button
              type="button"
              onClick={() => onNavigateModule(selectedNode.targetModule)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00F0FF] px-4 py-2.5 text-sm font-semibold text-[#090D16] transition-colors hover:bg-[#38F5FF] whitespace-nowrap"
            >
              <span>Inspect in Module</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
              <span>Telemetry simulated strictly within authorized sandbox</span>
            </p>
          </div>
        </aside>
      </div>

      {/* God's Eye Cross-Domain Sightline & Correlation Matrix */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0D1320] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-[#00F0FF]" aria-hidden="true" />
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-slate-100">
                God&apos;s Eye Cross-Domain Sightline
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Correlate any IP, hostname, CVE identifier, or attack signature across SIEM logs, vulnerabilities, subnets, and open ports simultaneously.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative w-full sm:w-72">
              <label htmlFor="godseye-search-input" className="sr-only">
                God&apos;s Eye entity correlation query
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="godseye-search-input"
                type="search"
                value={godsEyeQuery}
                onChange={(e) => setGodsEyeQuery(e.target.value)}
                placeholder="Trace IP, host, CVE, or signature..."
                className="w-full rounded-lg border border-slate-700 bg-[#090D16] py-2 pl-9 pr-3 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-mono tabular-nums shrink-0">
              <span className="text-slate-400">Verdict:</span>
              <span className={`font-semibold ${verdictColor}`} data-testid="godseye-verdict">
                {correlation.verdict} ({correlation.totalHits} hits)
              </span>
            </div>
          </div>
        </div>

        {/* Quick-Trace Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Quick Trace:</span>
          {QUICK_TRACE_TARGETS.map((target) => {
            const active = godsEyeQuery.trim().toLowerCase() === target.toLowerCase();
            return (
              <button
                key={target}
                type="button"
                onClick={() => {
                  setGodsEyeQuery(target);
                  setSceneMode('godseye');
                }}
                className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-[#00F0FF] bg-[#00F0FF]/12 text-[#00F0FF]'
                    : 'border-slate-800 bg-[#090D16] text-slate-300 hover:border-slate-600'
                }`}
              >
                {target}
              </button>
            );
          })}
        </div>

        {/* Correlated Cross-Module Results Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <button
            type="button"
            onClick={() => onNavigateModule('logs')}
            className="rounded-lg border border-slate-800 bg-[#090D16] p-3.5 text-left transition-colors hover:border-[#00F0FF]/50"
          >
            <p className="text-xs text-slate-400">Correlated SIEM Logs</p>
            <p className="font-mono text-lg font-bold text-[#00F0FF] tabular-nums mt-1">
              {correlation.matchedLogs.length}
            </p>
            <p className="font-mono text-[11px] text-slate-300 truncate mt-1">
              {correlation.matchedLogs[0]?.signature ?? 'No matching log frames'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateModule('vulnerabilities')}
            className="rounded-lg border border-slate-800 bg-[#090D16] p-3.5 text-left transition-colors hover:border-[#10B981]/50"
          >
            <p className="text-xs text-slate-400">Linked CVE Advisories</p>
            <p className="font-mono text-lg font-bold text-[#10B981] tabular-nums mt-1">
              {correlation.matchedCves.length}
            </p>
            <p className="font-mono text-[11px] text-slate-300 truncate mt-1">
              {correlation.matchedCves[0]?.cveId ?? 'No matching CVEs'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateModule('network')}
            className="rounded-lg border border-slate-800 bg-[#090D16] p-3.5 text-left transition-colors hover:border-[#00F0FF]/50"
          >
            <p className="text-xs text-slate-400">Topology Hosts</p>
            <p className="font-mono text-lg font-bold text-slate-100 tabular-nums mt-1">
              {correlation.matchedNodes.length}
            </p>
            <p className="font-mono text-[11px] text-slate-300 truncate mt-1">
              {correlation.matchedNodes[0]?.subnet ?? 'No matching subnets'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateModule('network')}
            className="rounded-lg border border-slate-800 bg-[#090D16] p-3.5 text-left transition-colors hover:border-[#00F0FF]/50"
          >
            <p className="text-xs text-slate-400">Exposed Ports</p>
            <p className="font-mono text-lg font-bold text-amber-400 tabular-nums mt-1">
              {correlation.matchedPorts.length}
            </p>
            <p className="font-mono text-[11px] text-slate-300 truncate mt-1">
              {correlation.matchedPorts[0]
                ? `${correlation.matchedPorts[0].protocol}/${correlation.matchedPorts[0].port} (${correlation.matchedPorts[0].state})`
                : 'No matching services'}
            </p>
          </button>
        </div>
      </div>

      {/* 4-Column Interface Launch Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {moduleCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.tab}
              type="button"
              onClick={() => onNavigateModule(card.tab)}
              className="group flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#0D1320] p-5 text-left transition-colors hover:border-[#00F0FF]/45 hover:bg-[#101829] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF]"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Icon className={`h-5 w-5 ${card.accent}`} aria-hidden="true" />
                  <ArrowRight
                    className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-[#00F0FF]"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-slate-100 mt-3">
                  {card.title}
                </h3>
                <p className="font-mono text-xs text-slate-300 tabular-nums mt-1">
                  {card.metric}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  {card.detail}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
