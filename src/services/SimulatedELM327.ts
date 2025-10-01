import { toHexByte } from '../utils/hex';

// Simple ELM327 simulator for offline/demo usage.
// Returns ASCII hex lines terminated by CRLF (no '>' prompt here; caller appends it).
export default class SimulatedELM327 {
  private readonly supported01 = new Set<number>([
    // Defaults groups from pidDefinitions.ts (Engine Basic, Air & Fuel, Temperature)
    0x0C, // RPM
    0x0D, // Speed
    0x04, // Load
    0x42, // Module voltage (in 0x41-0x60 range but we only need to mark continuation for 0x20)
    0x0B, // MAP
    0x10, // MAF
    0x06, // STFT B1
    0x07, // LTFT B1
    0x23, // Fuel rail pressure
    0x14, // O2 sensor 1
    0x05, // Coolant temp
    0x33, // Barometric pressure
  ]);

  private readonly demoVIN = '1HGBH41JXMN109186';

  handle(command: string): string {
    const raw = command.trim();
    const c = raw.replace(/\r|\n/g, '').trim().toUpperCase();
    if (!c) return '';

    // ELM327 AT commands
    if (c.startsWith('AT')) {
      switch (c) {
        case 'ATZ':
          return 'ELM327 v2.3\r\r';
        case 'ATE0':
        case 'ATL0':
        case 'ATS0':
        case 'ATSP0':
          return 'OK\r\r';
        default:
          return 'OK\r\r';
      }
    }

    // Mode 03 - DTCs (return one demo DTC P0301)
    if (c === '03') {
      // As the app parser expects consecutive pairs, we omit the usual 0x43 header
      // P0301 encodes to bytes: 0x03, 0x01
      return '03 01\r\r';
    }
    // Mode 04 - Clear DTCs
    if (c === '04') {
      return 'OK\r\r';
    }

    // Mode 09 02 - VIN
    if (c === '09' || c === '0900') {
      // Advertise support for 0x02 only
      // Respond with: 49 00 00 00 03 to indicate PID 02 supported (bit 2)
      // For simplicity provide a mask with only 0x02 bit set
      const b = ['49', '00', '00', '00', '04'];
      return b.join(' ') + '\r\r';
    }
    if (c === '0902' || c === '09 02') {
      const asciiHex = this.demoVIN
        .split('')
        .map(ch => toHexByte(ch.charCodeAt(0)))
        .join(' ');
      return `49 02 ${asciiHex}\r\r`;
    }

    // Mode 01
    if (c.startsWith('01')) {
      const pidHex = c.replace(/\s+/g, '').slice(2, 4);
      if (pidHex.length !== 2) return 'NO DATA\r\r';
      const pid = parseInt(pidHex, 16);
      if (Number.isNaN(pid)) return 'NO DATA\r\r';

      if (pid === 0x00) {
        const bytes = this.bitmaskForRange(0x00, true); // signal continuation to 0x20
        return `41 00 ${bytes.map(toHexByte).join(' ')}\r\r`;
      }
      if (pid === 0x20) {
        const bytes = this.bitmaskForRange(0x20, false); // stop here (no 0x40)
        return `41 20 ${bytes.map(toHexByte).join(' ')}\r\r`;
      }

      // Provide sample values for a few common PIDs
      const data = this.sampleDataForPid(pid);
      if (!data) return 'NO DATA\r\r';
      return `41 ${toHexByte(pid)} ${data.map(toHexByte).join(' ')}\r\r`;
    }

    return '?\r\r';
  }

  private bitmaskForRange(base: number, continueToNext: boolean): number[] {
    const bytes = [0, 0, 0, 0];
    for (let pid = base + 1; pid <= base + 32; pid++) {
      if (this.supported01.has(pid)) {
        const offset = pid - (base + 1);
        const byteIdx = Math.floor(offset / 8);
        const bitIdx = 7 - (offset % 8);
        bytes[byteIdx] |= (1 << bitIdx);
      }
    }
    // LSB of last byte indicates more PIDs in next range
    if (continueToNext) bytes[3] |= 0x01;
    return bytes;
  }

  private sampleDataForPid(pid: number): number[] | null {
    const t = Date.now() / 1000;
    // helper to clamp and round
    const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
    switch (pid) {
      case 0x0C: { // RPM
        const rpm = Math.round(1200 + 400 * Math.sin(t / 2));
        const v = rpm * 4; // encoded value
        return [(v >> 8) & 0xFF, v & 0xFF];
      }
      case 0x0D: { // Speed
        const spd = clamp(Math.round(40 + 10 * Math.sin(t)), 0, 255);
        return [spd];
      }
      case 0x04: { // Load (A/2.55)
        const pct = clamp(30 + 10 * Math.sin(t * 1.3), 0, 100);
        return [Math.round(pct * 2.55) & 0xFF];
      }
      case 0x42: { // Module voltage ((A*256+B)/1000)
        const mv = Math.round(13.8 * 1000);
        return [(mv >> 8) & 0xFF, mv & 0xFF];
      }
      case 0x0B: { // MAP
        return [30];
      }
      case 0x10: { // MAF ((A*256+B)/100)
        const maf = Math.round(12.3 * 100);
        return [(maf >> 8) & 0xFF, maf & 0xFF];
      }
      case 0x06: // STFT B1
      case 0x07: { // LTFT B1
        const trim = clamp(100 + 2 * Math.sin(t * 0.7), 0, 200); // center 0% around 128
        const b = Math.round(trim * 1.28); // inverse of (b/1.28 - 100)
        return [b & 0xFF];
      }
      case 0x23: { // Fuel rail pressure (10*(A*256+B))
        const raw = 35; // 350 kPa
        return [(raw >> 8) & 0xFF, raw & 0xFF];
      }
      case 0x14: { // O2 sensor 1
        const voltage = 0.7; // V
        const A = Math.round(voltage * 200);
        const B = 127; // about -1% STFT
        return [A & 0xFF, B & 0xFF];
      }
      case 0x05: { // Coolant temp (A-40)
        return [128]; // 88°C
      }
      case 0x33: { // Baro
        return [100];
      }
      default:
        return null;
    }
  }
}
