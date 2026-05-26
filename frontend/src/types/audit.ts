export interface AuditRequest {
  spec: string;
  specFormat?: 'yaml' | 'json';
}

export type AuditStatus = 'idle' | 'loading' | 'streaming' | 'complete' | 'error';

export interface AuditState {
  status: AuditStatus;
  result: string;
  error: string | null;
}

export type SeverityLevel = 'CRITICAL' | 'WARNING' | 'INFO';
