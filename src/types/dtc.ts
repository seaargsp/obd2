export interface DTCRecord {
  code: string; // e.g., P0300
  description?: string;
  timestamp?: number;
  severity?: 'info' | 'warn' | 'error';
}
