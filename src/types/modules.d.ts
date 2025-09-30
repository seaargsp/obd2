declare module 'react-native-bluetooth-classic' {
  import { EmitterSubscription } from 'react-native';
  export interface BluetoothDevice {
    address: string;
    name?: string;
    connected?: boolean;
    write: (data: string) => Promise<void> | void;
    disconnect: () => Promise<void> | void;
    onDataReceived: (listener: (event: { data: string }) => void) => EmitterSubscription;
  }
  const RNBluetoothClassic: {
    getBondedDevices(): Promise<BluetoothDevice[]>;
    connectToDevice(address: string, options?: { delimiter?: string; charset?: string }): Promise<BluetoothDevice>;
  };
  export default RNBluetoothClassic;
}
