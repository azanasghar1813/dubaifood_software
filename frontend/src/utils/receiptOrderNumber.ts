/** Display ticket numbers as "A - #1" / "F - #2". Never prefix an extra #. */
export const TILL_LETTERS = ['A', 'B', 'C', 'D', 'F'] as const

export function tillLetterFromPrefix(prefix?: string | null): string {
  const p = String(prefix || '').trim().toUpperCase()
  const pc = p.match(/^PC-([A-F])$/)
  if (pc) return pc[1]
  const pc2 = p.match(/^PC([A-F])$/)
  if (pc2) return pc2[1]
  if (/^[A-F]$/.test(p)) return p
  if (p.includes('PC')) {
    const last = p.match(/([A-F])$/)
    if (last) return last[1]
  }
  return p.replace(/^PC-?/, '') || ''
}

export function isAssignedTillPrefix(raw?: string | null): boolean {
  return TILL_LETTERS.includes(tillLetterFromPrefix(raw) as (typeof TILL_LETTERS)[number])
}

export function formatReceiptOrderNumber(raw?: string | number | null): string {
  const cleaned = String(raw ?? '').trim().replace(/^#+/, '')
  if (!cleaned) return 'N/A'
  let m = cleaned.match(/^([A-F])[-\s]*(\d{8})[-\s]*#?\s*0*(\d+)$/i)
  if (m) return `${m[1].toUpperCase()} - #${Number(m[3])}`
  m = cleaned.match(/^([A-F])\s*-\s*#\s*0*(\d+)$/i)
  if (m) return `${m[1].toUpperCase()} - #${Number(m[2])}`
  m = cleaned.match(/^(?:PC-?)?([A-F])[-\s]*#?\s*0*(\d+)$/i)
  if (m) return `${m[1].toUpperCase()} - #${Number(m[2])}`
  m = cleaned.match(/([A-F]).*?(\d+)\s*$/i)
  if (m) return `${m[1].toUpperCase()} - #${Number(m[2])}`
  return cleaned
}
