import { useEffect } from "react"
import { Printer, X } from "lucide-react"
import { formatReceiptOrderNumber } from "../utils/receiptOrderNumber"

export interface KitchenTicketPreviewOrder {
  orderNumber?: string
  orderType?: string
  tableNumber?: string | null
  cashierName?: string
  waiterName?: string | null
  riderName?: string | null
  isVip?: boolean
  notes?: string | null
  timestamp?: string
  items?: Array<{
    name: string
    quantity: number
    selectedModifiers?: { name: string }[]
    notes?: string | null
    kitchen?: string
    combo_components?: Array<{ product_name_snapshot?: string; product_name?: string; quantity?: number; variant_snapshot?: string }>
  }>
}

interface KitchenTicketPreviewProps {
  order: KitchenTicketPreviewOrder
  autoPrint?: boolean
  onClose?: () => void
}

export default function KitchenTicketPreview({ order, autoPrint, onClose }: KitchenTicketPreviewProps) {
  const orderNumber = formatReceiptOrderNumber(order?.orderNumber)
  const orderType = order?.orderType ?? "Dine In"
  const tableNumber = order?.tableNumber ?? null
  const cashier = order?.cashierName ?? "Cashier"
  const waiterName = order?.waiterName ?? null
  const riderName = order?.riderName ?? null
  const isVip = !!order?.isVip
  const notes = order?.notes ?? null
  const timestamp = order?.timestamp ? new Date(order.timestamp) : new Date()
  const dateStr = timestamp.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  const timeStr = timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const items = order?.items ?? []
  const isDelivery = String(orderType).toLowerCase().includes("delivery")

  const itemRowsHtml = (list: typeof items) => list.map((item) => {
    const mods = item.selectedModifiers?.length
      ? `<div style="font-size:11px;font-weight:400;margin-top:2px">${item.selectedModifiers.map((m) => "- " + m.name).join("<br>")}</div>`
      : ""
    const combos = (item.combo_components || []).map((c) => {
      const qtyPrefix = (c.quantity && c.quantity > 1) ? `${c.quantity}x ` : ""
      const name = c.product_name_snapshot || c.product_name || "Item"
      const variant = c.variant_snapshot ? ` (${c.variant_snapshot})` : ""
      return `<div style="font-size:11px;font-weight:400;margin-top:2px">- ${qtyPrefix}${name}${variant}</div>`
    }).join("")
    const itemNotes = item.notes
      ? `<div style="font-size:11px;font-weight:700;margin-top:2px">Note: ${item.notes}</div>`
      : ""
    return `
      <tr style="border-bottom:1px dashed #000;">
        <td style="padding:6px 4px;text-align:left;font-weight:800;text-transform:uppercase;">
          ${item.name}${mods}${combos}${itemNotes}
        </td>
        <td style="padding:6px 4px;text-align:center;font-weight:900;font-size:16px;vertical-align:top;width:48px;">${item.quantity}</td>
      </tr>`
  }).join("")

  const ticketBody = (forPrint: boolean) => {
    const stationBlocks = `
        <div style="border:2px solid #000;margin-bottom:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="border-bottom:2px dashed #000;">
                <th style="padding:4px;text-align:left;">Item</th>
                <th style="padding:4px;text-align:center;width:48px;">Qty</th>
              </tr>
            </thead>
            <tbody>${itemRowsHtml(items)}</tbody>
          </table>
        </div>`

    return `
      <div style="text-align:center;font-weight:900;font-size:18px;letter-spacing:1px;margin-bottom:6px;">KITCHEN TICKET</div>
      <div style="text-align:center;font-weight:900;font-size:22px;margin-bottom:8px;">${orderNumber}</div>
      ${isVip ? `<div style="text-align:center;font-weight:900;font-size:16px;margin:6px 0;">** VIP ORDER **</div>` : ""}
      <div style="font-size:12px;display:flex;flex-direction:column;gap:3px;margin-bottom:10px;">
        ${!isDelivery && tableNumber && tableNumber !== "N/A" ? `<div><b>Table:</b> ${tableNumber}</div>` : ""}
        <div><b>Type:</b> ${orderType}</div>
        <div><b>Cashier:</b> ${cashier}</div>
        ${isDelivery ? `<div><b>Rider:</b> ${riderName || "Unassigned"}</div>` : `<div><b>Waiter:</b> ${waiterName || "Unassigned"}</div>`}
        <div style="font-weight:900;"><b>Time:</b> ${dateStr}, ${timeStr}</div>
      </div>
      ${stationBlocks}
      ${notes ? `<div style="margin-top:8px;font-weight:900;border-top:2px dashed #000;padding-top:6px;">NOTE: ${notes}</div>` : ""}
    `
  }

  const doPrint = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>KOT ${orderNumber}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:sans-serif; background:#fff; color:#000; display:flex; justify-content:center; align-items:flex-start; min-height:100vh; }
    .ticket { width:80mm; max-width:302px; padding:8px; }
    @media print {
      html, body { width:80mm; display:block; }
      .ticket { width:100%; padding:4px; margin:0; }
      @page { margin:3mm; size:80mm auto; }
    }
  </style>
</head>
<body>
  <div class="ticket">${ticketBody(true)}</div>
</body>
</html>`
    const pw = window.open("", "_blank", "width=420,height=780")
    if (!pw) { alert("Please allow popups to print kitchen tickets."); return }
    pw.document.write(html)
    pw.document.close()
    pw.focus()
    setTimeout(() => {
      pw.print()
      setTimeout(() => { pw.close(); if (onClose) onClose() }, 600)
    }, 400)
  }

  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(doPrint, 300)
      return () => clearTimeout(t)
    }
  }, [autoPrint])

  const preview = (
    <div className="bg-white text-black font-sans p-4 rounded-lg w-full max-w-sm mx-auto shadow-sm" style={{ width: "320px" }}>
      <div className="text-center font-black text-lg tracking-widest mb-1">KITCHEN TICKET</div>
      <div className="text-center font-black text-2xl mb-2">{orderNumber}</div>
      {isVip && (
        <div className="text-center font-black text-base my-2">** VIP ORDER **</div>
      )}
      <div className="text-[12px] flex flex-col gap-0.5 mb-3">
        {!isDelivery && tableNumber && tableNumber !== "N/A" && (
          <div><span className="font-black mr-1">Table:</span>{tableNumber}</div>
        )}
        <div><span className="font-black mr-1">Type:</span>{orderType}</div>
        <div><span className="font-black mr-1">Cashier:</span>{cashier}</div>
        {isDelivery
          ? <div><span className="font-black mr-1">Rider:</span>{riderName || "Unassigned"}</div>
          : <div><span className="font-black mr-1">Waiter:</span>{waiterName || "Unassigned"}</div>}
        <div className="font-black"><span className="mr-1">Time:</span>{dateStr}, {timeStr}</div>
      </div>
      <div className="border-2 border-black mb-2">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b-2 border-dashed border-black">
              <th className="text-left py-1 px-1">Item</th>
              <th className="text-center py-1 px-1 w-12">Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-dashed border-black last:border-0">
                <td className="py-1.5 px-1 font-extrabold uppercase">
                  {item.name}
                  {item.selectedModifiers?.map((m) => (
                    <div key={m.name} className="text-[11px] font-normal normal-case">- {m.name}</div>
                  ))}
                  {(item.combo_components || []).map((c, cidx) => (
                    <div key={cidx} className="text-[11px] font-normal normal-case">
                      - {(c.quantity && c.quantity > 1) ? `${c.quantity}x ` : ''}{c.product_name_snapshot || c.product_name || 'Item'}{c.variant_snapshot ? ` (${c.variant_snapshot})` : ''}
                    </div>
                  ))}
                  {item.notes && <div className="text-[11px] font-bold">Note: {item.notes}</div>}
                </td>
                <td className="py-1.5 px-1 text-center font-black text-base align-top">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes && (
        <div className="mt-2 font-black border-t-2 border-dashed border-black pt-2">NOTE: {notes}</div>
      )}
    </div>
  )

  if (onClose) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="relative w-full max-w-sm max-h-[90vh] flex flex-col bg-card rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <h3 className="font-bold text-foreground text-sm">Kitchen Ticket — {orderNumber}</h3>
            <div className="flex items-center gap-2">
              <button onClick={doPrint} className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto p-4">{preview}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button onClick={doPrint} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
        <Printer className="w-4 h-4" /> Print Kitchen Ticket
      </button>
      {preview}
    </div>
  )
}
