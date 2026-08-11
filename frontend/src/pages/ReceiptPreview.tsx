import { useEffect } from "react"
import { Printer, X } from "lucide-react"
import type { Order } from "../store/orderStore"
import { useSettingsStore } from "../store/settingsStore"

interface ReceiptPreviewProps {
  order?: Order
  autoPrint?: boolean
  onClose?: () => void
}

export default function ReceiptPreview({ order, autoPrint, onClose }: ReceiptPreviewProps) {
  const settings = useSettingsStore()

  // â”€â”€ data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const orderNumber  = order?.orderNumber  ?? "10234"
  const orderType    = order?.orderType    ?? "Dine In"
  const tableNumber  = order?.tableNumber  ?? null
  const cashier      = order?.cashierName  ?? "Ahmed"
  const customerName = order?.customerName ?? null
  const customerPhone = order?.customerPhone ?? null
  const customerAddress = order?.customerAddress ?? null
  const notes        = order?.notes        ?? null
  const paymentStatus = order?.paymentStatus ?? "Unpaid"
  const timestamp    = order ? new Date(order.timestamp) : new Date()
  const dateStr      = timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr      = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const items        = order?.items ?? [] as any[]
  const subtotal     = order?.subtotal  ?? 0
  const serviceCharge = order?.serviceCharge ?? 0
  const deliveryCharge = order?.deliveryCharge ?? 0
  const discount     = order?.discount  ?? 0
  const total        = order?.total     ?? 0

  // â”€â”€ group items by category (same logic as POS) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const groupedItems: Record<string, any[]> = {}
  items.forEach((item: any) => {
    let category = item.category || 'Restaurant'
    const catLower = category.toLowerCase()
    const nameLower = (item.name || '').toLowerCase()
    if (
      catLower.includes('fast food') || catLower.includes('pizza') || catLower.includes('burger') ||
      catLower.includes('roll') || catLower.includes('pasta') || catLower.includes('appetizer') ||
      catLower.includes('sandwich') || catLower.includes('shawarma') || catLower.includes('extra toppings') ||
      nameLower.includes('pizza') || nameLower.includes('burger') || nameLower.includes('roll') ||
      nameLower.includes('pasta') || nameLower.includes('appetizer') || nameLower.includes('sandwich') ||
      nameLower.includes('shawarma') || nameLower.includes('topping')
    ) { category = 'Fast Food' }
    else if (catLower.includes('deal') || nameLower.includes('deal')) { category = 'Deals' }
    else { category = 'Restaurant' }
    if (!groupedItems[category]) groupedItems[category] = []
    groupedItems[category].push(item)
  })
  const categoryOrder = ["Fast Food", "Restaurant", "Deals"]
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const ia = categoryOrder.indexOf(a), ib = categoryOrder.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })

  // â”€â”€ print via isolated window (exactly matching POS layout) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const doPrint = () => {
    const itemsHtml = sortedCategories.map(cat => {
      const rows = groupedItems[cat].map((item: any) => {
        let itemTotal = item.price * item.quantity
        if (item.selectedModifiers?.length) {
          const modTotal = item.selectedModifiers.reduce((s: number, m: any) => s + (m.price || 0), 0)
          itemTotal = (item.price + modTotal) * item.quantity
        }
        const mods = item.selectedModifiers?.length
          ? `<div style="font-size:10px;color:#666;margin-top:2px">${item.selectedModifiers.map((m: any) => '+' + m.name).join(', ')}</div>`
          : ''
        const combos = item.combo_components?.length
          ? `<div style="font-size:10px;color:#666;border-left:1px solid #ccc;padding-left:4px;margin-top:2px">${item.combo_components.map((c: any) => `- ${c.quantity > 1 ? c.quantity + 'x ' : ''}${c.product_name_snapshot || ''}${c.variant_snapshot ? ' (' + c.variant_snapshot + ')' : ''}`).join('<br>')}</div>`
          : ''
        return `
          <div style="border-bottom:1px dashed #999;padding:3px 4px;font-size:11px">
            <div style="display:flex;align-items:flex-start">
              <span style="flex:1;padding-right:4px;line-height:1.3">${item.name}</span>
              <span style="width:28px;text-align:center;flex-shrink:0">${item.quantity}</span>
              <span style="width:56px;text-align:right;flex-shrink:0">Rs ${itemTotal.toFixed(2)}</span>
            </div>${mods}${combos}
          </div>`
      }).join('')
      return `
        <div style="border:2px solid #000;margin-bottom:3px">
          <div style="text-align:center;font-weight:700;font-size:12px;padding:3px;border-bottom:1px dashed #666;text-transform:uppercase">${cat}</div>
          <div style="display:flex;font-weight:700;font-size:11px;border-bottom:1px solid #888;padding:3px 4px">
            <span style="flex:1">Item</span><span style="width:28px;text-align:center">Qty</span><span style="width:56px;text-align:right">Amount</span>
          </div>${rows}
        </div>`
    }).join('')

    const scRow = orderType === 'Dine In' && serviceCharge > 0
      ? `<div style="margin-bottom:3px;text-align:right">Service Charges: Rs ${serviceCharge.toFixed(2)}</div>` : ''
    const dcRow = orderType === 'Delivery' && deliveryCharge > 0
      ? `<div style="margin-bottom:3px;text-align:right">Delivery Charges: Rs ${deliveryCharge.toFixed(2)}</div>` : ''
    const discRow = discount > 0
      ? `<div style="margin-bottom:3px;text-align:right;color:#009900">Discount: -Rs ${discount.toFixed(2)}</div>` : ''
    const tableOrCustomer = orderType === 'Dine In'
      ? `<div style="display:flex"><span style="font-weight:700;width:100px">Table No:</span>${tableNumber || 'N/A'}</div>`
      : `<div style="display:flex"><span style="font-weight:700;width:100px">Customer:</span>${customerName || 'Walk-in'}</div>`
    const phoneRow = orderType !== 'Dine In' && customerPhone
      ? `<div style="display:flex"><span style="font-weight:700;width:100px">Customer Contact:</span>${customerPhone}</div>` : ''
    const addressRow = orderType === 'Delivery' && customerAddress
      ? `<div style="display:flex"><span style="font-weight:700;width:100px">Delivery To:</span>${customerAddress}</div>` : ''
    const notesRow = notes
      ? `<div style="display:flex"><span style="font-weight:700;width:100px">Notes:</span><span style="flex:1">${notes}</span></div>` : ''

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt #${orderNumber}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:sans-serif; background:#fff; color:#000; display:flex; justify-content:center; align-items:flex-start; min-height:100vh; }
    .receipt { width:80mm; max-width:302px; padding:8px; }
    @media print { 
      html, body { width:80mm; display:block; }
      .receipt { width:100%; padding:4px; margin:0; }
      @page { margin:3mm; size:80mm auto; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div style="display:flex;justify-content:center;margin-bottom:6px">
      <div style="display:flex;flex-direction:column;align-items:center">
        <img src="/qr.png" style="width:72px;height:72px;object-fit:contain" onerror="this.style.display='none'">
        <div style="text-align:center;font-weight:700;font-size:14px;line-height:1.2;margin-top:4px">Dubai Food &amp;<br>Restaurant</div>
      </div>
    </div>
    <!-- Address -->
    <div style="text-align:center;font-size:10px;color:#333;line-height:1.4;margin-bottom:10px">
      Opposite Akbar Plaza Near Waqas Nazir Printers Layyah Road,<br>
      Chowk Azam (Layyah)<br>
      Contact: 0308-8020784, 0345-6420784
    </div>
    <!-- Divider -->
    <div style="border-top:1px solid #ccc;margin-bottom:8px"></div>
    <!-- Order Details -->
    <div style="font-size:11px;display:flex;flex-direction:column;gap:2px;font-weight:500;margin-bottom:10px">
      <div style="display:flex"><span style="font-weight:700;width:100px">Order ID:</span>#${orderNumber}</div>
      ${tableOrCustomer}${phoneRow}${addressRow}${notesRow}
      <div style="display:flex"><span style="font-weight:700;width:100px">Order Type:</span>${orderType}</div>
      <div style="display:flex"><span style="font-weight:700;width:100px">Cashier:</span>${cashier}</div>
      <div style="display:flex"><span style="font-weight:700;width:100px">Status:</span>${paymentStatus}</div>
      <div style="display:flex"><span style="font-weight:700;width:100px">Time:</span>${dateStr}, ${timeStr}</div>
    </div>
    <!-- Items -->
    <div style="margin-bottom:8px">${itemsHtml}</div>
    <!-- Totals -->
    <div style="font-size:11px;font-weight:700;display:flex;flex-direction:column;align-items:flex-end;padding-right:2px;margin-bottom:8px">
      <div style="margin-bottom:3px">Subtotal: Rs ${subtotal.toFixed(2)}</div>
      ${scRow}${dcRow}${discRow}
      <div style="font-size:13px;font-weight:900;text-decoration:underline;text-underline-offset:2px">Total Amount: Rs ${total.toFixed(2)}</div>
    </div>
    <!-- Footer -->
    <div style="text-align:center;margin-top:16px;font-size:11px;color:#444;display:flex;flex-direction:column;align-items:center;gap:4px">
      <p>Thank you for your order!</p>
      <p>Please visit again.</p>
      <img src="/logo.jpg" style="width:120px;height:120px;object-fit:contain;margin-top:6px" onerror="this.style.display='none'">
      <span style="font-size:11px;font-weight:700;margin-top:4px">Scan to Pay</span>
    </div>
  </div>
</body>
</html>`

    const pw = window.open('', '_blank', 'width=420,height=780')
    if (!pw) { alert('Please allow popups to print receipts.'); return }
    pw.document.write(html)
    pw.document.close()
    pw.focus()
    setTimeout(() => {
      pw.print()
      setTimeout(() => { pw.close(); if (onClose) onClose() }, 600)
    }, 400)
  }

  // Auto-print on mount
  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(doPrint, 300)
      return () => clearTimeout(t)
    }
  }, [autoPrint])

  // â”€â”€ Preview UI (modal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const receiptPreview = (
    <div className="bg-white text-black font-sans p-4 rounded-lg w-full max-w-sm mx-auto border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex flex-col items-center mb-3">
        <img src="/qr.png" alt="Logo" className="w-16 h-16 object-contain mb-1" onError={(e: any) => e.target.style.display='none'} />
        <div className="text-center font-bold text-sm leading-tight">Dubai Food &<br />Restaurant</div>
      </div>
      <div className="text-center text-[10px] text-gray-600 leading-snug mb-3">
        Opposite Akbar Plaza Near Waqas Nazir Printers Layyah Road,<br />
        Chowk Azam (Layyah)<br />
        Contact: 0308-8020784, 0345-6420784
      </div>
      <div className="border-t border-gray-300 mb-3" />

      {/* Order Details */}
      <div className="text-[11px] flex flex-col gap-0.5 font-medium text-black mb-3">
        <div className="flex"><span className="font-bold w-24">Order ID:</span>#{orderNumber}</div>
        {orderType === 'Dine In' ? (
          <div className="flex"><span className="font-bold w-24">Table No:</span>{tableNumber || 'N/A'}</div>
        ) : (
          <div className="flex"><span className="font-bold w-24">Customer:</span>{customerName || 'Walk-in'}</div>
        )}
        {orderType !== 'Dine In' && customerPhone && (
          <div className="flex"><span className="font-bold w-24">Contact:</span>{customerPhone}</div>
        )}
        {orderType === 'Delivery' && customerAddress && (
          <div className="flex"><span className="font-bold w-24">Delivery To:</span>{customerAddress}</div>
        )}
        {notes && <div className="flex"><span className="font-bold w-24">Notes:</span><span className="flex-1">{notes}</span></div>}
        <div className="flex"><span className="font-bold w-24">Order Type:</span>{orderType}</div>
        <div className="flex"><span className="font-bold w-24">Cashier:</span>{cashier}</div>
        <div className="flex"><span className="font-bold w-24">Status:</span>{paymentStatus}</div>
        <div className="flex"><span className="font-bold w-24">Time:</span>{dateStr}, {timeStr}</div>
      </div>

      {/* Items */}
      <div className="mb-3">
        {sortedCategories.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-3">No items</p>
        ) : sortedCategories.map(cat => (
          <div key={cat} className="border-2 border-black mb-1">
            <div className="text-center font-bold text-[12px] py-1 border-b border-dashed border-gray-500 uppercase">{cat}</div>
            <div className="flex font-bold text-[11px] border-b border-gray-500 py-1 px-1">
              <span className="flex-1">Item</span>
              <span className="w-7 text-center">Qty</span>
              <span className="w-14 text-right">Amount</span>
            </div>
            {groupedItems[cat].map((item: any, idx: number) => {
              let itemTotal = item.price * item.quantity
              if (item.selectedModifiers?.length) {
                const modTotal = item.selectedModifiers.reduce((s: number, m: any) => s + (m.price || 0), 0)
                itemTotal = (item.price + modTotal) * item.quantity
              }
              return (
                <div key={idx} className="border-b border-dashed border-gray-400 p-1 px-1 text-[11px] last:border-b-0">
                  <div className="flex justify-between items-start font-medium">
                    <span className="flex-1 pr-1 leading-tight">{item.name}</span>
                    <span className="w-7 text-center shrink-0">{item.quantity}</span>
                    <span className="w-14 text-right shrink-0">Rs {itemTotal.toFixed(2)}</span>
                  </div>
                  {item.selectedModifiers?.length > 0 && (
                    <div className="text-[10px] text-gray-500 mt-0.5">{item.selectedModifiers.map((m: any) => `+${m.name}`).join(', ')}</div>
                  )}
                  {item.combo_components?.length > 0 && (
                    <div className="text-[10px] text-gray-500 border-l border-gray-300 pl-1 mt-0.5">
                      {item.combo_components.map((c: any, ci: number) => (
                        <div key={ci}>- {c.quantity > 1 ? `${c.quantity}x ` : ''}{c.product_name_snapshot}{c.variant_snapshot ? ` (${c.variant_snapshot})` : ''}</div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="text-[11px] font-bold flex flex-col items-end pr-1 mb-3">
        <div className="mb-1">Subtotal: Rs {subtotal.toFixed(2)}</div>
        {orderType === 'Dine In' && serviceCharge > 0 && <div className="mb-1">Service Charges: Rs {serviceCharge.toFixed(2)}</div>}
        {orderType === 'Delivery' && deliveryCharge > 0 && <div className="mb-1">Delivery Charges: Rs {deliveryCharge.toFixed(2)}</div>}
        {discount > 0 && <div className="mb-1 text-green-600">Discount: -Rs {discount.toFixed(2)}</div>}
        <div className="text-[13px] font-black underline decoration-2 underline-offset-2 mt-1">Total Amount: Rs {total.toFixed(2)}</div>
      </div>

      {/* Footer */}
      <div className="text-center mt-4 text-[11px] text-gray-700 flex flex-col items-center gap-1">
        <p>Thank you for your order!</p>
        <p>Please visit again.</p>
        <img src="/logo.jpg" alt="QR Code" className="w-28 h-28 object-contain mt-2" onError={(e: any) => e.target.style.display='none'} />
        <span className="text-[11px] font-bold mt-1">Scan to Pay</span>
      </div>
    </div>
  )

  // â”€â”€ Modal mode (when onClose is given) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (onClose) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="relative w-full max-w-sm max-h-[90vh] flex flex-col bg-card rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <h3 className="font-bold text-foreground text-sm">Receipt â€” Order #{orderNumber}</h3>
            <div className="flex items-center gap-2">
              <button onClick={doPrint} className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto p-4">{receiptPreview}</div>
        </div>
      </div>
    )
  }

  // â”€â”€ Standalone page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receipt Preview</h1>
          <p className="text-muted-foreground text-sm">Preview and print order receipt.</p>
        </div>
        <button onClick={doPrint} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md shadow-primary/20">
          <Printer className="w-4 h-4" /> Print Receipt
        </button>
      </div>
      <div className="flex justify-center">{receiptPreview}</div>
    </div>
  )
}

