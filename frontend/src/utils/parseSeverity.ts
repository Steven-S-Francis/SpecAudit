import type { SeverityLevel } from '../types/audit';

export function parseSeverity(text: string): SeverityLevel | null {
  if (text.includes('[CRITICAL]')) return 'CRITICAL';
  if (text.includes('[WARNING]'))  return 'WARNING';
  if (text.includes('[INFO]'))     return 'INFO';
  return null;
}
