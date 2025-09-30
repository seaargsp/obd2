import { pidKey } from '../data/pidDefinitions';
import { LiveSample, OBDMode } from '../types/obd2';
import SimpleEventEmitter from '../utils/SimpleEventEmitter';
import OBD2Client from './OBD2Client';

type LiveEvents = {
  sample: LiveSample;
  error: { message: string };
  started: true;
  stopped: true;
};

class LiveDataManager extends SimpleEventEmitter<LiveEvents> {
  private static instance: LiveDataManager;
  private client = OBD2Client.getInstance();
  private subs = new Map<string, { mode: OBDMode; pid: number }>();
  private timer?: any;
  private interval = 300; // ms, enforce >= 100

  static getInstance() {
    if (!this.instance) this.instance = new LiveDataManager();
    return this.instance;
  }

  setSampleInterval(ms: number) {
    this.interval = Math.max(100, Math.floor(ms));
    if (this.timer) this.start();
  }

  subscribe(mode: OBDMode, pid: number) {
    // Only add if supported when known; if supported list empty, allow subscribe and let query fail gracefully
    if (mode === 0x01) {
      const isKnown = this.client.getSupported(0x01).length > 0;
      if (isKnown && !this.client.isSupported(0x01, pid)) return; // skip unsupported
    }
    this.subs.set(pidKey(mode, pid), { mode, pid });
  }
  unsubscribe(mode: OBDMode, pid: number) {
    this.subs.delete(pidKey(mode, pid));
  }

  start() {
    this.stop();
    this.timer = setInterval(() => this.pollOnce(), this.interval);
    this.emit('started', true);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.emit('stopped', true);
  }

  private async pollOnce() {
    // If the client isn't connected, avoid hammering with requests and surface a single soft error
    // Note: Query itself will reject with 'Not connected'; we'll swallow repetitive messages.
    const supported = Array.from(this.subs.values());
    for (const { mode, pid } of supported) {
      try {
        const resp = await this.client.query(mode, pid);
        if (resp.success && typeof resp.value !== 'undefined') {
          this.emit('sample', { timestamp: Date.now(), key: pidKey(mode, pid), value: resp.value });
        }
      } catch (e: any) {
        const msg = e?.message ?? 'Poll error';
        // Don't spam logs if we're not connected; emit a single generic message occasionally.
        if (msg.includes('Not connected') || msg.includes('Disconnected')) {
          // Throttle by only emitting every ~3 seconds using interval boundary
          if (Math.floor(Date.now() / 3000) % 2 === 0) this.emit('error', { message: 'Waiting for connection…' });
        } else if (msg.startsWith('Timeout')) {
          // Timeouts are common when ECUs sleep; report briefly
          this.emit('error', { message: msg });
        } else {
          this.emit('error', { message: msg });
        }
      }
    }
  }
}

export default LiveDataManager;
