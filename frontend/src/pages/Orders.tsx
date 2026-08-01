import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useOrderStore, type Order } from "../store/orderStore"
import { usePosStore } from "../store/posStore"
import { useAuthStore } from "../store/authStore"
import { 
  Search, Filter, Clock, Pencil, History, Edit, Printer, CheckCircle, 
  X, AlertTriangle, FileText, Download, RotateCcw, Ban, Plus, 
  RefreshCw 
} from "lucide-react"

// Status color definitions
const orderStatusColors: Record<string, string> = {
  Draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  Confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20"
}

const kitchenStatusColors: Record<string, string> = {
  Waiting: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Accepted: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Preparing: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Ready: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Served: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20"
}

const paymentStatusColors: Record<string, string> = {
  Unpaid: "bg-red-500/10 text-red-400 border-red-500/20",
  "Partial Paid": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Paid: "bg-green-500/10 text-green-400 border-green-500/20",
  Refunded: "bg-purple-500/10 text-purple-400 border-purple-500/20"
}

export default function Orders() {
  const navigate = useNavigate()
  const { orders, lockOrder, unlockOrder, updateOrder, addTimelineEvent, addAuditLog } = useOrderStore()
  const { loadOrderForEdit, clearCart } = usePosStore()
  const { user } = useAuthStore()

  // State Management
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filterType, setFilterType] = useState<string>("All")
  const [filterKitchen, setFilterKitchen] = useState<string>("All")
  const [filterPayment, setFilterPayment] = useState<string>("All")
  const [filterOrderState, setFilterOrderState] = useState<string>("All")
  const [filterCashier, setFilterCashier] = useState<string>("All")
  const [sortBy, setSortBy] = useState<string>("Newest")
  const [minAmount, setMinAmount] = useState<string>("")
  const [maxAmount, setMaxAmount] = useState<string>("")
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  // Clock & Refresh Simulation
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<"details" | "timeline" | "audit">("details")

  // Refs for shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterType, filterKitchen, filterPayment, filterOrderState, filterCashier, minAmount, maxAmount, sortBy, activeKpiFilter])

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in inputs but keep F-keys
      const isInputFocused = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA"
      
      // F2: Search
      if (e.key === "F2") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      
      // F3: Toggle filters
      if (e.key === "F3") {
        e.preventDefault()
        setShowAdvancedFilters(prev => !prev)
      }

      // Esc: Close Drawer
      if (e.key === "Escape" && selectedOrder) {
        e.preventDefault()
        setSelectedOrder(null)
      }

      // Selected Order shortcuts (need an active selectedOrder)
      if (selectedOrder) {

        // Ctrl+E: Edit
        if (e.ctrlKey && e.key === "e") {
          e.preventDefault()
          handleEditClick(selectedOrder)
        }

        // Ctrl+P: Print Receipt
        if (e.ctrlKey && e.key === "p" && !e.shiftKey) {
          e.preventDefault()
          handlePrintReceipt(selectedOrder)
        }

        // Ctrl+Shift+P: Print Kitchen Ticket
        if (e.ctrlKey && e.shiftKey && e.key === "p") {
          e.preventDefault()
          handlePrintKitchen(selectedOrder)
        }

        // Ctrl+D: Duplicate
        if (e.ctrlKey && e.key === "d") {
          e.preventDefault()
          alert(`Duplicating Order #${selectedOrder.orderNumber}`)
        }

        // Ctrl+R: Refund
        if (e.ctrlKey && e.key === "r") {
          e.preventDefault()
          handleMarkRefunded(selectedOrder)
        }

        // Ctrl+Shift+C: Cancel
        if (e.ctrlKey && e.shiftKey && e.key === "c") {
          e.preventDefault()
          handleCancelOrder(selectedOrder)
        }
      } else {
        // Table navigation via Arrow Keys if no drawer is open
        if (!isInputFocused && orders.length > 0) {
          const visibleOrders = filteredAndSortedOrders
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setSelectedOrder(visibleOrders[0])
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedOrder, orders, user])

  // Bulk operation actions
  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredAndSortedOrders.length) {
      setSelectedOrderIds([])
    } else {
      setSelectedOrderIds(filteredAndSortedOrders.map(o => o.id))
    }
  }

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  // Refresh trigger simulation
  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }

  // Action methods
  const handleEditClick = (order: Order) => {
    const cashierName = user?.name || 'Ahmed'

    if (order.paymentStatus === 'Paid') {
      const pin = prompt("Editing a Paid order requires Manager Authorization. Enter PIN (1234):")
      if (pin !== '1234') {
        alert("Unauthorized Manager PIN.")
        return
      }
    }

    if (order.status === 'Cancelled') {
      const pin = prompt("Modifying a Cancelled order requires Manager Authorization. Enter PIN (1234):")
      if (pin !== '1234') {
        alert("Unauthorized Manager PIN.")
        return
      }
    }

    if (order.isLocked && order.lockedBy !== cashierName) {
      const proceed = confirm(`Order #${order.orderNumber} is locked by ${order.lockedBy}. Force unlock?`)
      if (!proceed) return
      unlockOrder(order.id, true)
    }

    lockOrder(order.id, cashierName)
    clearCart()
    loadOrderForEdit(order)
    navigate("/pos")
  }

  const handlePrintReceipt = (order: Order) => {
    addTimelineEvent(order.id, {
      event: "Receipt Printed",
      remarks: "Printed thermal receipt from Order Control Center",
      cashier: user?.name || "Ahmed"
    })
    window.print()
  }

  const handlePrintKitchen = (order: Order) => {
    addTimelineEvent(order.id, {
      event: "Kitchen Ticket Reprinted",
      remarks: "Reprinted kitchen ticket from Order Control Center",
      cashier: user?.name || "Ahmed"
    })
    alert(`Reprinting kitchen ticket for Order #${order.orderNumber} to KDS printer.`)
  }

  const handleCancelOrder = (order: Order) => {
    const pin = prompt("Cancelling an order requires Manager Authorization. Enter PIN (1234):")
    if (pin !== '1234') {
      alert("Unauthorized Manager PIN.")
      return
    }
    updateOrder(order.id, { status: "Cancelled", kitchenStatus: "Cancelled" })
    addTimelineEvent(order.id, {
      event: "Order Cancelled",
      remarks: "Cancelled from Order Management",
      cashier: user?.name || "Ahmed"
    })
    addAuditLog(order.id, { actionType: "Order Cancelled", who: user?.name || "Ahmed", oldValue: order.status, newValue: "Cancelled", reason: "Order Cancelled via OCC" })
    alert(`Order #${order.orderNumber} has been successfully Cancelled.`)
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(prev => prev ? { ...prev, status: "Cancelled", kitchenStatus: "Cancelled" } : null)
    }
  }

  const handleMarkPaid = (order: Order) => {
    updateOrder(order.id, { paymentStatus: "Paid" })
    addTimelineEvent(order.id, {
      event: "Payment Confirmed",
      remarks: "Marked Paid from Order Management",
      cashier: user?.name || "Ahmed"
    })
    alert(`Order #${order.orderNumber} has been marked as Paid.`)
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(prev => prev ? { ...prev, paymentStatus: "Paid" } : null)
    }
  }

  const handleMarkRefunded = (order: Order) => {
    const pin = prompt("Processing a Refund requires Manager Authorization. Enter PIN (1234):")
    if (pin !== '1234') {
      alert("Unauthorized Manager PIN.")
      return
    }
    updateOrder(order.id, { paymentStatus: "Refunded", status: "Cancelled" })
    addTimelineEvent(order.id, {
      event: "Order Refunded",
      remarks: "Full refund processed",
      cashier: user?.name || "Ahmed"
    })
    addAuditLog(order.id, { actionType: "Other", who: user?.name || "Ahmed", oldValue: order.paymentStatus, newValue: "Refunded", reason: "Full Refund via OCC" })
    alert(`Order #${order.orderNumber} has been refunded and cancelled.`)
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(prev => prev ? { ...prev, paymentStatus: "Refunded", status: "Cancelled" } : null)
    }
  }

  // Dynamic calculations for filters & search
  const filteredAndSortedOrders = useMemo(() => {
    let result = orders.filter(order => {
      // Global Search Match
      const q = searchQuery.toLowerCase()
      const matchId = order.id.toLowerCase().includes(q) || order.orderNumber.includes(q)
      const matchCustomer = (order.customerName || '').toLowerCase().includes(q)
      const matchPhone = (order.customerPhone || '').includes(q)
      const matchCashier = (order.cashierName || '').toLowerCase().includes(q)
      const matchTable = (order.tableNumber || '').toLowerCase().includes(q)
      const matchItemName = order.items.some(i => i.name.toLowerCase().includes(q) || (i.code || '').includes(q))
      
      const searchMatches = !searchQuery || matchId || matchCustomer || matchPhone || matchCashier || matchTable || matchItemName

      // Category / Dropdown Filters
      const matchType = filterType === "All" || order.orderType === filterType
      const matchKitchen = filterKitchen === "All" || order.kitchenStatus === filterKitchen
      const matchPayment = filterPayment === "All" || order.paymentStatus === filterPayment
      const matchOrderState = filterOrderState === "All" || order.status === filterOrderState
      const matchCashierDrop = filterCashier === "All" || order.cashierName === filterCashier
      
      // Amount Range
      const matchMinAmount = !minAmount || order.total >= parseFloat(minAmount)
      const matchMaxAmount = !maxAmount || order.total <= parseFloat(maxAmount)

      // KPI Quick Filters
      let matchKpi = true
      if (activeKpiFilter) {
        if (activeKpiFilter === "Preparing") matchKpi = order.kitchenStatus === "Preparing"
        else if (activeKpiFilter === "Ready") matchKpi = order.kitchenStatus === "Ready"
        else if (activeKpiFilter === "Served") matchKpi = order.kitchenStatus === "Served"
        else if (activeKpiFilter === "Completed") matchKpi = order.status === "Completed"
        else if (activeKpiFilter === "Cancelled") matchKpi = order.status === "Cancelled"
        else if (activeKpiFilter === "Paid") matchKpi = order.paymentStatus === "Paid"
        else if (activeKpiFilter === "Unpaid") matchKpi = order.paymentStatus === "Unpaid"
        else if (activeKpiFilter === "Refunded") matchKpi = order.paymentStatus === "Refunded"
        else if (activeKpiFilter === "Edited") matchKpi = Boolean(order.auditLog && order.auditLog.length > 0)
      }

      return searchMatches && matchType && matchKitchen && matchPayment && matchOrderState && matchCashierDrop && matchMinAmount && matchMaxAmount && matchKpi
    })

    // Sort order
    result.sort((a, b) => {
      if (sortBy === "Newest") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      if (sortBy === "Oldest") return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      if (sortBy === "Highest Amount") return b.total - a.total
      if (sortBy === "Lowest Amount") return a.total - b.total
      if (sortBy === "Longest Waiting") return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return result
  }, [orders, searchQuery, filterType, filterKitchen, filterPayment, filterOrderState, filterCashier, minAmount, maxAmount, sortBy, activeKpiFilter])

  // KPI statistics numbers
  const kpis = useMemo(() => {
    const totalToday = orders.length
    const preparing = orders.filter(o => o.kitchenStatus === "Preparing").length
    const ready = orders.filter(o => o.kitchenStatus === "Ready").length
    const served = orders.filter(o => o.kitchenStatus === "Served").length
    const completed = orders.filter(o => o.status === "Completed").length
    const cancelled = orders.filter(o => o.status === "Cancelled").length
    const paid = orders.filter(o => o.paymentStatus === "Paid").length
    const unpaid = orders.filter(o => o.paymentStatus === "Unpaid").length
    const refunded = orders.filter(o => o.paymentStatus === "Refunded").length
    const edited = orders.filter(o => o.auditLog && o.auditLog.length > 0).length
    const totalRevenue = orders.filter(o => o.status === "Completed" || o.status === "Confirmed").reduce((s, o) => s + o.total, 0)
    const aov = totalToday > 0 ? Math.round(totalRevenue / totalToday) : 0

    return { totalToday, preparing, ready, served, completed, cancelled, paid, unpaid, refunded, edited, totalRevenue, aov }
  }, [orders])

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground">
      
      {/* ==================================================
          HEADER SECTION
          ================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Order Control Center
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Enterprise Ops</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Business Day: 6AM–6AM
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleRefresh}
            className={`p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border relative transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh Orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => alert("Exporting data: Excel/CSV reports generated.")}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
          >
            <Download className="w-4 h-4" /> Export Report
          </button>

          <button 
            onClick={() => {
              clearCart()
              navigate("/pos")
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Create New Order
          </button>
        </div>
      </div>

      {/* ==================================================
          SUMMARY AND FILTER TABS
          ================================================== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="font-black text-sm text-foreground">
          {kpis.totalToday} orders · Rs. {kpis.totalRevenue.toLocaleString()} total
        </div>
        
        <div className="flex flex-wrap gap-2">
          {[
            { key: null, label: "All", count: kpis.totalToday },
            { key: "Preparing", label: "Preparing", count: kpis.preparing },
            { key: "Ready", label: "Ready", count: kpis.ready },
            { key: "Served", label: "Served", count: kpis.served },
            { key: "Completed", label: "Completed", count: kpis.completed },
            { key: "Cancelled", label: "Cancelled", count: kpis.cancelled },
            { key: "Paid", label: "Paid", count: kpis.paid },
            { key: "Unpaid", label: "Unpaid", count: kpis.unpaid },
            { key: "Edited", label: "Edited", count: kpis.edited }
          ].map((tab) => (
            <button
              key={tab.key || "All"}
              onClick={() => setActiveKpiFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all border ${
                activeKpiFilter === tab.key 
                  ? 'bg-foreground text-background border-foreground' 
                  : 'bg-secondary/50 text-muted-foreground border-border hover:bg-secondary hover:text-foreground'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================
          SEARCH & FILTERS PANEL
          ================================================== */}
      <div className="bg-card border border-border rounded-3xl p-4 shadow-sm space-y-4">
        
        {/* Top search block */}
        <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-4 h-4" /></span>
            <input 
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order Number, Customer Name, Table, Cashier, Products... [Press F2 to focus]"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-sm font-bold text-foreground placeholder:text-muted-foreground transition-all"
            />
          </div>
          <button 
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`h-11 px-4 rounded-xl border text-xs font-black uppercase transition-all flex items-center gap-2 ${
              showAdvancedFilters 
                ? 'bg-orange-500/10 border-orange-500 text-orange-500' 
                : 'bg-secondary text-muted-foreground border-border hover:border-muted-foreground'
            }`}
          >
            <Filter className="w-4 h-4" /> Advanced Filters
          </button>
        </div>

        {/* Dropdown Filters Expandable Area */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 pt-2 border-t border-border/50"
            >
              {/* Type Filter */}
              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Order Type</label>
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All Types</option>
                  <option value="Dine In">Dine In</option>
                  <option value="Takeaway">Takeaway</option>
                  <option value="Delivery">Delivery</option>
                </select>
              </div>

              {/* Kitchen Filter */}
              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Kitchen Status</label>
                <select 
                  value={filterKitchen}
                  onChange={(e) => setFilterKitchen(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All statuses</option>
                  <option value="Waiting">Waiting</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Preparing">Preparing</option>
                  <option value="Ready">Ready</option>
                  <option value="Served">Served</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Payment Filter */}
              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Payment Status</label>
                <select 
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All bills</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partial Paid">Partial Paid</option>
                  <option value="Paid">Paid</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              {/* Order status Filter */}
              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Order Status</label>
                <select 
                  value={filterOrderState}
                  onChange={(e) => setFilterOrderState(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All states</option>
                  <option value="Draft">Draft</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Cashier selection */}
              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Cashier</label>
                <select 
                  value={filterCashier}
                  onChange={(e) => setFilterCashier(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All Cashiers</option>
                  <option value="Ahmed">Ahmed</option>
                  <option value="Umar">Umar</option>
                  <option value="Ali">Ali</option>
                </select>
              </div>

              {/* Sort Order selection */}
              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Sort By</label>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="Newest">Newest First</option>
                  <option value="Oldest">Oldest First</option>
                  <option value="Highest Amount">Highest Amount</option>
                  <option value="Lowest Amount">Lowest Amount</option>
                  <option value="Longest Waiting">Longest Waiting</option>
                </select>
              </div>

              {/* Quick Reset */}
              <div className="flex items-end">
                <button 
                  onClick={() => {
                    setFilterType("All")
                    setFilterKitchen("All")
                    setFilterPayment("All")
                    setFilterOrderState("All")
                    setFilterCashier("All")
                    setSortBy("Newest")
                    setMinAmount("")
                    setMaxAmount("")
                    setActiveKpiFilter(null)
                    setSearchQuery("")
                  }}
                  className="w-full h-9 rounded-lg border border-border hover:bg-secondary text-xs font-black uppercase text-center transition-colors"
                >
                  Reset filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bulk operation header */}
      {selectedOrderIds.length > 0 && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between gap-4 animate-fadeIn">
          <p className="text-xs font-black text-primary">
            {selectedOrderIds.length} orders selected for bulk operations.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => alert(`Bulk printing receipts for orders: ${selectedOrderIds.join(", ")}`)}
              className="px-3 py-1.5 bg-secondary text-foreground hover:bg-border rounded-xl text-[10px] font-black border border-border uppercase transition-colors"
            >
              Print Receipt
            </button>
            <button 
              onClick={() => {
                selectedOrderIds.forEach(id => updateOrder(id, { paymentStatus: "Paid" }))
                setSelectedOrderIds([])
                alert("Selected orders marked Paid.")
              }}
              className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-[10px] font-black uppercase transition-all"
            >
              Mark Paid
            </button>
            <button 
              onClick={() => {
                setSelectedOrderIds([])
                alert("Selected orders archived.")
              }}
              className="px-3 py-1.5 bg-secondary text-foreground hover:bg-border rounded-xl text-[10px] font-black border border-border uppercase transition-colors"
            >
              Archive
            </button>
          </div>
        </div>
      )}

      {/* ==================================================
          ORDER TABLE / GRID LISTING
          ================================================== */}
      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col max-h-[700px]">
        {/* Sticky Table Header */}
        <div 
          className="grid gap-4 p-4 border-b border-border bg-secondary/30 font-bold text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground sticky top-0 z-20 min-w-[1000px]"
          style={{ gridTemplateColumns: "1fr 0.8fr 0.6fr 1.5fr 1fr 0.8fr 1.8fr 1fr 1fr 120px" }}
        >
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={filteredAndSortedOrders.length > 0 && selectedOrderIds.length === filteredAndSortedOrders.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded bg-background border-border text-primary focus:ring-primary focus:ring-2 outline-none cursor-pointer"
            />
            <span>Order #</span>
          </div>
          <div>Type</div>
          <div className="text-center">Table</div>
          <div>Customer</div>
          <div>Cashier</div>
          <div className="text-center">Items</div>
          <div>Status Badges</div>
          <div className="text-right">Created</div>
          <div className="text-right">Total</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Rows Container */}
        <div className="flex-1 overflow-auto custom-scrollbar p-2 space-y-1 relative min-h-[350px]">
          {filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((order) => {
            const isSelected = selectedOrder?.id === order.id
            const isRowChecked = selectedOrderIds.includes(order.id)
            const elapsedMins = Math.round((Date.now() - new Date(order.timestamp).getTime()) / 60000)
            const hasAudit = order.auditLog && order.auditLog.length > 0

            return (
              <div 
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`grid gap-4 p-4 hover:bg-secondary/60 items-center rounded-xl border transition-all cursor-pointer group min-w-[1000px] ${
                  isSelected 
                    ? 'bg-primary/5 border-primary shadow-sm' 
                    : 'bg-card border-transparent hover:border-border'
                }`}
                style={{ gridTemplateColumns: "1fr 0.8fr 0.6fr 1.5fr 1fr 0.8fr 1.8fr 1fr 1fr 120px" }}
              >
                {/* Checkbox and Order Number */}
                <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={isRowChecked}
                      onChange={() => toggleSelectOrder(order.id)}
                      className="w-4 h-4 rounded bg-background border-border text-primary focus:ring-primary focus:ring-2 outline-none cursor-pointer"
                    />
                    <span className="font-black text-foreground">#{order.orderNumber}</span>
                  </div>
                  {hasAudit && (
                    <div className="pl-7">
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1 rounded font-black border border-amber-500/20 uppercase tracking-wide">EDITED</span>
                    </div>
                  )}
                </div>

                {/* Type */}
                <div>
                  <span className="text-xs font-semibold text-foreground">{order.orderType}</span>
                </div>

                {/* Table */}
                <div className="text-center font-bold text-xs text-foreground">
                  {order.tableNumber || "—"}
                </div>

                {/* Customer */}
                <div className="text-xs font-bold text-foreground truncate">
                  {order.customerName || "Walk-In Guest"}
                </div>

                {/* Cashier */}
                <div className="text-xs text-muted-foreground font-semibold truncate">
                  {order.cashierName}
                </div>

                {/* Items Count */}
                <div className="text-center font-bold text-xs text-foreground">
                  {order.items.reduce((sum, i) => sum + i.quantity, 0)} items
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-1 items-center">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${orderStatusColors[order.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                    {order.status}
                  </span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${kitchenStatusColors[order.kitchenStatus] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                    Kit: {order.kitchenStatus}
                  </span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${paymentStatusColors[order.paymentStatus] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                    Pay: {order.paymentStatus}
                  </span>
                </div>

                {/* Created */}
                <div className="text-right text-xs text-muted-foreground font-medium">
                  {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  <div className="text-[9px] font-semibold opacity-75 mt-0.5">{elapsedMins}m ago</div>
                </div>

                {/* Total */}
                <div className="text-right shrink-0">
                  <span className="font-black text-primary">Rs. {order.total.toLocaleString()}</span>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => setSelectedOrder(order)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                    title="View Details"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleEditClick(order)}
                    disabled={order.status === "Cancelled" || order.paymentStatus === "Paid" || order.paymentStatus === "Refunded"}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
                    title="Edit Order"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleCancelOrder(order)}
                    disabled={order.status === "Cancelled" || order.status === "Completed"}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
                    title="Cancel Order"
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleMarkRefunded(order)}
                    disabled={order.paymentStatus === "Unpaid" || order.paymentStatus === "Refunded"}
                    className="p-1.5 text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
                    title="Refund Order"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            )
          })}

          {filteredAndSortedOrders.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold text-sm">No orders matching selected search query or filters.</p>
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        {filteredAndSortedOrders.length > 0 && (
          <div className="p-4 border-t border-border bg-secondary/30 flex justify-between items-center text-xs font-bold text-muted-foreground">
            <div>
              Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredAndSortedOrders.length)} of {filteredAndSortedOrders.length} orders
            </div>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-card hover:bg-secondary disabled:opacity-50 border border-border rounded-lg transition-colors"
              >
                Previous
              </button>
              <button 
                disabled={currentPage * itemsPerPage >= filteredAndSortedOrders.length}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1.5 bg-card hover:bg-secondary disabled:opacity-50 border border-border rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================
          ORDER DETAIL DRAWER (RIGHT SIDE SLIDE-OUT)
          ================================================== */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            
            {/* Drawer */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 overflow-hidden"
            >
              
              {/* Header */}
              <div className="p-6 border-b border-border bg-secondary/30 flex justify-between items-center shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-foreground">Order Details</h2>
                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-black">
                      #{selectedOrder.orderNumber}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold mt-1">
                    Invoice: <span className="text-foreground">INV-{selectedOrder.orderNumber}</span> • {new Date(selectedOrder.timestamp).toLocaleString()}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs selector */}
              <div className="flex items-center gap-6 px-6 border-b border-border bg-card shrink-0">
                <button 
                  onClick={() => setActiveTab("details")} 
                  className={`py-3 font-black text-xs uppercase tracking-wider border-b-2 transition-colors ${
                    activeTab === 'details' ? 'border-orange-500 text-orange-500' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Items & Receipt
                </button>
                <button 
                  onClick={() => setActiveTab("timeline")} 
                  className={`py-3 font-black text-xs uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'timeline' ? 'border-orange-500 text-orange-500' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <History className="w-3.5 h-3.5" /> Timeline ({selectedOrder.timeline?.length || 0})
                </button>
                <button 
                  onClick={() => setActiveTab("audit")} 
                  className={`py-3 font-black text-xs uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'audit' ? 'border-orange-500 text-orange-500' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <History className="w-3.5 h-3.5" /> Edit History ({selectedOrder.auditLog?.length || 0})
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-background/50">
                
                {/* Details Tab */}
                {activeTab === "details" && (
                  <div className="space-y-6">
                    
                    {/* Metadata Section */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-card border border-border rounded-2xl">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-black">Customer Name</span>
                        <p className="font-bold text-xs text-foreground mt-0.5">{selectedOrder.customerName || "Walk-In Guest"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-black">Customer Phone</span>
                        <p className="font-bold text-xs text-foreground mt-0.5">{selectedOrder.customerPhone || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-black">Table & Type</span>
                        <p className="font-bold text-xs text-foreground mt-0.5">{selectedOrder.orderType} {selectedOrder.tableNumber ? `• ${selectedOrder.tableNumber}` : ''}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-black">Cashier</span>
                        <p className="font-bold text-xs text-foreground mt-0.5">{selectedOrder.cashierName}</p>
                      </div>
                    </div>

                    {/* Status badges summary */}
                    <div className="flex gap-2">
                      <div className="flex-1 p-3 bg-card border border-border rounded-xl text-center">
                        <span className="text-[9px] text-muted-foreground uppercase font-black">Order Status</span>
                        <div className="mt-1 flex justify-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${orderStatusColors[selectedOrder.status]}`}>
                            {selectedOrder.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 p-3 bg-card border border-border rounded-xl text-center">
                        <span className="text-[9px] text-muted-foreground uppercase font-black">Kitchen status</span>
                        <div className="mt-1 flex justify-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${kitchenStatusColors[selectedOrder.kitchenStatus]}`}>
                            {selectedOrder.kitchenStatus}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 p-3 bg-card border border-border rounded-xl text-center">
                        <span className="text-[9px] text-muted-foreground uppercase font-black">Payment Status</span>
                        <div className="mt-1 flex justify-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${paymentStatusColors[selectedOrder.paymentStatus]}`}>
                            {selectedOrder.paymentStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Receipt Items Preview */}
                    <div className="p-5 bg-card border border-border rounded-[2rem] shadow-sm font-mono text-xs text-foreground">
                      <div className="text-center pb-4 border-b border-dashed border-border mb-4">
                        <h4 className="font-black text-sm uppercase">DUBAI FOOD SOFTWARE</h4>
                        <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">DUBAI MAIN BRANCH</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Tel: 0300-1234567</p>
                      </div>

                      <div className="space-y-3 mb-4">
                        {selectedOrder.items.map((item, i) => (
                          <div key={i} className="flex justify-between items-start">
                            <div>
                              <p className="font-bold">{item.quantity}x {item.name}</p>
                              {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                                <p className="text-[10px] text-muted-foreground pl-3">
                                  {item.selectedModifiers.map(m => `+ ${m.name}`).join(", ")}
                                </p>
                              )}
                              {item.notes && <p className="text-[10px] text-orange-500 pl-3">Instruction: {item.notes}</p>}
                            </div>
                            <span className="font-bold">Rs. {((item.price + item.selectedModifiers.reduce((s,m)=>s+m.price, 0)) * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-dashed border-border pt-3 space-y-1 text-right">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>Rs. {selectedOrder.subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax:</span>
                          <span>Rs. {selectedOrder.tax.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Service Charge:</span>
                          <span>Rs. {selectedOrder.serviceCharge.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-black text-sm pt-2 border-t border-dashed border-border">
                          <span>Total Amount:</span>
                          <span>Rs. {selectedOrder.total.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Payment Detail */}
                      <div className="mt-4 pt-3 border-t border-dashed border-border text-[10px] space-y-1">
                        <div className="flex justify-between">
                          <span>Payment Method:</span>
                          <span className="font-bold">{selectedOrder.payments?.[0]?.method || "Cash"}</span>
                        </div>
                        {(selectedOrder.payments?.[0]?.method || "Cash") === "Cash" && (
                          <>
                            <div className="flex justify-between">
                              <span>Amount Received:</span>
                              <span>Rs. {selectedOrder.total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Change returned:</span>
                              <span>Rs. 0</span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="text-center pt-4 border-t border-dashed border-border mt-4">
                        <p className="font-bold text-[10px]">Thank you for dining with us!</p>
                        <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">Software by Antigravity AI</p>
                      </div>
                    </div>

                    {/* Operational Notes */}
                    <div className="space-y-2">
                      <h4 className="text-xs uppercase font-black tracking-wider text-muted-foreground">Order Notes</h4>
                      <div className="p-3 bg-secondary/50 border border-border rounded-xl text-xs font-bold text-foreground">
                        {selectedOrder.notes || "No special instructions logged for this order."}
                      </div>
                    </div>

                  </div>
                )}

                {/* Timeline Tab */}
                {activeTab === "timeline" && (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {!selectedOrder.timeline || selectedOrder.timeline.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-bold text-center py-6">No timeline events logged.</p>
                    ) : (
                      selectedOrder.timeline.map((event, idx) => (
                        <div key={idx} className="relative flex gap-3 items-start">
                          <div className="absolute -left-[23px] bg-background p-0.5 rounded-full border border-border">
                            <Clock className="w-3.5 h-3.5 text-orange-500" />
                          </div>
                          <div className="bg-card border border-border rounded-xl p-4 flex-1 shadow-sm">
                            <div className="flex justify-between items-center">
                              <p className="text-xs font-black text-foreground">{event.event}</p>
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-bold mt-1">by {event.cashier} • Device: POS-Terminal-1</p>
                            {event.remarks && (
                              <p className="text-[10px] font-bold text-foreground mt-2 p-2 bg-secondary rounded-lg border border-border/50">
                                {event.remarks}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Audit Tab */}
                {activeTab === "audit" && (
                  <div className="space-y-4">
                    {!selectedOrder.auditLog || selectedOrder.auditLog.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-border rounded-xl">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-bold text-muted-foreground">No edits made.</p>
                      </div>
                    ) : (
                      selectedOrder.auditLog.map((log) => (
                        <div key={log.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                              {log.actionType}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              {new Date(log.when).toLocaleTimeString()}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 bg-secondary rounded-xl border border-border border-dashed">
                              <span className="text-[9px] text-muted-foreground uppercase font-black">Before</span>
                              <p className="font-bold line-through opacity-60 mt-0.5 truncate">{log.oldValue}</p>
                            </div>
                            <div className="p-2 bg-amber-500/5 rounded-xl border border-amber-500/20">
                              <span className="text-[9px] text-amber-500 uppercase font-black">After</span>
                              <p className="font-bold text-amber-600 mt-0.5 truncate">{log.newValue}</p>
                            </div>
                          </div>

                          <div className="text-[10px] font-bold text-muted-foreground flex justify-between items-center pt-2 border-t border-border/30">
                            <span>Edited by: <span className="text-foreground">{log.who}</span></span>
                            {log.reason && <span>Reason: <span className="text-foreground">{log.reason}</span></span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>

              {/* Footer Drawer Action panel */}
              <div className="p-6 border-t border-border bg-card grid grid-cols-2 gap-2 shrink-0">
                <button 
                  onClick={() => handlePrintReceipt(selectedOrder)}
                  className="py-3 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4" /> Print Receipt
                </button>

                <button 
                  onClick={() => handleEditClick(selectedOrder)}
                  className="py-3 bg-primary text-white hover:bg-primary/95 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary/10"
                >
                  <Edit className="w-4 h-4" /> Edit Order
                </button>

                {selectedOrder.paymentStatus !== "Paid" && (
                  <button 
                    onClick={() => handleMarkPaid(selectedOrder)}
                    className="col-span-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Complete Payment
                  </button>
                )}

                {selectedOrder.paymentStatus === "Paid" && (
                  <button 
                    onClick={() => handleMarkRefunded(selectedOrder)}
                    className="py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-black text-[10px] uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Full Refund
                  </button>
                )}

                <button 
                  onClick={() => handleCancelOrder(selectedOrder)}
                  className={`py-2.5 font-black text-[10px] uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                    selectedOrder.status === "Cancelled" 
                      ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/15 cursor-not-allowed'
                      : 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20'
                  }`}
                  disabled={selectedOrder.status === "Cancelled"}
                >
                  <Ban className="w-3.5 h-3.5" /> Cancel Order
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
