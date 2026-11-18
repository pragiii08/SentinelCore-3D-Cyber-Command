export type ModuleTab = 'overview' | 'logs' | 'vulnerabilities' | 'network' | 'phishing';

export type LogSeverity = 'Info' | 'Warning' | 'Critical';

export interface SecurityLogEntry {
  id: string;
  timestamp: string;
  bucketIndex: number; // 0..11 time slot for 3D anomaly bar chart
  severity: LogSeverity;
  sourceIp: string;
  destHost: string;
  port: number;
  signature: string;
  message: string;
  action: 'Blocked' | 'Flagged' | 'Allowed';
}

export interface AnomalyBucket {
  label: string;
  infoCount: number;
  warningCount: number;
  criticalCount: number;
  total: number;
}

export type CveSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface VulnerabilityItem {
  id: string;
  cveId: string;
  title: string;
  asset: string;
  severity: CveSeverity;
  cvssScore: number;
  patchAvailable: boolean;
  remediated: boolean;
  discoveredAt: string;
}

export interface RemediationTask {
  id: string;
  title: string;
  targetHost: string;
  severity: CveSeverity;
  impactPoints: number;
  completed: boolean;
  linkedCveId?: string;
}

export type NodeKind = 'firewall' | 'subnet' | 'server' | 'endpoint' | 'sensor';
export type NodeStatus = 'nominal' | 'elevated' | 'alert';

export interface NetworkNode {
  id: string;
  name: string;
  ip: string;
  subnet: string;
  kind: NodeKind;
  status: NodeStatus;
  position: [number, number, number];
  throughputMbps: number;
  packetLossPct: number;
}

export interface NetworkLink {
  id: string;
  sourceId: string;
  targetId: string;
  protocol: string;
  encrypted: boolean;
  anomaly: boolean;
}

export interface ActivePortStatus {
  port: number;
  service: string;
  protocol: 'TCP' | 'UDP';
  hostId: string;
  hostName: string;
  state: 'Open' | 'Filtered' | 'Guarded';
  throughputMbps: number;
}

export interface PhishingCampaign {
  id: string;
  name: string;
  targetGroup: string;
  template: string;
  sent: number;
  opened: number;
  clicked: number;
  reported: number;
  status: 'Active' | 'Completed';
  launchedAt: string;
}

export interface AwarenessModule {
  id: string;
  title: string;
  category: string;
  durationMin: number;
  completed: boolean;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ThreatGlobeNode {
  id: string;
  label: string;
  region: string;
  ip: string;
  lat: number;
  lon: number;
  severity: LogSeverity;
  attackType: string;
  packetsPerSec: number;
  targetModule: ModuleTab;
}

export interface ArchitectureLayer {
  id: string;
  index: number;
  title: string;
  role: string;
  colorHex: string;
  components: string[];
  securityControls: string[];
}

export interface GodsEyeCorrelationResult {
  query: string;
  matchedLogs: SecurityLogEntry[];
  matchedCves: VulnerabilityItem[];
  matchedNodes: NetworkNode[];
  matchedPorts: ActivePortStatus[];
  totalHits: number;
  verdict: 'Critical' | 'Elevated' | 'Nominal';
}

export type GodsEyeLayerFilter = 'all' | 'threats' | 'traffic';
export type GodsEyeSensorMode = 'wireframe' | 'nvg' | 'flir' | 'crt';

export interface GodsEyeThreatArcItem {
  id: string;
  label: string;
  sourceIp: string;
  targetNodeId: string;
  targetHost: string;
  severity: LogSeverity;
  signature: string;
  targetModule: ModuleTab;
}

export interface GodsEyeProjectionSummary {
  totalActiveThreats: number;
  criticalThreatCount: number;
  openCveCount: number;
  totalNodes: number;
  monitoredLinks: number;
  anomalousLinks: number;
  totalBandwidthMbps: number;
  activePhishingDrills: number;
  threatArcs: GodsEyeThreatArcItem[];
}

