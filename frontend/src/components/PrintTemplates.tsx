import React from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { usePrinterStore } from '../store/printerStore'
import type { PrintJob } from '../store/printerStore'
import { useKdsStore } from '../store/kdsStore'
import { useOrderStore } from '../store/orderStore'
import { QRCodeSVG } from 'qrcode.react'

export const PrintTemplates: React.FC = () => {
  const { printQueue } = usePrinterStore()
  const printingJobs = printQueue.filter(j => j.status === ('Printing' as any))

  return (
    <div className="hidden print:block absolute inset-0 bg-white z-[9999] w-full">
      {printingJobs.map(job => (
        <PrintJobRenderer key={job.id} job={job} />
      ))}
    </div>
  )
}

const PrintJobRenderer: React.FC<{ job: PrintJob }> = ({ job }) => {
  if (job.job_type === 'Receipt') return <ReceiptTemplate job={job} />
  if ((job as any).type === 'KitchenTicket') return <KitchenTicketTemplate job={job} />
  return null
}

const ReceiptTemplate: React.FC<{ job: PrintJob }> = ({ job }) => {
  const settings = useSettingsStore(s => (s as any).settings)
  const printSettings = usePrinterStore(s => s.settings)
  
  // Try to parse the order ID from content
  let orderId = ''
  try {
    orderId = JSON.parse((job as any).content).orderId
  } catch (e) {
    return null
  }

  const order = useOrderStore(s => s.orders.find(o => o.id === orderId))
  if (!order) return null

  return (
    <div className={`p-4 mx-auto text-black font-mono`} style={{ width: printSettings.receiptWidth }}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-2xl font-black mb-1">{settings.businessName}</div>
        <div className="text-sm">{settings.address}</div>
        <div className="text-sm">Tel: {settings.phone}</div>
        {settings.trn && <div className="text-sm mt-1">TRN: {settings.trn}</div>}
      </div>

      <div className="border-t border-b border-black py-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span>Order #: {order.orderNumber}</span>
          <span>{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex justify-between">
          <span>{new Date(order.timestamp).toLocaleDateString()}</span>
          <span>Cashier: {order.cashierName}</span>
        </div>
        <div className="flex justify-between">
          <span>Type: {order.orderType}</span>
          <span>{order.customerName && order.customerName !== 'Guest' ? `Cust: ${order.customerName}` : ''}</span>
        </div>
        {order.customerPhone && (
          <div className="flex justify-start text-xs mt-1">
            <span>Phone: {order.customerPhone}</span>
          </div>
        )}
        {order.orderType === 'Delivery' && order.customerAddress && (
          <div className="flex justify-start text-xs font-bold mt-1">
            <span>Deliver To: {order.customerAddress}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1">Item</th>
            <th className="text-center py-1">Qty</th>
            <th className="text-right py-1">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-1">
                <div className="font-bold">{item.name}</div>
                {item.selectedModifiers?.map(m => (
                  <div key={m.name} className="text-xs pl-2">+ {m.name}</div>
                ))}
              </td>
              <td className="text-center py-1">{item.quantity}</td>
              <td className="text-right py-1">
                {settings.currencySymbol} {(item.price * item.quantity).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t border-black pt-2 text-sm space-y-1 mb-6">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{settings.currencySymbol} {order.subtotal.toFixed(2)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>- {settings.currencySymbol} {order.discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Tax</span>
          <span>{settings.currencySymbol} {order.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-black text-base mt-2 pt-2 border-t border-black">
          <span>GRAND TOTAL</span>
          <span>{settings.currencySymbol} {order.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center justify-center space-y-4 mb-8">
        <QRCodeSVG value={`https://verify.dubaifood.com/order/${order.id}`} size={100} />
        <div className="text-center text-sm">
          {printSettings.receiptFooter}
        </div>
      </div>
      
      {/* Cut placeholder */}
      {printSettings.cutPaper && (
        <div className="text-center text-xs text-gray-400 mt-10">--- Cut ---</div>
      )}
    </div>
  )
}

const KitchenTicketTemplate: React.FC<{ job: PrintJob }> = ({ job }) => {
  const printSettings = usePrinterStore(s => s.settings)
  
  let ticketId = ''
  try {
    ticketId = JSON.parse((job as any).content).ticketId
  } catch (e) {
    return null
  }

  const ticket = useKdsStore(s => s.tickets.find(t => t.id === ticketId))
  if (!ticket) return null

  const isEdit = ticket.notes === 'EDITED TICKET'

  return (
    <div className={`p-4 mx-auto text-black font-mono`} style={{ width: printSettings.receiptWidth }}>
      {/* Header */}
      <div className="text-center mb-4">
        <div className="text-2xl font-black mb-1 uppercase">{ticket.kitchen}</div>
        <div className="text-xl font-bold border-y-2 border-black py-1 my-2">
          {isEdit ? '*** MODIFIED TICKET ***' : 'KITCHEN TICKET'}
        </div>
      </div>

      <div className="text-sm font-bold mb-4 space-y-1">
        <div className="text-xl">Order #: {ticket.orderNumber}</div>
        <div>Type: {ticket.orderType}</div>
        {ticket.orderType === 'Dine In' && <div>Table: {ticket.table}</div>}
        <div>Time: {new Date(ticket.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      {/* Items */}
      <div className="border-t border-b-2 border-black py-4 mb-4">
        {ticket.items.map((item, idx) => (
          <div key={idx} className="mb-4">
            <div className="flex items-start gap-2 text-lg">
              {item.type === 'ADD' && <span className="font-black border border-black px-1">+ADD</span>}
              {item.type === 'REMOVE' && <span className="font-black border border-black px-1 line-through">-REM</span>}
              
              <span className="font-black min-w-[2ch]">{item.quantity}x</span>
              <span className={`font-bold ${item.type === 'REMOVE' ? 'line-through' : ''}`}>{item.name}</span>
            </div>
            
            {item.modifiers?.length > 0 && (
              <div className="pl-8 text-sm mt-1 space-y-1">
                {item.modifiers.map(m => (
                  <div key={m.name}>- {m.name}</div>
                ))}
              </div>
            )}
            
            {item.notes && (
              <div className="pl-8 text-sm italic font-bold mt-1">
                Note: {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {printSettings.cutPaper && (
        <div className="text-center text-xs text-gray-400 mt-10">--- Cut ---</div>
      )}
    </div>
  )
}
