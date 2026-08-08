import { useEffect } from "react"
import { Printer, Share2, X } from "lucide-react"
import type { Order } from "../store/orderStore"
import { useSettingsStore } from "../store/settingsStore"

interface ReceiptPreviewProps {
  order?: Order
  autoPrint?: boolean
  onClose?: () => void
}

export default function ReceiptPreview({ order, autoPrint, onClose }: ReceiptPreviewProps) {
  const settings = useSettingsStore()

  useEffect(() => {
    if (autoPrint) {
      // Small timeout to ensure rendering is complete before printing
      const timer = setTimeout(() => {
        window.print()
      }, 500)
      
      // Cleanup
      return () => clearTimeout(timer)
    }
  }, [autoPrint])

  // Use order data if available, otherwise use dummy data for the standalone preview page
  const orderNumber = order ? order.orderNumber : "10234"
  const date = order ? new Date(order.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "26 Jul 2026"
  const time = order ? new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "12:45 PM"
  const cashier = order ? order.cashierName : "Ahmed"
  const subtotal = order ? order.subtotal : 39.48
  const tax = order ? order.tax : (39.48 * (settings.taxRate / 100))
  const total = order ? order.total : (39.48 + tax)
  const items = order ? order.items : [
    { name: "Classic Cheeseburger", quantity: 2, price: 12.99, category: "Fast Food" },
    { name: "Coca Cola", quantity: 2, price: 2.50, category: "Fast Food" },
    { name: "Truffle Fries", quantity: 1, price: 8.50, category: "Restaurant" },
    { name: "Combo Meal", quantity: 1, price: 15.00, category: "Deals" }
  ] as any[]

  // Group items by category
  const groupedItems = items.reduce((acc: any, item) => {
    let category = item.category || 'Restaurant';
    const catLower = category.toLowerCase();
    const nameLower = (item.name || '').toLowerCase();
    if (
      catLower.includes('fast food') || 
      catLower.includes('pizza') || 
      catLower.includes('burger') ||
      catLower.includes('roll') ||
      catLower.includes('pasta') ||
      catLower.includes('appetizer') ||
      catLower.includes('sandwich') ||
      catLower.includes('shawarma') ||
      catLower.includes('extra toppings') ||
      nameLower.includes('pizza') ||
      nameLower.includes('burger') ||
      nameLower.includes('roll') ||
      nameLower.includes('pasta') ||
      nameLower.includes('appetizer') ||
      nameLower.includes('sandwich') ||
      nameLower.includes('shawarma') ||
      nameLower.includes('topping')
    ) {
      category = 'Fast Food';
    } else if (catLower.includes('deal') || nameLower.includes('deal')) {
      category = 'Deals';
    } else {
      category = 'Restaurant';
    }
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof items>)

  // Sort categories: Fast Food first, then Restaurant, then Deals, then others
  const categoryOrder = ["Fast Food", "Restaurant", "Deals"]
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const idxA = categoryOrder.indexOf(a)
    const idxB = categoryOrder.indexOf(b)
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return a.localeCompare(b)
  })

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10 relative">
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-0 right-0 z-10 p-2 bg-gray-100 rounded-full hover:bg-gray-200"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      )}

      {!order && !autoPrint && (
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Receipt Preview</h1>
            <p className="text-muted-foreground text-sm">Preview and print order receipt.</p>
          </div>
          <div className="flex gap-2">
            <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2">
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md shadow-primary/20">
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-center print:flex print:justify-center print:absolute print:top-0 print:left-0 print:w-full print:bg-white print:z-[9999]">
        {/* Receipt Paper UI */}
        <div className="bg-white text-black w-full max-w-sm p-8 shadow-2xl relative print:w-[80mm] print:max-w-[300px] print:shadow-none print:p-2 print:text-left">
          {/* Jagged edge top */}
          <div className="absolute top-0 left-0 w-full h-2 bg-repeat-x flex">
            {Array.from({length: 40}).map((_, i) => (
              <div key={i} className="w-2 h-2 bg-background rotate-45 -mt-1" />
            ))}
          </div>

          <div className="text-center mb-6 pt-4 border-b border-gray-300 pb-6 flex flex-col items-center">
            <img src="/qr.png" alt="Logo" className="w-24 h-24 object-contain rounded-full mb-3" />
            <h2 className="text-2xl font-black mb-1">{settings.restaurantName.toUpperCase()}</h2>
            <p className="text-xs text-gray-600">{settings.address}</p>
            <p className="text-xs text-gray-600">Tel: {settings.phoneNumber}</p>
            <p className="text-xs text-gray-600 mt-2">TRN: {settings.trn}</p>
          </div>

          <div className="flex justify-between text-xs mb-4">
            <div>
              <p>Order: <span className="font-bold">{orderNumber}</span></p>
              <p>Date: {date}</p>
            </div>
            <div className="text-right">
              <p>Cashier: {cashier}</p>
              <p>Time: {time}</p>
            </div>
          </div>

          <div className="mb-4 flex flex-col">
            {sortedCategories.map((category) => (
              <div key={category} className="border-2 border-black border-b-0 last:border-b-2">
                <div className="text-center font-bold text-[13px] py-1 border-b border-dashed border-gray-500 uppercase">
                  {category}
                </div>
                {groupedItems[category].map((item: any, idx: number) => {
                  let itemTotal = item.price * item.quantity;
                  if (item.selectedModifiers && Array.isArray(item.selectedModifiers)) {
                     const modTotal = item.selectedModifiers.reduce((sum: number, mod: any) => sum + mod.price, 0);
                     itemTotal = (item.price + modTotal) * item.quantity;
                  }

                  return (
                    <div key={idx} className="border-b border-dashed border-gray-500 p-1 px-2 text-[11px] last:border-b-0">
                      <div className="flex justify-between font-medium">
                        <span>{item.quantity > 1 ? `${item.quantity}x ` : ''}{item.name}</span>
                        <span>Rs {itemTotal.toFixed(2)}</span>
                      </div>
                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <div className="text-[10px] text-gray-500 leading-tight">
                          {item.selectedModifiers.map((m: any) => `+${m.name}`).join(', ')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="space-y-1 text-sm text-right mb-6">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{settings.currencySymbol} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>VAT ({settings.taxRate}%):</span>
              <span>{settings.currencySymbol} {tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-300 mt-2">
              <span>TOTAL:</span>
              <span>{settings.currencySymbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="text-center text-xs text-gray-600 mt-6 flex flex-col items-center">
            <p className="font-bold mb-2">{settings.receiptFooter}</p>
            <img src="/logo.jpg" alt="QR Code" className="mx-auto w-40 h-40 object-contain mb-1" />
            <span className="text-[11px] font-bold mt-1">Scan to Pay</span>
          </div>

          {/* Jagged edge bottom */}
          <div className="absolute bottom-0 left-0 w-full h-2 bg-repeat-x flex overflow-hidden">
             {Array.from({length: 40}).map((_, i) => (
              <div key={i} className="w-2 h-2 bg-background rotate-45 -mb-1" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
