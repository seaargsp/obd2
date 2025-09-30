export function toHexByte(n: number) {
  return n.toString(16).padStart(2, '0').toUpperCase();
}

export function parseAsciiHexToBytes(input: string): number[] {
  // Input like "41 0C 1A F8>" or with CR/LF; remove non-hex chars and split
  const cleaned = input.replace(/[^0-9A-Fa-f]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts.map(p => parseInt(p, 16)).filter(n => !Number.isNaN(n));
}

export function stripPrompt(s: string) {
  return s.replace(/>/g, '').trim();
}
