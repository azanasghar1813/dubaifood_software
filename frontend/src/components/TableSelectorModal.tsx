import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Clock, X } from "lucide-react"
import { usePosStore, type Table, type TableStatus } from "../store/posStore"

interface TableSelectorModalProps {
  isOpen: boolean
  onClose: () => void
}

const GROUND_TABLES = Array.from({ length: 12 }, (_, i) => ({ id: `G${i + 1}`, label: `G${i + 1}`, zone: 'Ground' as const, status: 'Available' as TableStatus }))
const FAMILY_TABLES = Array.from({ length: 6 }, (_, i) => ({ id: `F${i + 1}`, label: `F${i + 1}`, zone: 'Family Hall' as const, status: 'Available' as TableStatus }))
const ROOFTOP_TABLES = Array.from({ length: 8 }, (_, i) => ({ id: `T${i + 1}`, label: `T${i + 1}`, zone: 'Rooftop' as const, status: 'Available' as TableStatus }))

const ALL_TABLES: Table[] = [...GROUND_TABLES, ...FAMILY_TABLES, ...ROOFTOP_TABLES]

export function TableSelectorModal({ isOpen, onClose }: TableSelectorModalProps) {
  const { openOrders, switchOrder, setTableNumber, activeOrderId } = usePosStore()
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("")
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Enhance tables with live data from openOrders
  const enhancedTables = ALL_TABLES.map(t => {
    const orderForTable = Object.values(openOrders).find(o => o.tableNumber === t.label)
    // If there's an open order mapped to this table, infer its status
    let status = t.status
    let amount = 0
    let elapsed = 0
    let customerName = ""

    if (orderForTable && orderForTable.cart.length > 0) {
      status = 'Occupied'
      if (orderForTable.orderStatus === 'Ready') status = 'Ready'
      if (orderForTable.orderStatus === 'Preparing') status = 'Preparing'
      
      const sub = orderForTable.cart.reduce((total, item) => total + ((item.price * item.quantity) - item.discount), 0)
      amount = sub
      elapsed = Math.floor((new Date().getTime() - new Date(orderForTable.startTime).getTime()) / 60000)
      if (orderForTable.customer) customerName = orderForTable.customer.name
    }

    // if this is the currently active order (not yet pushed to openOrders, or currently active)
    const store = usePosStore.getState()
    if (store.tableNumber === t.label && store.cart.length > 0) {
      status = 'Occupied'
      amount = store.getSubtotal()
      elapsed = Math.floor((new Date().getTime() - new Date(store.startTime).getTime()) / 60000)
      if (store.customer) customerName = store.customer.name
    }

    return { ...t, status, amount, elapsed, customerName }
  })

  const filteredTables = enhancedTables.filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase()))

  // Auto-select table when typing an exact match
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const exactMatch = enhancedTables.find(t => t.label.toLowerCase() === searchQuery.toLowerCase())
      if (exactMatch) {
        handleSelect(exactMatch)
      }
    }
  }, [searchQuery])

  const handleSelect = (table: Table) => {
    // If we click a table, we check if an order exists for it
    const orderForTable = Object.values(openOrders).find(o => o.tableNumber === table.label)
    
    if (orderForTable) {
      switchOrder(orderForTable.id)
    } else {
      // Create a new order ID specifically for this table instance
      const newOrderId = `ORD-${table.label}-${Date.now()}`
      switchOrder(newOrderId)
      setTableNumber(table.label)
    }
    onClose()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-secondary text-muted-foreground border-transparent hover:border-orange-500'
      case 'Occupied': return 'bg-orange-500 text-white border-transparent shadow-lg shadow-orange-500/20'
      case 'Preparing': return 'bg-yellow-500 text-white border-transparent'
      case 'Ready': return 'bg-green-500 text-white border-transparent'
      default: return 'bg-secondary text-muted-foreground border-transparent'
    }
  }

  const TableGrid = ({ title, tables }: { title: string, tables: any[] }) => (
    <div className="mb-6">
      <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-6 gap-3">
        {tables.map(t => (
          <button
            key={t.id}
            onClick={() => handleSelect(t)}
            className={`relative flex flex-col p-3 rounded-xl border-2 transition-all h-24 ${getStatusColor(t.status)} ${activeOrderId === t.label ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-background' : ''}`}
          >
            <div className="flex items-center justify-between w-full mb-auto">
              <span className="font-black text-lg">{t.label}</span>
              {t.status !== 'Available' && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
            </div>
            
            {t.status !== 'Available' ? (
              <div className="w-full text-left mt-auto">
                <p className="text-[10px] font-bold opacity-90 truncate">{t.customerName || 'Walk-in'}</p>
                <div className="flex items-center justify-between text-[10px] font-bold mt-1 opacity-75">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.elapsed}m</span>
                  <span>AED {t.amount.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="w-full text-left mt-auto opacity-50">
                <p className="text-xs font-bold">Available</p>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }} 
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-background w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh] border border-border"
        >
          <div className="p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-black text-foreground">Table Management</h2>
              <p className="text-xs text-muted-foreground font-bold">Select a table or type to jump instantly</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Type table (e.g. G5)..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold uppercase"
                />
              </div>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {/* Quick Actions & Status Legend */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-2">Status:</span>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-secondary"></div><span className="text-xs font-bold">Available</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="text-xs font-bold text-orange-500">Occupied</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div><span className="text-xs font-bold text-yellow-500">Preparing</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-xs font-bold text-green-500">Ready</span></div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 text-xs font-bold bg-secondary hover:bg-orange-500 hover:text-white rounded-lg transition-colors border border-border hover:border-orange-500">Move Table</button>
                <button className="px-4 py-2 text-xs font-bold bg-secondary hover:bg-orange-500 hover:text-white rounded-lg transition-colors border border-border hover:border-orange-500">Merge Tables</button>
                <button className="px-4 py-2 text-xs font-bold bg-secondary hover:bg-orange-500 hover:text-white rounded-lg transition-colors border border-border hover:border-orange-500">Split Table</button>
              </div>
            </div>

            <TableGrid title="Ground Floor" tables={filteredTables.filter(t => t.zone === 'Ground')} />
            <TableGrid title="Family Hall" tables={filteredTables.filter(t => t.zone === 'Family Hall')} />
            <TableGrid title="Rooftop" tables={filteredTables.filter(t => t.zone === 'Rooftop')} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
