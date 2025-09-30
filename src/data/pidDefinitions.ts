import { PIDDefinition, PIDGroup } from '../types/obd2';

// Helper to extract bytes A, B, C, D
const A = (b: number[]) => b[0] ?? 0;
const B = (b: number[]) => b[1] ?? 0;

export const PID_DEFINITIONS: PIDDefinition[] = [
  // Mode 01 - per OBDII.c
  { mode: 0x01, pid: 0x00, name: 'Supported PIDs 01-20', bytes: 4 },
  { mode: 0x01, pid: 0x01, name: 'Monitor status since DTCs cleared', bytes: 4 },
  { mode: 0x01, pid: 0x02, name: 'Freeze DTC', bytes: 2 },
  { mode: 0x01, pid: 0x03, name: 'Fuel system status', bytes: 2 },
  { mode: 0x01, pid: 0x04, name: 'Calculated engine load', unit: '%', bytes: 1, formula: (b) => (A(b) / 2.55) },
  { mode: 0x01, pid: 0x05, name: 'Engine coolant temp.', unit: '°C', bytes: 1, formula: (b) => A(b) - 40 },
  { mode: 0x01, pid: 0x06, name: 'Short term fuel trim B1', unit: '%', bytes: 1, formula: (b) => A(b) / 1.28 - 100 },
  { mode: 0x01, pid: 0x07, name: 'Long term fuel trim B1', unit: '%', bytes: 1, formula: (b) => A(b) / 1.28 - 100 },
  { mode: 0x01, pid: 0x08, name: 'Short term fuel trim B2', unit: '%', bytes: 1, formula: (b) => A(b) / 1.28 - 100 },
  { mode: 0x01, pid: 0x09, name: 'Long term fuel trim B2', unit: '%', bytes: 1, formula: (b) => A(b) / 1.28 - 100 },
  { mode: 0x01, pid: 0x0A, name: 'Fuel pressure (gauge)', unit: 'kPa', bytes: 1, formula: (b) => 3 * A(b) },
  { mode: 0x01, pid: 0x0B, name: 'Intake MAP', unit: 'kPa', bytes: 1, formula: (b) => A(b) },
  { mode: 0x01, pid: 0x0C, name: 'Engine RPM', unit: 'rpm', bytes: 2, formula: (b) => ((A(b) * 256 + B(b)) / 4) },
  { mode: 0x01, pid: 0x0D, name: 'Vehicle speed', unit: 'km/h', bytes: 1, formula: (b) => A(b) },
  { mode: 0x01, pid: 0x0E, name: 'Timing advance', unit: '°', bytes: 1, formula: (b) => (A(b) / 2) - 64 },
  { mode: 0x01, pid: 0x0F, name: 'Intake air temp.', unit: '°C', bytes: 1, formula: (b) => A(b) - 40 },
  { mode: 0x01, pid: 0x10, name: 'MAF rate', unit: 'g/s', bytes: 2, formula: (b) => ((A(b) * 256 + B(b)) / 100) },
  { mode: 0x01, pid: 0x11, name: 'Throttle position', unit: '%', bytes: 1, formula: (b) => (A(b) * 100) / 255 },
  { mode: 0x01, pid: 0x12, name: 'Commanded secondary air status', bytes: 1 },
  { mode: 0x01, pid: 0x13, name: 'Oxygen sensors present', bytes: 1 },
  // O2 sensors 0x14 - 0x1B
  ...Array.from({ length: 8 }, (_, i) => ({ mode: 0x01 as const, pid: (0x14 + i), name: `Oxygen sensor ${i + 1}`, bytes: 2, formula: (b: number[]) => ({ voltage: A(b) / 200, shortTermFuelTrim: (100 / 128) * B(b) - 100 }) })),
  { mode: 0x01, pid: 0x1C, name: 'OBD standards this vehicle conforms to', bytes: 1 },
  { mode: 0x01, pid: 0x1D, name: 'Oxygen sensors present in 4 banks', bytes: 1 },
  { mode: 0x01, pid: 0x1E, name: 'Auxiliary input status', bytes: 1 },
  { mode: 0x01, pid: 0x1F, name: 'Run time since engine start', unit: 's', bytes: 2, formula: (b) => (A(b) * 256 + B(b)) },
  { mode: 0x01, pid: 0x20, name: 'Supported PIDs 21-40', bytes: 4 },
  { mode: 0x01, pid: 0x21, name: 'Distance traveled with MIL on', unit: 'km', bytes: 2, formula: (b) => A(b) * 256 + B(b) },
  { mode: 0x01, pid: 0x22, name: 'Fuel rail pressure (relative to manifold vacuum)', unit: 'kPa', bytes: 2, formula: (b) => 0.079 * (A(b) * 256 + B(b)) },
  { mode: 0x01, pid: 0x23, name: 'Fuel rail pressure', unit: 'kPa', bytes: 2, formula: (b) => 10 * (A(b) * 256 + B(b)) },
  // Wideband O2 0x24 - 0x2B (6 bytes)
  ...Array.from({ length: 8 }, (_, i) => ({ mode: 0x01 as const, pid: (0x24 + i), name: `Oxygen sensor ${i + 1} (wideband)`, bytes: 4, formula: (b: number[]) => ({ fuelAirEquivalenceRatio: (2 / 65536) * (A(b) * 256 + B(b)), voltage: (8 / 65536) * ( (b[2] ?? 0) * 256 + (b[3] ?? 0) ) }) })),
  { mode: 0x01, pid: 0x2C, name: 'Commanded EGR', unit: '%', bytes: 1, formula: (b) => A(b) / 2.55 },
  { mode: 0x01, pid: 0x2D, name: 'EGR error', unit: '%', bytes: 1, formula: (b) => (100 / 128) * A(b) - 100 },
  { mode: 0x01, pid: 0x2E, name: 'Commanded evaporative purge', unit: '%', bytes: 1, formula: (b) => A(b) / 2.55 },
  { mode: 0x01, pid: 0x2F, name: 'Fuel tank level input', unit: '%', bytes: 1, formula: (b) => A(b) / 2.55 },
  { mode: 0x01, pid: 0x30, name: 'Warm-ups since codes cleared', bytes: 1, formula: (b) => A(b) },
  { mode: 0x01, pid: 0x31, name: 'Distance traveled since codes cleared', unit: 'km', bytes: 2, formula: (b) => A(b) * 256 + B(b) },
  { mode: 0x01, pid: 0x32, name: 'Evaporative system vapor pressure', unit: 'Pa', bytes: 2, formula: (b) => (((A(b) << 8) | B(b)) << 16) >> 16 / 4 },
  { mode: 0x01, pid: 0x33, name: 'Absolute barometric pressure', unit: 'kPa', bytes: 1, formula: (b) => A(b) },
  // O2 sensors 0x34 - 0x3B (fuel-air ratio + current)
  ...Array.from({ length: 8 }, (_, i) => ({ mode: 0x01 as const, pid: (0x34 + i), name: `Oxygen sensor ${i + 1} (current)`, bytes: 4, formula: (b: number[]) => ({ fuelAirEquivalenceRatio: (2 / 65536) * (A(b) * 256 + B(b)), current: (((b[2] ?? 0) * 256 + (b[3] ?? 0)) / 256) - 128 }) })),
  { mode: 0x01, pid: 0x3C, name: 'Catalyst temperature, bank 1, sensor 1', unit: '°C', bytes: 2, formula: (b) => (A(b) * 256 + B(b)) / 10 - 40 },
  { mode: 0x01, pid: 0x3D, name: 'Catalyst temperature, bank 2, sensor 1', unit: '°C', bytes: 2, formula: (b) => (A(b) * 256 + B(b)) / 10 - 40 },
  { mode: 0x01, pid: 0x3E, name: 'Catalyst temperature, bank 1, sensor 2', unit: '°C', bytes: 2, formula: (b) => (A(b) * 256 + B(b)) / 10 - 40 },
  { mode: 0x01, pid: 0x3F, name: 'Catalyst temperature, bank 2, sensor 2', unit: '°C', bytes: 2, formula: (b) => (A(b) * 256 + B(b)) / 10 - 40 },
  { mode: 0x01, pid: 0x40, name: 'Supported PIDs 41-60', bytes: 4 },
  { mode: 0x01, pid: 0x41, name: 'Monitor status this drive cycle', bytes: 4 },
  { mode: 0x01, pid: 0x42, name: 'Control module voltage', unit: 'V', bytes: 2, formula: (b) => ((A(b) * 256 + B(b)) / 1000) },
  { mode: 0x01, pid: 0x43, name: 'Absolute load value', unit: '%', bytes: 2, formula: (b) => (100 / 255) * (A(b) * 256 + B(b)) },
  { mode: 0x01, pid: 0x44, name: 'Fuel–Air commanded equivalence ratio', bytes: 2, formula: (b) => (2 / 65536) * (A(b) * 256 + B(b)) },
  { mode: 0x01, pid: 0x45, name: 'Relative throttle position', unit: '%', bytes: 1, formula: (b) => A(b) / 2.55 },
  { mode: 0x01, pid: 0x46, name: 'Ambient air temperature', unit: '°C', bytes: 1, formula: (b) => A(b) - 40 },
  { mode: 0x01, pid: 0x47, name: 'Absolute throttle position B', unit: '%', bytes: 1, formula: (b) => A(b) / 2.55 },
  { mode: 0x01, pid: 0x48, name: 'Absolute throttle position C', unit: '%', bytes: 1, formula: (b) => A(b) / 2.55 },
  { mode: 0x01, pid: 0x49, name: 'Accelerator pedal position D', unit: '%', bytes: 1, formula: (b) => A(b) / 2.55 },
  { mode: 0x01, pid: 0x4A, name: 'Accelerator pedal position E', unit: '%', bytes: 1, formula: (b) => A(b) / 2.55 },
  { mode: 0x01, pid: 0x4B, name: 'Accelerator pedal position F', unit: '%', bytes: 1, formula: (b) => A(b) / 2.55 },
  { mode: 0x01, pid: 0x4C, name: 'Commanded throttle actuator', unit: '%', bytes: 1, formula: (b) => A(b) / 2.55 },
  { mode: 0x01, pid: 0x4D, name: 'Time run with MIL on', unit: 'min', bytes: 2, formula: (b) => A(b) * 256 + B(b) },
  { mode: 0x01, pid: 0x4E, name: 'Time since trouble codes cleared', unit: 'min', bytes: 2, formula: (b) => A(b) * 256 + B(b) },

  // Mode 03
  { mode: 0x03, pid: 0x00, name: 'DTCs', bytes: 0 },
  // Mode 09
  { mode: 0x09, pid: 0x00, name: 'Mode 9 Supported PIDs', bytes: 4 },
  { mode: 0x09, pid: 0x02, name: 'VIN', bytes: 0 },
];

export const DEFAULT_PID_GROUPS: PIDGroup[] = [
  {
    id: 'engine_basic',
    title: 'Engine Basic',
    pids: [
      { mode: 0x01, pid: 0x0C },
      { mode: 0x01, pid: 0x0D },
      { mode: 0x01, pid: 0x04 },
      { mode: 0x01, pid: 0x42 },
    ],
  },
  {
    id: 'air_fuel',
    title: 'Air & Fuel',
    pids: [
      { mode: 0x01, pid: 0x0B },
      { mode: 0x01, pid: 0x10 },
      { mode: 0x01, pid: 0x06 },
      { mode: 0x01, pid: 0x07 },
      { mode: 0x01, pid: 0x23 },
      { mode: 0x01, pid: 0x14 },
    ],
  },
  {
    id: 'temperature',
    title: 'Temperature',
    pids: [
      { mode: 0x01, pid: 0x05 },
      { mode: 0x01, pid: 0x33 },
    ],
  },
];

export function pidKey(mode: number, pid: number) {
  return `${mode}:${pid}`;
}
