/**
 * Ticket numbers: formatted by order type (Delivery - 1, Dine In - 1, Takeaway - 1).
 */

export const TILL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export function tillLetterFromPrefix(prefix?: string | null): string {
  const p = String(prefix || '').trim().toUpperCase()
  const pc = p.match(/^PC-([A-F])$/)
  if (pc) return pc[1]
  const pc2 = p.match(/^PC([A-F])$/)
  if (pc2) return pc2[1]
  if (/^[A-F]$/.test(p)) return p
  return ''
}

export function isAssignedTillPrefix(raw?: string | null): boolean {
  return TILL_LETTERS.includes(tillLetterFromPrefix(raw) as (typeof TILL_LETTERS)[number])
}

export function getOrderTypeLabel(typeKey?: string | null): string {
  const t = String(typeKey || '').trim().toUpperCase()
  if (t.includes('DELIV')) return 'Delivery'
  if (t.includes('TAKE') || t.includes('PICK')) return 'Takeaway'
  return 'Dine In'
}

export function parseTicketSeq(raw?: string | number | null): number {
  const cleaned = String(raw ?? '').trim();
  if (!cleaned) return 0;
  // Match after #
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

export function formatReceiptOrderNumber(raw?: string | number | null, explicitOrderType?: string | null): string {
  const cleaned = String(raw ?? '').trim().replace(/^#+/, '')
  if (!cleaned) return 'N/A'

  const seq = parseTicketSeq(cleaned)
  let typeKey = ''
  if (explicitOrderType) {
    typeKey = explicitOrderType
  } else {
    const m = cleaned.match(/^(\d{8})-([A-Z_]+)-#0*(\d+)$/i) || cleaned.match(/^(Delivery|Dine\s*In|Takeaway)[-\s]+/i)
    if (m) {
      typeKey = m[2] || m[1]
    }
  }

  const label = getOrderTypeLabel(typeKey)
  if (seq > 0) {
    return `${label} - ${seq}`
  }

  return cleaned
}
