import { Pause, Play, RotateCcw, Search, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ANOMALY_BUCKET_LABELS } from '../../data/seedData';
import type { LogSeverity, SecurityLogEntry } from '../../types/security';
import { computeAnomalyBuckets, filterLogs } from '../../utils/securityLogic';
import { LogAnomaly3DBars } from '../scenes/LogAnomaly3DBars';

interface LogAnalyzerViewProps {
  logs: SecurityLogEntry[];
  streamPaused: boolean;
  onToggleStream: () => void;
  isSoftwareGl: boolean;
}

const SEVERITIES: LogSeverity[] = ['Info', 'Warning', 'Critical'];

export function LogAnalyzerView({
  logs,
  streamPaused,
  onToggleStream,
  isSoftwareGl,
}: LogAnalyzerViewProps) {
  const [activeSeverities, setActiveSeverities] = useState<LogSeverity[]>(['Info', 'Warning', 'Critical']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);

  const buckets = useMemo(
    () => computeAnomalyBuckets(logs, ANOMALY_BUCKET_LABELS),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const base = filterLogs(logs, activeSeverities, searchQuery);
    if (selectedBucket === null) return base;
    return base.filter((entry) => entry.bucketIndex === selectedBucket);
  }, [logs, activeSeverities, searchQuery, selectedBucket]);

  const toggleSeverity = (sev: LogSeverity) => {
    setActiveSeverities((prev) =>
      prev.includes(sev) ? prev.filter((item) => item !== sev) : [...prev, sev],
    );
  };

  const resetFilters = () => {
    setActiveSeverities(['Info', 'Warning', 'Critical']);
    setSearchQuery('');
    setSelectedBucket(null);
  };

  return (
    <section aria-labelledby="log-analyzer-heading" className="space-y-6">
      {/* Header & Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1
            id="log-analyzer-heading"
            className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-slate-50"
          >
            Log Analyzer & Anomaly Telemetry
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspect live SIEM security events, parse IP addresses or signatures, and isolate anomaly spikes in 3D.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleStream}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              streamPaused
                ? 'border-amber-500/45 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                : 'border-[#10B981]/45 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20'
            }`}
          >
            {streamPaused ? (
              <>
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Resume Stream
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                Pause Stream
              </>
            )}
          </button>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1320] px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset Filters
          </button>
        </div>
      </div>

      {/* 3D Anomaly Spike Bar Chart */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0D1320] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold text-slate-100">
              3D Anomaly Spike Distribution
            </h2>
            <p className="text-xs text-slate-400">
              {selectedBucket !== null
                ? `Filtered to time bucket: ${ANOMALY_BUCKET_LABELS[selectedBucket]} (click bar again to clear)`
                : 'Click any 3D column to filter terminal logs by time window'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#00F0FF]" aria-hidden="true" />
              Info
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-amber-400" aria-hidden="true" />
              Warning
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#EF4444]" aria-hidden="true" />
              Critical
            </span>
          </div>
        </div>

        <div className="h-[240px] w-full rounded-lg border border-slate-800/80 bg-[#0B101B]">
          <LogAnomaly3DBars
            buckets={buckets}
            selectedBucketIndex={selectedBucket}
            onSelectBucket={setSelectedBucket}
            isSoftwareGl={isSoftwareGl}
          />
        </div>
      </div>

      {/* Filter Bar + Terminal Stream */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0D1320] overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 p-4">
          {/* Interactive Severity Filter Chips */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter logs by severity">
            {SEVERITIES.map((sev) => {
              const active = activeSeverities.includes(sev);
              const activeStyle =
                sev === 'Critical'
                  ? 'border-[#EF4444]/60 bg-[#EF4444]/15 text-[#FCA5A5]'
                  : sev === 'Warning'
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                    : 'border-[#00F0FF]/60 bg-[#00F0FF]/15 text-[#7CF7FF]';
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => toggleSeverity(sev)}
                  aria-pressed={active}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? activeStyle
                      : 'border-slate-700 bg-[#090D16] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sev}
                </button>
              );
            })}
            <span className="ml-2 font-mono text-xs text-slate-400 tabular-nums">
              Showing {filteredLogs.length} of {logs.length} events
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative w-full lg:w-80">
            <label htmlFor="log-search-input" className="sr-only">
              Search IP addresses or threat signatures
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="log-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search IP (185.220...), host, or SQLi..."
              className="w-full rounded-lg border border-slate-700 bg-[#090D16] py-2 pl-9 pr-3 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
            />
          </div>
        </div>

        {/* Terminal Stream Table */}
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Terminal className="h-8 w-8 text-slate-500 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-200">No matching security events</p>
            <p className="text-xs text-slate-400 mt-1">
              Adjust active severity chips, time bucket filter, or search query.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-lg border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-4 py-2 text-xs font-semibold text-[#00F0FF] hover:bg-[#00F0FF]/20"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full border-collapse text-left font-mono text-xs">
              <thead className="sticky top-0 bg-[#0B101B] text-[11px] text-slate-400 border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Time</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Severity</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Source IP</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Target Host</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Signature</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Payload Detail</th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((entry) => {
                  const sevText =
                    entry.severity === 'Critical'
                      ? 'text-[#EF4444]'
                      : entry.severity === 'Warning'
                        ? 'text-amber-400'
                        : 'text-[#00F0FF]';
                  const actionText =
                    entry.action === 'Blocked'
                      ? 'text-[#10B981]'
                      : entry.action === 'Flagged'
                        ? 'text-amber-400'
                        : 'text-slate-400';
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-800/35 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-slate-400 tabular-nums whitespace-nowrap">
                        {entry.timestamp}
                      </td>
                      <td className={`px-4 py-2.5 font-semibold whitespace-nowrap ${sevText}`}>
                        {entry.severity}
                      </td>
                      <td className="px-4 py-2.5 text-[#00F0FF] tabular-nums whitespace-nowrap">
                        {entry.sourceIp}
                      </td>
                      <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">
                        {entry.destHost}:{entry.port}
                      </td>
                      <td className="px-4 py-2.5 text-slate-100 whitespace-nowrap">
                        {entry.signature}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 max-w-md truncate">
                        {entry.message}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${actionText}`}>
                        {entry.action}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
