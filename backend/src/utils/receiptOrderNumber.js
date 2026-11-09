/**
 * Ticket numbers: formatted by order type (Delivery - 1, Dine In - 1, Takeaway - 1).
 * Stored unique form: YYYYMMDD-TYPE-#n (e.g. 20261108-DELIVERY-#1).
 */

export const SHARED_TICKET_PREFIX = 'SHARED';

export function normalizeOrderTypePrefix(rawType) {
  const t = String(rawType || '').trim().toUpperCase();
  if (t.includes('DELIV')) return 'DELIVERY';
  if (t.includes('TAKE') || t.includes('PICK')) return 'TAKEAWAY';
  return 'DINE_IN';
}

export function getOrderTypeLabel(typeKey) {
  const t = String(typeKey || '').trim().toUpperCase();
  if (t.includes('DELIV')) return 'Delivery';
  if (t.includes('TAKE') || t.includes('PICK')) return 'Takeaway';
  return 'Dine In';
}

export function parseTicketSeq(raw) {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return 0;
  // Format: 20261108-DELIVERY-#5 or 20261108-#5 or 20261108-TAKEAWAY-#5
  let m = cleaned.match(/#0*(\d+)$/);
  if (m) return Number(m[1]);
  m = cleaned.match(/^(?:Delivery|Dine\s*In|Takeaway)[-\s]+#?0*(\d+)$/i);
  if (m) return Number(m[1]);
  m = cleaned.match(/^([A-F])[-\s]*\d{8}[-\s]*#?\s*0*(\d+)$/i);
  if (m) return Number(m[2]);
  m = cleaned.match(/^([A-F])\s*-\s*#\s*0*(\d+)$/i);
  if (m) return Number(m[2]);
  m = cleaned.match(/^(?:PC-?)?([A-F])[-\s]*#?\s*0*(\d+)$/i);
  if (m) return Number(m[2]);
  m = cleaned.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}

export function buildReceiptOrderNumber(orderType, seq, businessDate) {
  const n = Number(seq) || 1;
  const ymd = String(businessDate || '').replace(/-/g, '');
  const typeKey = normalizeOrderTypePrefix(orderType);
  if (/^\d{8}$/.test(ymd)) return `${ymd}-${typeKey}-#${n}`;
  return `${typeKey}-#${n}`;
}

export function formatReceiptOrderNumber(raw, explicitOrderType = null) {
  const cleaned = String(raw || '').trim().replace(/^#+/, '');
  if (!cleaned) return 'N/A';

  const seq = parseTicketSeq(cleaned);
  let typeKey = '';
  if (explicitOrderType) {
    typeKey = explicitOrderType;
  } else {
    const m = cleaned.match(/^(\d{8})-([A-Z_]+)-#0*(\d+)$/i) || cleaned.match(/^(Delivery|Dine\s*In|Takeaway)[-\s]+/i);
    if (m) {
      typeKey = m[2] || m[1];
    }
  }

  const label = getOrderTypeLabel(typeKey);
  if (seq > 0) {
    return `${label} - ${seq}`;
  }

  return cleaned;
}

export const TILL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function tillLetterFromPrefix(prefix) {
  const p = String(prefix || '').trim().toUpperCase();
  const pc = p.match(/^PC-([A-F])$/);
  if (pc) return pc[1];
  const pc2 = p.match(/^PC([A-F])$/);
  if (pc2) return pc2[1];
  if (/^[A-F]$/.test(p)) return p;
  return '';
}

export function canonicalTillPrefix(raw) {
  const letter = tillLetterFromPrefix(raw);
  return TILL_LETTERS.includes(letter) ? `PC-${letter}` : null;
}

export function isAssignedTillPrefix(raw) {
  return !!canonicalTillPrefix(raw);
}
