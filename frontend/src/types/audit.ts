export interface AuditRequest {
  spec: string;
  specFormat?: 'yaml' | 'json';
}

export type AuditStatus = 'idle' | 'loading' | 'streaming' | 'complete' | 'error';

export interface AuditState {
  status: AuditStatus;
  result: string;
  error: string | null;
  specFormat: string | null;
}

export interface AuditResult {
  version: 1;
  result: string;
  exportedAt: string;
  specFormat: string | null;
}

export type SeverityLevel = 'CRITICAL' | 'WARNING' | 'INFO';
