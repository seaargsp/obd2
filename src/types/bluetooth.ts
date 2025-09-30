export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BTDevice {
  address: string;
  name?: string;
  rssi?: number;
  bonded?: boolean;
  connected?: boolean;
  lastSeen?: number;
}

export interface AdapterEvents {
  'state:change': ConnectionState;
  'device:list': BTDevice[];
  'connected': BTDevice;
  'disconnected': { address: string; reason?: string };
  'error': { message: string; code?: string };
  'data': string; // raw data from device
}
