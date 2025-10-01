import type { PIDDefinition } from '../types/obd2';

const INT_UNITS = new Set(['rpm', 'km/h', '°c', 'kpa', 'pa', 'min', 's']);

export function isIntLike(def?: PIDDefinition): boolean {
  const unit = def?.unit?.toLowerCase();
  // If no unit is defined, assume integer-like (counts, statuses, etc.)
  if (!unit) return true;
  return INT_UNITS.has(unit);
}

export function formatNumber(n: number, forceTwoDecimals = false): string {
  if (Number.isNaN(n)) return '—';
  if (forceTwoDecimals) return n.toFixed(2);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function formatPidValue(val: any, def?: PIDDefinition): { text: string; unit: string } {
  if (val == null) return { text: '—', unit: '' };
  if (typeof val === 'number') {
    if (isIntLike(def)) return { text: String(Math.round(val)), unit: def?.unit || '' };
    return { text: formatNumber(val, true), unit: def?.unit || '' };
  }
  if (typeof val === 'object') {
    const parts: string[] = [];
    const v = val as Record<string, any>;
    if (typeof v.fuelAirEquivalenceRatio === 'number') parts.push(`λ=${formatNumber(v.fuelAirEquivalenceRatio, true)}`);
    if (typeof v.voltage === 'number') parts.push(`${formatNumber(v.voltage, true)} V`);
    if (typeof v.shortTermFuelTrim === 'number') parts.push(`${formatNumber(v.shortTermFuelTrim, true)} %`);
    if (typeof v.current === 'number') parts.push(`${formatNumber(v.current, true)} A`);
    if (parts.length === 0) {
      const more = Object.entries(v)
        .filter(([, vv]) => typeof vv === 'number')
        .map(([k, vv]) => `${k}=${formatNumber(vv as number, true)}`);
      if (more.length) parts.push(...more);
    }
    return { text: parts.join(' • ') || '[—]', unit: '' };
  }
  return { text: String(val), unit: '' };
}
