import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFunnelMetrics,
  calculateSystemHealth,
  computeAnomalyBuckets,
  correlateGodsEye,
  filterCves,
  filterLogs,
  filterNetworkPorts,
  getNodeConnections,
  summarizeCveCounts,
  summarizeGodsEyeProjection,
  validateCampaignInput,
} from './securityLogic';
import type {
  ActivePortStatus,
  NetworkLink,
  NetworkNode,
  PhishingCampaign,
  RemediationTask,
  SecurityLogEntry,
  VulnerabilityItem,
} from '../types/security';

const sampleLogs: SecurityLogEntry[] = [
  {
    id: 'l1',
    timestamp: '22:10:04',
    bucketIndex: 0,
    severity: 'Critical',
    sourceIp: '185.220.101.4',
    destHost: 'db-core-01',
    port: 5432,
    signature: 'SQLi-UNION-Probe',
    message: 'Blocked parameterized SQL injection payload',
    action: 'Blocked',
  },
  {
    id: 'l2',
    timestamp: '22:11:12',
    bucketIndex: 0,
    severity: 'Warning',
    sourceIp: '10.42.4.19',
    destHost: 'auth-gw-02',
    port: 443,
    signature: 'TLS-Cipher-Downgrade',
    message: 'Deprecated TLS 1.1 handshake rejected',
    action: 'Blocked',
  },
  {
    id: 'l3',
    timestamp: '22:12:45',
    bucketIndex: 1,
    severity: 'Info',
    sourceIp: '10.42.1.8',
    destHost: 'siem-collector',
    port: 514,
    signature: 'Syslog-Heartbeat',
    message: 'Routine telemetry sync complete',
    action: 'Allowed',
  },
];

test('filterLogs filters by severity chips and search query', () => {
  assert.equal(filterLogs(sampleLogs, ['Critical'], '').length, 1);
  assert.equal(filterLogs(sampleLogs, ['Critical', 'Warning'], '').length, 2);
  assert.equal(filterLogs(sampleLogs, [], '185.220.').length, 1);
  assert.equal(filterLogs(sampleLogs, [], 'sqli').length, 1);
  assert.equal(filterLogs(sampleLogs, ['Info'], 'sqli').length, 0);
});

test('computeAnomalyBuckets groups severities across time buckets', () => {
  const buckets = computeAnomalyBuckets(sampleLogs, ['T-2', 'T-1', 'Now']);
  assert.equal(buckets.length, 3);
  assert.equal(buckets[0].criticalCount, 1);
  assert.equal(buckets[0].warningCount, 1);
  assert.equal(buckets[0].total, 2);
  assert.equal(buckets[1].infoCount, 1);
  assert.equal(buckets[2].total, 0);
});

const sampleCves: VulnerabilityItem[] = [
  {
    id: 'c1',
    cveId: 'CVE-2026-1042',
    title: 'OpenSSL Buffer Overflow',
    asset: 'edge-fw-01',
    severity: 'Critical',
    cvssScore: 9.8,
    patchAvailable: true,
    remediated: false,
    discoveredAt: '2026-11-16',
  },
  {
    id: 'c2',
    cveId: 'CVE-2026-0891',
    title: 'SSH Weak KEX',
    asset: 'bastion-02',
    severity: 'High',
    cvssScore: 7.5,
    patchAvailable: true,
    remediated: true,
    discoveredAt: '2026-11-15',
  },
];

const sampleTasks: RemediationTask[] = [
  {
    id: 't1',
    title: 'Patch OpenSSL on edge-fw-01',
    targetHost: 'edge-fw-01',
    severity: 'Critical',
    impactPoints: 6,
    completed: false,
    linkedCveId: 'c1',
  },
];

test('summarizeCveCounts, filterCves, and calculateSystemHealth work accurately', () => {
  const counts = summarizeCveCounts(sampleCves);
  assert.equal(counts.Critical.open, 1);
  assert.equal(counts.Critical.total, 1);
  assert.equal(counts.High.open, 0);
  assert.equal(counts.High.total, 1);

  assert.equal(filterCves(sampleCves, 'Critical').length, 1);
  assert.equal(filterCves(sampleCves, 'All').length, 2);

  const initialHealth = calculateSystemHealth(sampleCves, sampleTasks);
  assert.equal(initialHealth, 86);

  const remediatedCves = sampleCves.map((c) => (c.id === 'c1' ? { ...c, remediated: true } : c));
  const completedTasks = sampleTasks.map((t) => ({ ...t, completed: true }));
  const healedHealth = calculateSystemHealth(remediatedCves, completedTasks);
  assert.equal(healedHealth, 100);
});

test('network port filtering and node connection lookup', () => {
  const ports: ActivePortStatus[] = [
    { port: 443, service: 'HTTPS', protocol: 'TCP', hostId: 'fw-1', hostName: 'Edge Firewall', state: 'Guarded', throughputMbps: 420 },
    { port: 22, service: 'SSH', protocol: 'TCP', hostId: 'srv-1', hostName: 'Auth Bastion', state: 'Filtered', throughputMbps: 12 },
  ];
  assert.equal(filterNetworkPorts(ports, 'fw-1', 'All').length, 1);
  assert.equal(filterNetworkPorts(ports, null, 'Filtered').length, 1);

  const links: NetworkLink[] = [
    { id: 'k1', sourceId: 'fw-1', targetId: 'srv-1', protocol: 'TLS', encrypted: true, anomaly: false },
    { id: 'k2', sourceId: 'srv-1', targetId: 'db-1', protocol: 'PGSQL', encrypted: true, anomaly: true },
  ];
  assert.equal(getNodeConnections(links, 'fw-1').length, 1);
  assert.equal(getNodeConnections(links, 'srv-1').length, 2);
});

test('validateCampaignInput and calculateFunnelMetrics enforce rules', () => {
  const invalid = validateCampaignInput({
    name: 'ab',
    targetGroup: '',
    template: '',
    recipientCount: 2,
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.targetGroup);
  assert.ok(invalid.errors.recipientCount);

  const valid = validateCampaignInput({
    name: 'Q4 MFA Reset Drill',
    targetGroup: 'Engineering',
    template: 'SSO Session Expiry',
    recipientCount: 120,
  });
  assert.equal(valid.valid, true);

  const campaigns: PhishingCampaign[] = [
    {
      id: 'p1',
      name: 'Drill 1',
      targetGroup: 'Finance',
      template: 'Wire Verify',
      sent: 200,
      opened: 120,
      clicked: 24,
      reported: 70,
      status: 'Completed',
      launchedAt: '2026-11-10',
    },
  ];
  const funnel = calculateFunnelMetrics(campaigns);
  assert.equal(funnel.sent, 200);
  assert.equal(funnel.openRatePct, 60.0);
  assert.equal(funnel.clickRatePct, 12.0);
  assert.equal(funnel.reportRatePct, 35.0);
});

test('correlateGodsEye matches entities across logs, CVEs, nodes, and ports', () => {
  const nodes: NetworkNode[] = [
    {
      id: 'fw-1',
      name: 'lab-edge-fw-01',
      ip: '10.42.0.1',
      subnet: '10.42.0.0/24',
      kind: 'firewall',
      status: 'elevated',
      position: [0, 0, 0],
      throughputMbps: 900,
      packetLossPct: 0.01,
    },
  ];
  const ports: ActivePortStatus[] = [
    {
      port: 443,
      service: 'HTTPS',
      protocol: 'TCP',
      hostId: 'fw-1',
      hostName: 'lab-edge-fw-01',
      state: 'Guarded',
      throughputMbps: 600,
    },
  ];

  const empty = correlateGodsEye('   ', { logs: sampleLogs, cves: sampleCves, nodes, ports });
  assert.equal(empty.totalHits, 0);
  assert.equal(empty.verdict, 'Nominal');

  const hit = correlateGodsEye('edge-fw-01', { logs: sampleLogs, cves: sampleCves, nodes, ports });
  assert.equal(hit.matchedCves.length, 1);
  assert.equal(hit.matchedNodes.length, 1);
  assert.equal(hit.matchedPorts.length, 1);
  assert.equal(hit.totalHits, 3);
  assert.equal(hit.verdict, 'Critical');
});

test('summarizeGodsEyeProjection aggregates live threats, open CVEs, traffic links, and phishing drills', () => {
  const nodes: NetworkNode[] = [
    {
      id: 'fw-edge',
      name: 'Edge Firewall 01',
      ip: '10.42.0.1',
      subnet: '10.42.0.0/24',
      kind: 'firewall',
      status: 'elevated',
      position: [0, 1.8, 0],
      throughputMbps: 940,
      packetLossPct: 0.04,
    },
    {
      id: 'srv-db',
      name: 'Vault & DB Core',
      ip: '10.42.8.10',
      subnet: '10.42.8.0/24',
      kind: 'server',
      status: 'nominal',
      position: [4.8, -1.0, -1.2],
      throughputMbps: 615,
      packetLossPct: 0.0,
    },
  ];
  const links: NetworkLink[] = [
    { id: 'lnk-1', sourceId: 'fw-edge', targetId: 'srv-db', protocol: 'mTLS', encrypted: true, anomaly: true },
  ];
  const campaigns: PhishingCampaign[] = [
    {
      id: 'camp-1',
      name: 'Active Drill',
      targetGroup: 'Ops',
      template: 'SSO',
      sent: 100,
      opened: 50,
      clicked: 10,
      reported: 40,
      status: 'Active',
      launchedAt: '2026-11-17',
    },
  ];

  const summary = summarizeGodsEyeProjection({
    logs: sampleLogs,
    cves: sampleCves,
    nodes,
    links,
    campaigns,
  });

  assert.equal(summary.totalActiveThreats, 2);
  assert.equal(summary.criticalThreatCount, 1);
  assert.equal(summary.openCveCount, 1);
  assert.equal(summary.totalNodes, 2);
  assert.equal(summary.monitoredLinks, 1);
  assert.equal(summary.anomalousLinks, 1);
  assert.equal(summary.totalBandwidthMbps, 1555);
  assert.equal(summary.activePhishingDrills, 1);
  assert.equal(summary.threatArcs.length, 2);
  assert.equal(summary.threatArcs[0].targetNodeId, 'srv-db');
});

