/**
 * Receipt till letter and order number, e.g. "A - #1" (never "PC-A-1").
 * Stored unique form includes the business date so daily 6 AM reset can restart at #1.
 */
export const TILL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function tillLetterFromPrefix(prefix) {
  const p = String(prefix || '').trim().toUpperCase();
  const pc = p.match(/^PC-([A-F])$/);
  if (pc) return pc[1];
  const pc2 = p.match(/^PC([A-F])$/);
  if (pc2) return pc2[1];
  if (/^[A-F]$/.test(p)) return p;
  if (p.includes('PC')) {
    const last = p.match(/([A-F])$/);
    if (last) return last[1];
  }
  return p.replace(/^PC-?/, '') || 'A';
}

export function canonicalTillPrefix(raw) {
  const letter = tillLetterFromPrefix(raw);
  return TILL_LETTERS.includes(letter) ? `PC-${letter}` : null;
}

export function isAssignedTillPrefix(raw) {
  return !!canonicalTillPrefix(raw);
}

export function buildReceiptOrderNumber(prefix, seq, businessDate) {
  const letter = tillLetterFromPrefix(prefix);
  const n = Number(seq) || 1;
  const ymd = String(businessDate || '').replace(/-/g, '');
  if (/^\d{8}$/.test(ymd)) return `${letter}-${ymd}-#${n}`;
  return `${letter} - #${n}`;
}

export function formatReceiptOrderNumber(raw) {
  const cleaned = String(raw || '').trim().replace(/^#+/, '');
  if (!cleaned) return 'N/A';
  let m = cleaned.match(/^([A-F])[-\s]*(\d{8})[-\s]*#?\s*0*(\d+)$/i);
  if (m) return `${m[1].toUpperCase()} - #${Number(m[3])}`;
  m = cleaned.match(/^([A-F])\s*-\s*#\s*0*(\d+)$/i);
  if (m) return `${m[1].toUpperCase()} - #${Number(m[2])}`;
  m = cleaned.match(/^(?:PC-?)?([A-F])[-\s]*#?\s*0*(\d+)$/i);
  if (m) return `${m[1].toUpperCase()} - #${Number(m[2])}`;
  m = cleaned.match(/([A-F]).*?(\d+)\s*$/i);
  if (m) return `${m[1].toUpperCase()} - #${Number(m[2])}`;
  return cleaned;
}
