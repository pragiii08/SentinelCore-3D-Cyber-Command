/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CapstoneDeliverablesSection } from './components/CapstoneDeliverablesSection';
import { TopNav } from './components/TopNav';
import { OverviewView } from './components/views/OverviewView';

const LogAnalyzerView = lazy(() =>
  import('./components/views/LogAnalyzerView').then((m) => ({ default: m.LogAnalyzerView })),
);
const VulnerabilityView = lazy(() =>
  import('./components/views/VulnerabilityView').then((m) => ({ default: m.VulnerabilityView })),
);
const NetworkMonitorView = lazy(() =>
  import('./components/views/NetworkMonitorView').then((m) => ({ default: m.NetworkMonitorView })),
);
const PhishingSimulatorView = lazy(() =>
  import('./components/views/PhishingSimulatorView').then((m) => ({ default: m.PhishingSimulatorView })),
);
const GodsEyeOverlay = lazy(() =>
  import('./components/GodsEyeOverlay').then((m) => ({ default: m.GodsEyeOverlay })),
);
import {
  ARCHITECTURE_LAYERS,
  INITIAL_AWARENESS_MODULES,
  INITIAL_CAMPAIGNS,
  INITIAL_CVES,
  INITIAL_LOGS,
  INITIAL_PORTS,
  INITIAL_REMEDIATION_TASKS,
  NETWORK_LINKS,
  NETWORK_NODES,
  STREAM_SIMULATION_LOGS,
  THREAT_GLOBE_NODES,
} from './data/seedData';
import type {
  AwarenessModule,
  ModuleTab,
  PhishingCampaign,
  RemediationTask,
  SecurityLogEntry,
  VulnerabilityItem,
} from './types/security';
import { calculateFunnelMetrics, calculateSystemHealth } from './utils/securityLogic';
import { detectSoftwareGl } from './utils/threeHelpers';

export default function App() {
  const isSoftwareGl = useMemo(() => detectSoftwareGl(), []);

  const [activeTab, setActiveTab] = useState<ModuleTab>('overview');
  const [godsEyeOverlayOpen, setGodsEyeOverlayOpen] = useState<boolean>(false);
  const [logs, setLogs] = useState<SecurityLogEntry[]>(INITIAL_LOGS);
  const [streamPaused, setStreamPaused] = useState<boolean>(false);
  const streamIdxRef = useRef(0);

  const [cves, setCves] = useState<VulnerabilityItem[]>(INITIAL_CVES);
  const [tasks, setTasks] = useState<RemediationTask[]>(INITIAL_REMEDIATION_TASKS);
  const [campaigns, setCampaigns] = useState<PhishingCampaign[]>(INITIAL_CAMPAIGNS);
  const [awarenessModules, setAwarenessModules] = useState<AwarenessModule[]>(
    INITIAL_AWARENESS_MODULES,
  );

  useEffect(() => {
    if (!godsEyeOverlayOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGodsEyeOverlayOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [godsEyeOverlayOpen]);

  // Live deterministic log simulation feed
  useEffect(() => {
    if (streamPaused) return;
    const interval = window.setInterval(() => {
      const template =
        STREAM_SIMULATION_LOGS[streamIdxRef.current % STREAM_SIMULATION_LOGS.length];
      streamIdxRef.current += 1;
      const now = new Date();
      const ts = now.toTimeString().slice(0, 8);
      const nextEntry: SecurityLogEntry = {
        ...template,
        id: `log-live-${Date.now()}-${streamIdxRef.current}`,
        timestamp: ts,
      };
      setLogs((prev) => [nextEntry, ...prev].slice(0, 48));
    }, 4500);

    return () => window.clearInterval(interval);
  }, [streamPaused]);

  const handleToggleTask = useCallback((taskId: string) => {
    setTasks((prevTasks) => {
      const target = prevTasks.find((t) => t.id === taskId);
      const nextCompleted = target ? !target.completed : true;
      if (target?.linkedCveId) {
        setCves((prevCves) =>
          prevCves.map((c) =>
            c.id === target.linkedCveId ? { ...c, remediated: nextCompleted } : c,
          ),
        );
      }
      return prevTasks.map((t) =>
        t.id === taskId ? { ...t, completed: nextCompleted } : t,
      );
    });
  }, []);

  const handleToggleCveRemediated = useCallback((cveId: string) => {
    setCves((prevCves) => {
      const target = prevCves.find((c) => c.id === cveId);
      const nextState = target ? !target.remediated : true;
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.linkedCveId === cveId ? { ...t, completed: nextState } : t,
        ),
      );
      return prevCves.map((c) =>
        c.id === cveId ? { ...c, remediated: nextState } : c,
      );
    });
  }, []);

  const handleLaunchCampaign = useCallback((campaign: PhishingCampaign) => {
    setCampaigns((prev) => [campaign, ...prev]);
  }, []);

  const handleCompleteModule = useCallback((moduleId: string) => {
    setAwarenessModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, completed: true } : m)),
    );
  }, []);

  const handleOpenArchitecture = useCallback(() => {
    const el = document.getElementById('capstone-architecture');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleNavigateModule = useCallback((tab: ModuleTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const systemHealthScore = useMemo(
    () => calculateSystemHealth(cves, tasks),
    [cves, tasks],
  );
  const criticalAlertsCount = useMemo(
    () => logs.filter((l) => l.severity === 'Critical').length,
    [logs],
  );
  const funnelMetrics = useMemo(
    () => calculateFunnelMetrics(campaigns),
    [campaigns],
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#090D16] text-slate-100">
      <TopNav
        activeTab={activeTab}
        onSelectTab={handleNavigateModule}
        onOpenArchitecture={handleOpenArchitecture}
        godsEyeOpen={godsEyeOverlayOpen}
        onToggleGodsEye={() => setGodsEyeOverlayOpen((prev) => !prev)}
      />

      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense
              fallback={
                <div className="min-h-[480px] rounded-xl border border-slate-800/80 bg-[#0D1320] p-6 text-xs text-slate-400">
                  Loading module telemetry...
                </div>
              }
            >
              {activeTab === 'overview' && (
                <OverviewView
                  threatNodes={THREAT_GLOBE_NODES}
                  logs={logs}
                  cves={cves}
                  nodes={NETWORK_NODES}
                  ports={INITIAL_PORTS}
                  onNavigateModule={handleNavigateModule}
                  totalLogsCount={logs.length}
                  criticalAlertsCount={criticalAlertsCount}
                  systemHealthScore={systemHealthScore}
                  activePortsCount={INITIAL_PORTS.length}
                  phishingClickRatePct={funnelMetrics.clickRatePct}
                  isSoftwareGl={isSoftwareGl}
                />
              )}

              {activeTab === 'logs' && (
                <LogAnalyzerView
                  logs={logs}
                  streamPaused={streamPaused}
                  onToggleStream={() => setStreamPaused((p) => !p)}
                  isSoftwareGl={isSoftwareGl}
                />
              )}

              {activeTab === 'vulnerabilities' && (
                <VulnerabilityView
                  cves={cves}
                  tasks={tasks}
                  onToggleTask={handleToggleTask}
                  onToggleCveRemediated={handleToggleCveRemediated}
                  isSoftwareGl={isSoftwareGl}
                />
              )}

              {activeTab === 'network' && (
                <NetworkMonitorView
                  nodes={NETWORK_NODES}
                  links={NETWORK_LINKS}
                  ports={INITIAL_PORTS}
                  isSoftwareGl={isSoftwareGl}
                />
              )}

              {activeTab === 'phishing' && (
                <PhishingSimulatorView
                  campaigns={campaigns}
                  onLaunchCampaign={handleLaunchCampaign}
                  modules={awarenessModules}
                  onCompleteModule={handleCompleteModule}
                  isSoftwareGl={isSoftwareGl}
                />
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <CapstoneDeliverablesSection
        layers={ARCHITECTURE_LAYERS}
        isSoftwareGl={isSoftwareGl}
      />

      {godsEyeOverlayOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060A12]/80 text-xs font-mono text-[#00F0FF]">
              Initializing God&apos;s Eye 3D wireframe projection...
            </div>
          }
        >
          <GodsEyeOverlay
            activeTab={activeTab}
            logs={logs}
            cves={cves}
            nodes={NETWORK_NODES}
            links={NETWORK_LINKS}
            campaigns={campaigns}
            onClose={() => setGodsEyeOverlayOpen(false)}
            onJumpToModule={handleNavigateModule}
            isSoftwareGl={isSoftwareGl}
          />
        </Suspense>
      )}
    </div>
  );
}
