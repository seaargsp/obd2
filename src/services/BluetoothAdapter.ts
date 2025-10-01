import { PermissionsAndroid, Platform } from 'react-native';
// @ts-ignore - module types provided via src/types/modules.d.ts or fallback to any
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { AdapterEvents, BTDevice, ConnectionState } from '../types/bluetooth';
import SimpleEventEmitter from '../utils/SimpleEventEmitter';

class BluetoothAdapter extends SimpleEventEmitter<AdapterEvents> {
  private static instance: BluetoothAdapter;
  private state: ConnectionState = 'disconnected';
  private device?: any;
  private readerSub?: any;

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
    this.emit('device:list', mapped);
    return mapped;
  }

  async connect(address: string) {
    if (this.state === 'connected' && this.device?.address === address) return true;
    this.setState('connecting');
    try {
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
      if (this.readerSub) this.readerSub.remove();
      this.readerSub = undefined;
      if (this.device) await this.device.disconnect();
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
