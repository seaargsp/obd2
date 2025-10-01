import { PermissionsAndroid, Platform } from 'react-native';
// @ts-ignore - module types provided via src/types/modules.d.ts or fallback to any
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { AdapterEvents, BTDevice, ConnectionState } from '../types/bluetooth';
import SimpleEventEmitter from '../utils/SimpleEventEmitter';
import SimulatedELM327 from './SimulatedELM327';

class BluetoothAdapter extends SimpleEventEmitter<AdapterEvents> {
  private static instance: BluetoothAdapter;
  private state: ConnectionState = 'disconnected';
  private device?: any;
  private readerSub?: any;
  private sim?: SimulatedELM327; // when connected to demo device
  private readonly DEMO_ADDR = 'DE:MO:OB:D2:00:01';
  private readonly DEMO_NAME = 'Demo OBDII';

  private constructor() {
    super();
  }

  static getInstance() {
    if (!BluetoothAdapter.instance) BluetoothAdapter.instance = new BluetoothAdapter();
    return BluetoothAdapter.instance;
  }

  get connectionState() {
    return this.state;
  }

  getConnectedDevice(): { address: string; name?: string } | null {
    if (this.state === 'connected' && this.device?.address) {
      return { address: this.device.address, name: this.device.name };
    }
    return null;
  }

  async ensurePermissions() {
    if (Platform.OS !== 'android') return true;
    const sdk = Platform.Version as number;
  const perms: (keyof typeof PermissionsAndroid.PERMISSIONS)[] = [] as any;
    if (sdk >= 31) {
      perms.push('BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT');
    } else {
      perms.push('ACCESS_FINE_LOCATION');
    }
    const granted = await PermissionsAndroid.requestMultiple(perms.map(k => (PermissionsAndroid.PERMISSIONS as any)[k]));
    return Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
  }

  async listDevices(): Promise<BTDevice[]> {
  const bonded = await RNBluetoothClassic.getBondedDevices();
  const mapped: BTDevice[] = (bonded as any[]).map((d: any) => ({ address: d.address, name: d.name ?? d.address, bonded: true, connected: d.connected }));
    // Prepend the demo device
    const demo: BTDevice = { address: this.DEMO_ADDR, name: this.DEMO_NAME, bonded: false, connected: this.state === 'connected' && this.sim != null };
    const list = [demo, ...mapped];
    this.emit('device:list', list);
    return list;
  }

  async connect(address: string) {
    if (this.state === 'connected' && this.device?.address === address) return true;
    this.setState('connecting');
    try {
      if (address === this.DEMO_ADDR) {
        // Simulated device path
        this.sim = new SimulatedELM327();
        this.device = { address: this.DEMO_ADDR, name: this.DEMO_NAME };
        this.setState('connected');
        this.emit('connected', { address: this.DEMO_ADDR, name: this.DEMO_NAME, connected: true });
        // Immediately emit the welcome banner like ELM327 after ATZ
        setTimeout(() => {
          this.emit('data', 'ELM327 v2.3\r\n>');
        }, 10);
        return true;
      }
  // Use '>' as the delimiter so each onDataReceived contains a full ELM327 response.
  // We will re-append '>' when emitting so downstream parsing can detect prompt boundaries.
  const device = await RNBluetoothClassic.connectToDevice(address, { delimiter: '>', charset: 'ascii' });
      this.device = device;
      this.setState('connected');
      this.emit('connected', { address: device.address, name: device.name ?? device.address, connected: true });
      // Subscribe to data
      this.readerSub = device.onDataReceived((event: any) => {
        if (event?.data) this.emit('data', String(event.data) + '>');
      });
      return true;
    } catch (e: any) {
      this.setState('error');
      this.emit('error', { message: e?.message ?? 'BT connect failed' });
      return false;
    }
  }

  async disconnect() {
    try {
      this.sim = undefined;
      if (this.readerSub) this.readerSub.remove();
      this.readerSub = undefined;
      if (this.device && typeof this.device.disconnect === 'function') {
        await this.device.disconnect();
      }
    } finally {
      const addr = this.device?.address;
      this.device = undefined;
      this.setState('disconnected');
      if (addr) this.emit('disconnected', { address: addr });
    }
  }

  async write(line: string) {
    if (!this.device) {
      this.emit('error', { message: 'Not connected' });
      throw new Error('Not connected');
    }
    try {
      if (this.sim) {
        // Route write to simulator and emit data+prompt
        const resp = this.sim.handle(line);
        // Simulate minimal processing latency
        setTimeout(() => {
          // ensure CRLF and prompt '>' termination
          const withPrompt = resp.endsWith('>') ? resp : resp + '>';
          this.emit('data', withPrompt);
        }, 30);
        return;
      }
      await this.device.write(line);
    } catch (e: any) {
      this.emit('error', { message: e?.message ?? 'Write failed' });
      throw e;
    }
  }

  private setState(s: ConnectionState) {
    this.state = s;
    this.emit('state:change', s);
  }
}

export default BluetoothAdapter;
