export interface AuditRequest {
  spec: string;
  specFormat?: 'yaml' | 'json';
  provider?: string;
  model?: string;
}

export type AuditStatus = 'idle' | 'loading' | 'streaming' | 'complete' | 'error';

export type SeverityLevel = 'CRITICAL' | 'WARNING' | 'INFO';

export interface Finding {
  severity: SeverityLevel;
  title: string;
  category: string;
  location: string;
  issue: string;
  recommendation: string;
}

export interface AuditDimensions {
  security: number;
  restConformance: number;
  schemaCompleteness: number;
  documentationQuality: number;
}

export interface AuditSummary {
  totalFindings: number;
  critical: number;
  warnings: number;
  info: number;
  verdict: string;
  governanceScore: number;
  endpointsAnalyzed: number;
  dimensions: AuditDimensions;
}

export interface AuditState {
  status: AuditStatus;
  result: string;
  findings: Finding[];
  summary: AuditSummary | null;
  error: string | null;
  specFormat: string | null;
}

export interface AuditResult {
  version: 1;
  result?: string;
  findings: Finding[];
  summary: AuditSummary | null;
  exportedAt: string;
  specFormat: string | null;
}
