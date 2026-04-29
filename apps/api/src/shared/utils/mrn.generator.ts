export function generateMrn(sequence: number): string {
  // Format: MC-000001 (zero-padded to 6 digits)
  return `MC-${String(sequence).padStart(6, '0')}`;
}
