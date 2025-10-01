import { PID_DEFINITIONS } from '../data/pidDefinitions';
import { OBD2Response, OBDMode } from '../types/obd2';
import { parseAsciiHexToBytes, stripPrompt } from '../utils/hex';
import SimpleEventEmitter from '../utils/SimpleEventEmitter';
import BluetoothAdapter from './BluetoothAdapter';

type ClientEvents = {
  'data': OBD2Response;
  'error': { message: string };
  'connected': true;
  'disconnected': true;
  'supported:update': { mode: OBDMode; pids: number[] };
};

class OBD2Client extends SimpleEventEmitter<ClientEvents> {
  private static instance: OBD2Client;
  private bt = BluetoothAdapter.getInstance();
  private buffer: string = '';
  private queue: { cmd: string; resolve: (r: OBD2Response) => void; reject: (e: any) => void; timeout: any; parser: (raw: string) => OBD2Response }[] = [];
  private busy = false;
  private supported = new Map<OBDMode, Set<number>>();
  private initialized = false;

  private constructor() {
    super();
    this.bt.on('data', (chunk: string) => this.onData(chunk));
    // Bridge underlying BT events
    this.bt.on('connected', async () => {
      try {
        if (!this.initialized) {
          await this.initializeELM327();
          await this.refreshSupportedPIDs(0x01);
          this.initialized = true;
        }
        this.emit('connected', true);
      } catch (e: any) {
        this.emit('error', { message: e?.message ?? 'Initialization failed' });
      }
    });
    this.bt.on('disconnected', () => {
      this.onDisconnected();
      this.emit('disconnected', true);
    });
  }

  static getInstance() {
    if (!this.instance) this.instance = new OBD2Client();
    return this.instance;
  }

  async connect(address: string) {
    const ok = await this.bt.ensurePermissions();
    if (!ok) throw new Error('Bluetooth permissions not granted');
    const connected = await this.bt.connect(address);
    if (!connected) throw new Error('Bluetooth connect failed');
    await this.initializeELM327();
    await this.refreshSupportedPIDs(0x01);
    this.initialized = true;
    this.emit('connected', true);
  }

  async disconnect() { await this.bt.disconnect(); }

  private delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }

  private async initializeELM327() {
    const cmds = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATSP0'];
    for (const c of cmds) {
      await this.writeAndWait(c, 1000);
      await this.delay(100);
    }
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    // Responses end with '>' prompt
    if (this.buffer.includes('>')) {
      const raw = this.buffer;
      this.buffer = '';
      const current = this.queue.shift();
      if (!current) return;
      clearTimeout(current.timeout);
      try {
        const resp = current.parser(raw);
        current.resolve(resp);
        this.emit('data', resp);
      } catch (e: any) {
        current.reject(e);
        this.emit('error', { message: e?.message ?? 'Parse error' });
      } finally {
        this.busy = false;
        this.processQueue();
      }
    }
  }

  private processQueue() {
    if (this.busy) return;
    const next = this.queue[0];
    if (!next) return;
    this.busy = true;
    try {
      if (this.bt.connectionState !== 'connected') {
        throw new Error('Not connected');
      }
      this.bt.write(next.cmd + '\r');
    } catch (e: any) {
      // Synchronously failed to write; reject and move on
      clearTimeout(next.timeout);
      this.queue.shift();
      this.busy = false;
      next.reject(e);
      this.emit('error', { message: e?.message ?? 'Write failed' });
      // Attempt to continue with any remaining queued commands
      setTimeout(() => this.processQueue(), 0);
    }
  }

  private writeAndWait(command: string, timeoutMs = 5000): Promise<OBD2Response> {
    if (this.bt.connectionState !== 'connected') {
      return Promise.reject(new Error('Not connected'));
    }
    return new Promise((resolve, reject) => {
      const parser = (raw: string): OBD2Response => {
        const cleaned = stripPrompt(raw);
        const bytes = parseAsciiHexToBytes(cleaned);
        const resp: OBD2Response = { success: true, raw, bytes };
        return resp;
      };
      const timeout = setTimeout(() => {
        const idx = this.queue.findIndex(q => q.cmd === command);
        if (idx >= 0) this.queue.splice(idx, 1);
        this.busy = false;
        reject(new Error('Timeout: ' + command));
      }, timeoutMs);
      this.queue.push({ cmd: command, resolve, reject, timeout, parser });
      this.processQueue();
    });
  }

  private onDisconnected() {
    // Reject all pending requests
    const pending = this.queue.splice(0, this.queue.length);
    for (const q of pending) {
      clearTimeout(q.timeout);
      try { q.reject(new Error('Disconnected')); } catch {}
    }
    this.busy = false;
    this.buffer = '';
    this.initialized = false;
  }

  // Supported PID detection for Mode 01 based on SAE J1979 bitmasks
  async refreshSupportedPIDs(mode: OBDMode = 0x01): Promise<number[]> {
    if (mode !== 0x01) return [];
    const collected = new Set<number>();
    const ranges = [0x00, 0x20, 0x40, 0x60, 0x80, 0xA0, 0xC0, 0xE0];
    let idx = 0;
    let continueNext = true;
    while (idx < ranges.length && continueNext) {
      const base = ranges[idx];
      const resp = await this.query(0x01, base);
      if (!resp.success) break;
      const data = resp.bytes.slice(2); // remove 0x41, pid
      // need 4 data bytes
      if (data.length < 4) break;
      // Check each bit: MSB of first byte corresponds to base+1
      for (let byte = 0; byte < 4; byte++) {
        const val = data[byte];
        for (let bit = 0; bit < 8; bit++) {
          const mask = 1 << (7 - bit);
          if (val & mask) {
            const pid = base + (byte * 8 + bit) + 1;
            collected.add(pid);
          }
        }
      }
      // Last bit (of last byte) indicates availability of the next 0x20 range
      const lastByte = data[3];
      const nextSupported = (lastByte & 0x01) === 0x01; // LSB of last byte
      continueNext = nextSupported;
      idx += 1;
    }
    this.supported.set(0x01, collected);
    this.emit('supported:update', { mode: 0x01, pids: Array.from(collected).sort((a,b)=>a-b) });
    return Array.from(collected);
  }

  isSupported(mode: OBDMode, pid: number): boolean {
    const set = this.supported.get(mode);
    return !!set && set.has(pid);
  }

  getSupported(mode: OBDMode): number[] {
    return Array.from(this.supported.get(mode) ?? []);
  }

  isConnected(): boolean {
    return this.bt.connectionState === 'connected';
  }

  // High-level OBD helpers
  async query(mode: OBDMode, pid: number): Promise<OBD2Response> {
    if (this.bt.connectionState !== 'connected') {
      return { success: false, raw: '', bytes: [], mode, pid, error: 'Not connected' };
    }
    const cmd = `${mode.toString(16).padStart(2, '0')} ${pid.toString(16).padStart(2, '0')}`.toUpperCase();
    const def = PID_DEFINITIONS.find(d => d.mode === mode && d.pid === pid);
    const resp = await this.writeAndWait(cmd).catch((e: any) => {
      return { success: false, raw: '', bytes: [], mode, pid, error: e?.message ?? 'Query failed' } as OBD2Response;
    });
    if (!resp.success) return resp;
    // Try decode like the C implementation: first byte should be 0x40 + mode; second equals pid when applicable
    const b = resp.bytes;
    if (b.length >= 1 && b[0] !== (Number(mode) + 0x40)) {
      return { ...resp, success: false, error: 'Mode mismatch' };
    }
    if ((mode === 0x01 || mode === 0x09) && (b.length < 2 || b[1] !== pid)) {
      return { ...resp, success: false, error: 'PID mismatch' };
    }
    // Extract data bytes after mode/pid
    const data = b.slice((mode === 0x01 || mode === 0x09) ? 2 : 1);
    let value: any = undefined;
    // Special handling for Mode 09 PID 02 (VIN) - ASCII data often returned
    if (mode === 0x09 && pid === 0x02) {
      const ascii = data
        .filter(ch => ch >= 32 && ch <= 126)
        .map(ch => String.fromCharCode(ch))
        .join('');
      value = ascii.trim();
    } else if (def?.formula) {
      value = def.formula(data);
    }
    return { ...resp, mode, pid, value };
  }

  async readDTCs() {
    // Mode 03 has variable length, parse 2-byte DTCs per OBDII.c
    const resp = await this.writeAndWait('03');
    const b = resp.bytes;
    if (b.length < 2) return { ...resp, success: false, error: 'Invalid DTC response' } as OBD2Response;
    // Each 2 bytes map to one DTC
      const dtcs: string[] = []; // Initialize DTCs array
    for (let i = 0; i + 1 < b.length; i += 2) {
      const a = b[i];
      const c0 = ['P', 'C', 'B', 'U'][(a >> 6) & 0x03];
      const d1 = ((a & 0x30) >> 4).toString(10);
      const d2 = ((a & 0x0f)).toString(16).toUpperCase();
      const bb = b[i + 1];
      const d3 = ((bb >> 4)).toString(16).toUpperCase();
      const d4 = ((bb & 0x0f)).toString(16).toUpperCase();
      const code = `${c0}${d1}${d2}${d3}${d4}`;
      dtcs.push(code);
    }
      return { ...resp, value: dtcs.join(',') } as unknown as OBD2Response;
  }

  async clearDTCs() {
    return this.writeAndWait('04');
  }
}

export default OBD2Client;
