export type OBDMode = 0x01 | 0x02 | 0x03 | 0x04 | 0x09;

export interface PIDDefinition {
  mode: OBDMode;
  pid: number; // 0x00-0xFF
  name: string;
  unit?: string;
  bytes: number; // expected data bytes (without mode/pid header)
  formula?: (bytes: number[]) => number | string | PIDComplex;
}

export interface PIDComplex {
  [key: string]: number | string | boolean;
}

export interface PIDGroup {
  id: string;
  title: string;
  pids: { mode: OBDMode; pid: number }[];
}

export interface OBD2Response {
  success: boolean;
  raw: string;
  bytes: number[];
  mode?: OBDMode;
  pid?: number;
  value?: number | string | PIDComplex;
  error?: string;
}

export interface LiveSample {
  timestamp: number;
  key: string; // `${mode}:${pid}`
  value: number | string | PIDComplex;
}
