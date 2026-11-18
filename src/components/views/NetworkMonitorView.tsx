import { Activity, Network, Server, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ActivePortStatus, NetworkLink, NetworkNode } from '../../types/security';
import { filterNetworkPorts, getNodeConnections } from '../../utils/securityLogic';
import { NetworkTopology3D } from '../scenes/NetworkTopology3D';

interface NetworkMonitorViewProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  ports: ActivePortStatus[];
  isSoftwareGl: boolean;
}

export function NetworkMonitorView({
  nodes,
  links,
  ports,
  isSoftwareGl,
}: NetworkMonitorViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [portStateFilter, setPortStateFilter] = useState<ActivePortStatus['state'] | 'All'>('All');

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const visiblePorts = useMemo(
    () => filterNetworkPorts(ports, selectedNodeId, portStateFilter),
    [ports, selectedNodeId, portStateFilter],
  );

  const totalThroughput = useMemo(
    () => nodes.reduce((sum, n) => sum + n.throughputMbps, 0),
    [nodes],
  );

  const selectedConnections = useMemo(
    () => (selectedNodeId ? getNodeConnections(links, selectedNodeId) : []),
    [links, selectedNodeId],
  );

  return (
    <section aria-labelledby="network-monitor-heading" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            id="network-monitor-heading"
            className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-slate-50"
          >
            3D Network Monitor & Port Telemetry
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspect internal subnets, edge firewalls, and service endpoints in 3D. Click any node to isolate traffic.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-300 shrink-0">
          <span>Aggregate Throughput: <strong className="text-[#00F0FF]">{totalThroughput.toLocaleString()} Mbps</strong></span>
          <span aria-hidden="true">·</span>
          <span>Nodes: <strong className="text-slate-100">{nodes.length}</strong></span>
        </div>
      </div>

      {/* Main Split: Full-Viewport 3D Node-Link Graph + Real-Time Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col rounded-xl border border-slate-800/90 bg-[#0D1320] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-[#00F0FF]" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-200">
                Internal Subnet & Endpoint Graph
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span>Nominal: <strong className="text-[#10B981]">Green</strong></span>
              <span>Elevated: <strong className="text-amber-400">Amber</strong></span>
              <span>Alert: <strong className="text-[#EF4444]">Crimson</strong></span>
            </div>
          </div>

          <div className="relative h-[440px] lg:h-[520px] w-full bg-[#090D16]">
            <NetworkTopology3D
              nodes={nodes}
              links={links}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              isSoftwareGl={isSoftwareGl}
            />
          </div>
        </div>

        {/* Side Panel: Bandwidth Throughput & Active Port Statuses */}
        <aside className="lg:col-span-4 flex flex-col gap-5 rounded-xl border border-slate-800/90 bg-[#0D1320] p-5">
          {/* Selected Node Detail or All-Node Bandwidth Bars */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-slate-100">
                {selectedNode ? selectedNode.name : 'Bandwidth Throughput'}
              </h2>
              {selectedNode && (
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  className="inline-flex items-center gap-1 text-xs text-[#00F0FF] hover:underline"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  All Nodes
                </button>
              )}
            </div>

            {selectedNode ? (
              <div className="rounded-lg border border-slate-800 bg-[#090D16] p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">IP Address</span>
                  <span className="font-mono text-[#00F0FF] tabular-nums">{selectedNode.ip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Subnet</span>
                  <span className="font-mono text-slate-200">{selectedNode.subnet}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Throughput</span>
                  <span className="font-mono text-slate-100 tabular-nums">{selectedNode.throughputMbps} Mbps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Links</span>
                  <span className="font-mono text-slate-100 tabular-nums">{selectedConnections.length}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {nodes.slice(0, 5).map((node) => {
                  const pct = Math.min(100, Math.round((node.throughputMbps / 960) * 100));
                  const barColor =
                    node.status === 'alert'
                      ? 'bg-[#EF4444]'
                      : node.status === 'elevated'
                        ? 'bg-amber-400'
                        : 'bg-[#10B981]';
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNodeId(node.id)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300 group-hover:text-[#00F0FF] transition-colors flex items-center gap-1.5">
                          <Server className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                          {node.name}
                        </span>
                        <span className="font-mono text-slate-300 tabular-nums">
                          {node.throughputMbps} Mbps
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Port Statuses */}
          <div className="flex-1 flex flex-col border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-sm font-semibold text-slate-100">
                <Activity className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                Active Port Statuses
              </h3>
              <select
                aria-label="Filter ports by state"
                value={portStateFilter}
                onChange={(e) => setPortStateFilter(e.target.value as ActivePortStatus['state'] | 'All')}
                className="rounded-md border border-slate-700 bg-[#090D16] px-2 py-1 text-xs text-slate-200 focus:border-[#00F0FF] focus:outline-none"
              >
                <option value="All">All States</option>
                <option value="Guarded">Guarded</option>
                <option value="Filtered">Filtered</option>
                <option value="Open">Open</option>
              </select>
            </div>

            <div className="overflow-y-auto max-h-[260px] divide-y divide-slate-800/60 border border-slate-800/80 rounded-lg bg-[#090D16]">
              {visiblePorts.length === 0 ? (
                <p className="p-4 text-xs text-slate-400 text-center">
                  No ports match the active host/state filter.
                </p>
              ) : (
                visiblePorts.map((port) => {
                  const stateColor =
                    port.state === 'Guarded'
                      ? 'text-[#10B981]'
                      : port.state === 'Filtered'
                        ? 'text-amber-400'
                        : 'text-[#00F0FF]';
                  return (
                    <div
                      key={`${port.hostId}-${port.port}`}
                      className="flex items-center justify-between px-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-mono font-semibold text-slate-100 tabular-nums">
                          {port.protocol}/{port.port} · {port.service}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {port.hostName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-semibold ${stateColor}`}>{port.state}</p>
                        <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {port.throughputMbps} Mbps
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
