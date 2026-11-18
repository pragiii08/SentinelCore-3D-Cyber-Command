import type {
  ActivePortStatus,
  AnomalyBucket,
  CveSeverity,
  GodsEyeCorrelationResult,
  GodsEyeProjectionSummary,
  GodsEyeThreatArcItem,
  LogSeverity,
  NetworkLink,
  NetworkNode,
  PhishingCampaign,
  RemediationTask,
  SecurityLogEntry,
  VulnerabilityItem,
} from '../types/security';

/**
 * Filter log entries by selected severity chips and IP/signature search query.
 */
export function filterLogs(
  logs: SecurityLogEntry[],
  activeSeverities: LogSeverity[],
  searchQuery: string,
): SecurityLogEntry[] {
  const query = searchQuery.trim().toLowerCase();
  const severitySet = new Set(activeSeverities);

  return logs.filter((entry) => {
    if (severitySet.size > 0 && !severitySet.has(entry.severity)) {
      return false;
    }
    if (!query) return true;
    return (
      entry.sourceIp.toLowerCase().includes(query) ||
      entry.destHost.toLowerCase().includes(query) ||
      entry.signature.toLowerCase().includes(query) ||
      entry.message.toLowerCase().includes(query) ||
      String(entry.port).includes(query)
    );
  });
}

/**
 * Aggregate logs into 12 chronological buckets for the 3D anomaly bar chart.
 */
export function computeAnomalyBuckets(
  logs: SecurityLogEntry[],
  labels: string[],
): AnomalyBucket[] {
  const buckets: AnomalyBucket[] = labels.map((label) => ({
    label,
    infoCount: 0,
    warningCount: 0,
    criticalCount: 0,
    total: 0,
  }));

  for (const log of logs) {
    const idx = Math.max(0, Math.min(buckets.length - 1, log.bucketIndex));
    const bucket = buckets[idx];
    if (!bucket) continue;
    if (log.severity === 'Critical') bucket.criticalCount += 1;
    else if (log.severity === 'Warning') bucket.warningCount += 1;
    else bucket.infoCount += 1;
    bucket.total += 1;
  }

  return buckets;
}

/**
 * Count CVEs grouped by severity (distinguishing open vs remediated).
 */
export function summarizeCveCounts(
  cves: VulnerabilityItem[],
): Record<CveSeverity, { open: number; total: number }> {
  const summary: Record<CveSeverity, { open: number; total: number }> = {
    Critical: { open: 0, total: 0 },
    High: { open: 0, total: 0 },
    Medium: { open: 0, total: 0 },
    Low: { open: 0, total: 0 },
  };

  for (const cve of cves) {
    summary[cve.severity].total += 1;
    if (!cve.remediated) {
      summary[cve.severity].open += 1;
    }
  }

  return summary;
}

/**
 * Filter CVE list by optional severity selection.
 */
export function filterCves(
  cves: VulnerabilityItem[],
  severity: CveSeverity | 'All',
): VulnerabilityItem[] {
  if (severity === 'All') return cves;
  return cves.filter((item) => item.severity === severity);
}

/**
 * Compute overall system health score (0-100) based on open CVEs and completed remediation tasks.
 */
export function calculateSystemHealth(
  cves: VulnerabilityItem[],
  tasks: RemediationTask[],
): number {
  const weights: Record<CveSeverity, number> = {
    Critical: 14,
    High: 8,
    Medium: 4,
    Low: 1.5,
  };

  let penalty = 0;
  for (const cve of cves) {
    if (!cve.remediated) {
      penalty += weights[cve.severity];
    }
  }

  let bonus = 0;
  for (const task of tasks) {
    if (task.completed) {
      bonus += task.impactPoints;
    }
  }

  const raw = 100 - penalty + bonus;
  return Math.max(12, Math.min(100, Math.round(raw)));
}

/**
 * Filter active port status rows by selected host ID or search term.
 */
export function filterNetworkPorts(
  ports: ActivePortStatus[],
  selectedHostId: string | null,
  stateFilter: ActivePortStatus['state'] | 'All',
): ActivePortStatus[] {
  return ports.filter((p) => {
    if (selectedHostId && p.hostId !== selectedHostId) return false;
    if (stateFilter !== 'All' && p.state !== stateFilter) return false;
    return true;
  });
}

/**
 * Return links directly connected to a network node.
 */
export function getNodeConnections(
  links: NetworkLink[],
  nodeId: string,
): NetworkLink[] {
  return links.filter((l) => l.sourceId === nodeId || l.targetId === nodeId);
}

export interface CampaignDraftInput {
  name: string;
  targetGroup: string;
  template: string;
  recipientCount: number;
}

export interface CampaignValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof CampaignDraftInput, string>>;
}

/**
 * Validate phishing simulation campaign builder inputs (no silent fallbacks).
 */
export function validateCampaignInput(
  input: CampaignDraftInput,
): CampaignValidationResult {
  const errors: Partial<Record<keyof CampaignDraftInput, string>> = {};

  if (!input.name.trim() || input.name.trim().length < 3) {
    errors.name = 'Campaign name must be at least 3 characters.';
  }
  if (!input.targetGroup.trim()) {
    errors.targetGroup = 'Select a target department or cohort.';
  }
  if (!input.template.trim()) {
    errors.template = 'Select a phishing scenario template.';
  }
  if (!Number.isFinite(input.recipientCount) || input.recipientCount < 5 || input.recipientCount > 2500) {
    errors.recipientCount = 'Recipient count must be between 5 and 2,500.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface FunnelMetrics {
  sent: number;
  opened: number;
  clicked: number;
  reported: number;
  openRatePct: number;
  clickRatePct: number;
  reportRatePct: number;
}

/**
 * Aggregate campaign metrics for the 3D Phishing Funnel visualization.
 */
export function calculateFunnelMetrics(campaigns: PhishingCampaign[]): FunnelMetrics {
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.sent += c.sent;
      acc.opened += c.opened;
      acc.clicked += c.clicked;
      acc.reported += c.reported;
      return acc;
    },
    { sent: 0, opened: 0, clicked: 0, reported: 0 },
  );

  const safeSent = totals.sent || 1;
  return {
    ...totals,
    openRatePct: Number(((totals.opened / safeSent) * 100).toFixed(1)),
    clickRatePct: Number(((totals.clicked / safeSent) * 100).toFixed(1)),
    reportRatePct: Number(((totals.reported / safeSent) * 100).toFixed(1)),
  };
}

/**
 * God's Eye cross-domain correlation across SIEM logs, CVEs, network nodes, and active ports.
 */
export function correlateGodsEye(
  rawQuery: string,
  sources: {
    logs: SecurityLogEntry[];
    cves: VulnerabilityItem[];
    nodes: NetworkNode[];
    ports: ActivePortStatus[];
  },
): GodsEyeCorrelationResult {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return {
      query: '',
      matchedLogs: [],
      matchedCves: [],
      matchedNodes: [],
      matchedPorts: [],
      totalHits: 0,
      verdict: 'Nominal',
    };
  }

  const matchedLogs = sources.logs.filter(
    (l) =>
      l.sourceIp.toLowerCase().includes(query) ||
      l.destHost.toLowerCase().includes(query) ||
      l.signature.toLowerCase().includes(query) ||
      l.message.toLowerCase().includes(query) ||
      String(l.port).includes(query),
  );

  const matchedCves = sources.cves.filter(
    (c) =>
      c.cveId.toLowerCase().includes(query) ||
      c.title.toLowerCase().includes(query) ||
      c.asset.toLowerCase().includes(query) ||
      c.severity.toLowerCase().includes(query),
  );

  const matchedNodes = sources.nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(query) ||
      n.ip.toLowerCase().includes(query) ||
      n.subnet.toLowerCase().includes(query) ||
      n.kind.toLowerCase().includes(query),
  );

  const matchedPorts = sources.ports.filter(
    (p) =>
      p.hostName.toLowerCase().includes(query) ||
      p.service.toLowerCase().includes(query) ||
      String(p.port).includes(query),
  );

  const totalHits =
    matchedLogs.length + matchedCves.length + matchedNodes.length + matchedPorts.length;

  const hasCritical =
    matchedLogs.some((l) => l.severity === 'Critical') ||
    matchedCves.some((c) => !c.remediated && c.severity === 'Critical') ||
    matchedNodes.some((n) => n.status === 'alert');

  const hasElevated =
    matchedLogs.some((l) => l.severity === 'Warning') ||
    matchedCves.some((c) => !c.remediated && c.severity === 'High') ||
    matchedNodes.some((n) => n.status === 'elevated');

  const verdict: GodsEyeCorrelationResult['verdict'] = hasCritical
    ? 'Critical'
    : hasElevated
      ? 'Elevated'
      : 'Nominal';

  return {
    query: rawQuery.trim(),
    matchedLogs,
    matchedCves,
    matchedNodes,
    matchedPorts,
    totalHits,
    verdict,
  };
}

function resolveThreatTargetNodeId(destHost: string, nodes: NetworkNode[]): string {
  const lower = destHost.toLowerCase();
  if (lower.includes('db-core') || lower.includes('vault')) {
    return nodes.find((n) => n.id === 'srv-db')?.id ?? nodes[0]?.id ?? 'fw-edge';
  }
  if (lower.includes('api-gw') || lower.includes('iam')) {
    return nodes.find((n) => n.id === 'srv-api')?.id ?? nodes[0]?.id ?? 'fw-edge';
  }
  if (lower.includes('web-dmz')) {
    return nodes.find((n) => n.id === 'srv-web')?.id ?? nodes[0]?.id ?? 'fw-edge';
  }
  if (lower.includes('siem')) {
    return nodes.find((n) => n.id === 'sen-siem')?.id ?? nodes[0]?.id ?? 'fw-edge';
  }
  if (lower.includes('mail')) {
    return nodes.find((n) => n.id === 'sub-dmz')?.id ?? nodes[0]?.id ?? 'fw-edge';
  }
  if (lower.includes('k8s')) {
    return nodes.find((n) => n.id === 'sub-core')?.id ?? nodes[0]?.id ?? 'fw-edge';
  }
  return nodes.find((n) => n.id === 'fw-edge')?.id ?? nodes[0]?.id ?? 'fw-edge';
}

/**
 * Aggregate live threats, open CVEs, network traffic, and phishing drills for the global God's Eye 3D projection.
 */
export function summarizeGodsEyeProjection(sources: {
  logs: SecurityLogEntry[];
  cves: VulnerabilityItem[];
  nodes: NetworkNode[];
  links: NetworkLink[];
  campaigns: PhishingCampaign[];
}): GodsEyeProjectionSummary {
  const activeAlertLogs = sources.logs.filter(
    (l) => l.severity === 'Critical' || l.severity === 'Warning',
  );
  const criticalThreatCount = activeAlertLogs.filter((l) => l.severity === 'Critical').length;
  const openCveCount = sources.cves.filter((c) => !c.remediated).length;
  const anomalousLinks = sources.links.filter((l) => l.anomaly).length;
  const totalBandwidthMbps = sources.nodes.reduce((sum, n) => sum + n.throughputMbps, 0);
  const activePhishingDrills = sources.campaigns.filter((c) => c.status === 'Active').length;

  const seenSignatures = new Set<string>();
  const threatArcs: GodsEyeThreatArcItem[] = [];

  for (const log of activeAlertLogs) {
    const dedupeKey = `${log.sourceIp}-${log.destHost}-${log.signature}`;
    if (seenSignatures.has(dedupeKey)) continue;
    seenSignatures.add(dedupeKey);

    threatArcs.push({
      id: log.id,
      label: `${log.signature} -> ${log.destHost}`,
      sourceIp: log.sourceIp,
      targetNodeId: resolveThreatTargetNodeId(log.destHost, sources.nodes),
      targetHost: log.destHost,
      severity: log.severity,
      signature: log.signature,
      targetModule:
        log.signature.includes('CVE-')
          ? 'vulnerabilities'
          : log.signature.includes('DMARC') || log.signature.includes('SPF')
            ? 'phishing'
            : 'logs',
    });

    if (threatArcs.length >= 8) break;
  }

  return {
    totalActiveThreats: activeAlertLogs.length,
    criticalThreatCount,
    openCveCount,
    totalNodes: sources.nodes.length,
    monitoredLinks: sources.links.length,
    anomalousLinks,
    totalBandwidthMbps,
    activePhishingDrills,
    threatArcs,
  };
}

