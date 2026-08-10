import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import jsPDF from "jspdf"
import ReceiptPreview from "./ReceiptPreview"
import { useOrderStore, type Order, mapHistoryDetailToOrder } from "../store/orderStore"
import { usePosStore } from "../store/posStore"
import { useAuthStore } from "../store/authStore"
import { fetchOrderDetail } from "../api/historyApi"
import { apiClient } from "../api/client"
import {
  Search, Filter, Clock, Pencil, History, Printer,
  X, AlertTriangle, FileText, Download, RotateCcw, Ban, Plus,
  RefreshCw, ChevronLeft, ChevronRight, CheckCircle2,
  Utensils, DollarSign, Calendar, Info, Copy, Server, MoreVertical, Trash2
} from "lucide-react"
import { deleteOrder } from "../api/historyApi"

// Theme Colors

const orderStatusColors: Record<string, string> = {
  Draft: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  Held: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  Active: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  Refunded: "bg-red-500/10 text-red-500 border-red-500/20"
}

const kitchenStatusColors: Record<string, string> = {
  Pending: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  Sent: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Preparing: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  Ready: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  Served: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  Completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-500 border-red-500/20"
}

const paymentStatusColors: Record<string, string> = {
  Unpaid: "bg-red-500/10 text-red-500 border-red-500/20",
  Paid: "bg-green-500/10 text-green-500 border-green-500/20",
  Refunded: "bg-purple-500/10 text-purple-500 border-purple-500/20"
}

export default function Orders() {
  const navigate = useNavigate()
  const { orders, lockOrder, unlockOrder, updateOrder, addTimelineEvent, addAuditLog, syncOrdersFromBackend } = useOrderStore()
  const { loadOrderForEdit, clearCart } = usePosStore()
  const { user } = useAuthStore()

  // State Management
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState<"general" | "items" | "billing" | "kitchen" | "timeline" | "history">("general")

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const [filterDate, setFilterDate] = useState<string>("Today") // Today, Yesterday, Last 7 Days, Last 30 Days, All
  const [filterType, setFilterType] = useState<string>("All")
  const [filterOrderState, setFilterOrderState] = useState<string>("All")
  const [filterPayment, setFilterPayment] = useState<string>("All")
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("All")
  const [filterCashier, setFilterCashier] = useState<string>("All")
  const [sortBy, setSortBy] = useState<string>("Newest")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState<number>(25)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [printOrder, setPrintOrder] = useState<Order | null>(null)

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(new Set(paginatedOrders.map(o => o.id)))
    } else {
      setSelectedOrderIds(new Set())
    }
  }

  const handleSelectOrder = (id: string) => {
    const newSet = new Set(selectedOrderIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedOrderIds(newSet)
  }

  const handleBulkMarkPaid = async () => {
    if (selectedOrderIds.size === 0) return
    if (!confirm(`Mark ${selectedOrderIds.size} order(s) as paid?`)) return

    for (const id of selectedOrderIds) {
      const order = orders.find(o => o.id === id)
      if (order && order.paymentStatus !== 'Paid') {
        try {
          await apiClient.post(`/payments/order/${id}`, { amount_received: order.total, payment_method: 'CASH' })
          updateOrder(id, { paymentStatus: 'Paid' })
        } catch (e) { }
      }
    }
    syncOrdersFromBackend()
    setSelectedOrderIds(new Set())
  }

  const handleBulkMarkComplete = async () => {
    if (selectedOrderIds.size === 0) return
    if (!confirm(`Mark ${selectedOrderIds.size} order(s) as completed?`)) return

    for (const id of selectedOrderIds) {
      const order = orders.find(o => o.id === id)
      if (order && order.status !== 'Completed') {
        try {
          await apiClient.post(`/orders/${id}/transition`, { targetState: 'COMPLETED' })
          updateOrder(id, { status: 'Completed', kitchenStatus: 'Served' })
        } catch (e) { }
      }
    }
    syncOrdersFromBackend()
    setSelectedOrderIds(new Set())
  }

  const handleBulkDelete = async () => {
    if (selectedOrderIds.size === 0) return
    const pin = prompt("Deleting orders requires Authorization. Enter PIN (1234):")
    if (pin !== '1234') { alert("Unauthorized."); return }

    if (!confirm(`Permanently delete ${selectedOrderIds.size} order(s)? This action cannot be undone.`)) return

    for (const id of selectedOrderIds) {
      try { await deleteOrder(id) } catch (e) { }
    }
    syncOrdersFromBackend()
    setSelectedOrderIds(new Set())
  }

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterDate, filterType, filterPayment, filterPaymentMethod, filterOrderState, filterCashier, sortBy])

  // Initial Data Fetch
  useEffect(() => {
    syncOrdersFromBackend()
  }, [])

  // Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA"
      if (e.key === "F2") { e.preventDefault(); searchInputRef.current?.focus() }
      if (e.key === "Escape" && selectedOrder) { e.preventDefault(); setSelectedOrder(null) }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedOrder])

  // Actions
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await syncOrdersFromBackend()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handlePaymentStatusChange = async (order: Order, newStatus: string) => {
    try {
      if (newStatus === 'Paid' && order.paymentStatus !== 'Paid') {
        await apiClient.post(`/payments/order/${order.id}`, { amount_received: order.total, payment_method: 'CASH' })
      }
      updateOrder(order.id, { paymentStatus: newStatus as any })
      addTimelineEvent(order.id, { event: "Payment Status Changed", remarks: `Changed to ${newStatus}`, cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Payment Status Changed", who: user?.name || "Ahmed", oldValue: order.paymentStatus, newValue: newStatus, reason: "Manual change from badge" })
      await syncOrdersFromBackend()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, paymentStatus: newStatus as any } : null)
    } catch (e) { console.error(e) }
  }

  const handleKitchenStatusChange = async (order: Order, newStatus: string) => {
    try {
      updateOrder(order.id, { kitchenStatus: newStatus as any })
      addTimelineEvent(order.id, { event: "Kitchen Status Changed", remarks: `Changed to ${newStatus}`, cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Kitchen Status Changed", who: user?.name || "Ahmed", oldValue: order.kitchenStatus, newValue: newStatus, reason: "Manual change from badge" })
      await syncOrdersFromBackend()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, kitchenStatus: newStatus as any } : null)
    } catch (e) { console.error(e) }
  }

  const handleOrderStatusChange = async (order: Order, newStatus: string) => {
    try {
      if (newStatus === 'Completed' && order.status !== 'Completed') {
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'COMPLETED' })
      }
      updateOrder(order.id, { status: newStatus as any })
      addTimelineEvent(order.id, { event: "Order Status Changed", remarks: `Changed to ${newStatus}`, cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Status Changed", who: user?.name || "Ahmed", oldValue: order.status, newValue: newStatus, reason: "Manual change from badge" })
      await syncOrdersFromBackend()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null)
    } catch (e) { console.error(e) }
  }


  const exportToPDF = () => {
    const doc = new jsPDF('landscape')
    doc.text("Enterprise Order History", 14, 15)

    const headers = [["Order #", "Date", "Customer", "Table", "Total", "Pay Method", "Pay Status", "Order Status", "Items"]]
    const data = filteredAndSortedOrders.map(o => [
      o.orderNumber,
      new Date(o.timestamp).toLocaleString(),
      o.customerName || 'Guest',
      o.tableNumber || '-',
      o.total.toString(),
      o.payments?.[0]?.method || 'Cash',
      o.paymentStatus,
      o.status,
      o.items.map(i => `${i.quantity}x ${i.name}`).join('\n')
    ])

    // @ts-ignore
    autoTable(doc, {
      head: headers,
      body: data,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [249, 115, 22] } // Orange-500
    })

    doc.save(`Order_History_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const exportToCSV = () => {
    const headers = ["Order Number", "Date", "Customer", "Table", "Total", "Pay Method", "Pay Status", "Order Status", "Items"]
    const rows = filteredAndSortedOrders.map(o => [
      o.orderNumber,
      `"${new Date(o.timestamp).toLocaleString()}"`,
      `"${o.customerName || 'Guest'}"`,
      `"${o.tableNumber || '-'}"`,
      o.total,
      `"${o.payments?.[0]?.method || 'Cash'}"`,
      `"${o.paymentStatus}"`,
      `"${o.status}"`,
      `"${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}"`
    ])

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `Order_History_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleEditClick = async (order: Order) => {
    const cashierName = user?.name || 'Ahmed'
    lockOrder(order.id, cashierName)

    await loadOrderForEdit(order)

    navigate("/pos")
  }

  const handlePrintReceipt = async (order: Order) => {
    updateOrder(order.id, { receiptReprints: (order.receiptReprints || 0) + 1 })
    addTimelineEvent(order.id, { event: "Receipt Printed", remarks: "Printed thermal receipt", cashier: user?.name || "Ahmed" })

    try {
      const res = await fetchOrderDetail(order.id)
      if (res.success && res.data) {
        const fullOrder = mapHistoryDetailToOrder(res.data, res.data)
        setPrintOrder(fullOrder)
      } else {
        setPrintOrder(order)
      }
    } catch (e) {
      setPrintOrder(order)
    }
  }

  const handleDuplicate = (order: Order) => {
    alert(`Duplicating Order #${order.orderNumber} is scheduled for a future update.`)
  }

  const handleCancelOrder = (order: Order) => {
    if (order.status === 'Cancelled') {
      updateOrder(order.id, { status: "Active", kitchenStatus: "Pending" })
      addTimelineEvent(order.id, { event: "Order Uncancelled", remarks: "Uncancelled from Order History", cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Status Changed", who: user?.name || "Ahmed", oldValue: "Cancelled", newValue: "Active", reason: "Uncancel" })
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Active", kitchenStatus: "Pending" } : null)
    } else {
      const reason = prompt("Reason for cancelling this order:")
      if (reason === null) return
      updateOrder(order.id, { status: "Cancelled", kitchenStatus: "Cancelled" })
      addTimelineEvent(order.id, { event: "Order Cancelled", remarks: reason || "Cancelled from Order History", cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Order Cancelled", who: user?.name || "Ahmed", oldValue: order.status, newValue: "Cancelled", reason: reason || "Manager override via OCC" })
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Cancelled", kitchenStatus: "Cancelled" } : null)
    }
  }

  const handleRefund = (order: Order) => {
    const reason = prompt("Reason for refunding this order:")
    if (reason === null) return
    updateOrder(order.id, { paymentStatus: "Refunded", status: "Cancelled" })
    addTimelineEvent(order.id, { event: "Order Refunded", remarks: reason || "Full refund processed", cashier: user?.name || "Ahmed" })
    addAuditLog(order.id, { actionType: "Refund Processed", who: user?.name || "Ahmed", oldValue: order.paymentStatus, newValue: "Refunded", reason: reason || "Full Refund via OCC" })
    if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, paymentStatus: "Refunded", status: "Cancelled" } : null)
  }

  const handleMarkPaid = async (order: Order) => {
    try {
      if (order.paymentStatus === 'Paid') {
        updateOrder(order.id, { paymentStatus: 'Unpaid' })
        addTimelineEvent(order.id, { event: "Marked Unpaid", remarks: "Marked unpaid from Order History", cashier: user?.name || "Ahmed" })
        addAuditLog(order.id, { actionType: "Payment Status Changed", who: user?.name || "Ahmed", oldValue: "Paid", newValue: "Unpaid", reason: "Toggle from History" })
        await syncOrdersFromBackend()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, paymentStatus: "Unpaid" } : null)
      } else {
        await apiClient.post(`/payments/order/${order.id}`, { amount_received: order.total, payment_method: 'CASH' })
        updateOrder(order.id, { paymentStatus: 'Paid' })
        addTimelineEvent(order.id, { event: "Marked Paid", remarks: "Marked paid from Order History", cashier: user?.name || "Ahmed" })
        addAuditLog(order.id, { actionType: "Payment Received", who: user?.name || "Ahmed", oldValue: order.paymentStatus, newValue: "Paid", reason: "Action from History" })
        await syncOrdersFromBackend()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, paymentStatus: "Paid" } : null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleMarkComplete = async (order: Order) => {
    try {
      if (order.status === 'Completed') {
        updateOrder(order.id, { status: 'Active', kitchenStatus: 'Pending' })
        addTimelineEvent(order.id, { event: "Marked Incomplete", remarks: "Marked incomplete from Order History", cashier: user?.name || "Ahmed" })
        addAuditLog(order.id, { actionType: "Status Changed", who: user?.name || "Ahmed", oldValue: "Completed", newValue: "Active", reason: "Action from History" })
        await syncOrdersFromBackend()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Active", kitchenStatus: "Pending" } : null)
      } else {
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'COMPLETED' })
        updateOrder(order.id, { status: 'Completed', kitchenStatus: 'Served' })
        addTimelineEvent(order.id, { event: "Marked Complete", remarks: "Marked complete from Order History", cashier: user?.name || "Ahmed" })
        addAuditLog(order.id, { actionType: "Status Changed", who: user?.name || "Ahmed", oldValue: order.status, newValue: "Completed", reason: "Action from History" })
        await syncOrdersFromBackend()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Completed", kitchenStatus: "Served" } : null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteOrder = async (order: Order) => {
    const pin = prompt("Deleting an order requires Authorization. Enter PIN (1234):")
    if (pin !== '1234') { alert("Unauthorized."); return }


    if (!confirm(`Are you absolutely sure you want to permanently delete order ${order.orderNumber}? This action cannot be undone.`)) return

    try {
      const res = await deleteOrder(order.id)
      if (res.success) {
        alert(`Order ${order.orderNumber} deleted successfully.`)
        if (selectedOrder?.id === order.id) setSelectedOrder(null)
        syncOrdersFromBackend()
      } else {
        alert("Failed to delete order")
      }
    } catch (e) {
      console.error(e)
      alert("Error deleting order. Make sure backend is running.")
    }
  }

  // Filter Logic
  const filteredAndSortedOrders = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart.getTime() - 86400000)
    const last7Start = new Date(todayStart.getTime() - 7 * 86400000)
    const last30Start = new Date(todayStart.getTime() - 30 * 86400000)

    let result = orders.filter(order => {
      // Global Search Match
      const q = searchQuery.toLowerCase()
      const searchMatches = !searchQuery ||
        order.id.toLowerCase().includes(q) ||
        order.orderNumber.includes(q) ||
        (order.customerName || '').toLowerCase().includes(q) ||
        (order.customerPhone || '').includes(q) ||
        (order.cashierName || '').toLowerCase().includes(q) ||
        (order.tableNumber || '').toLowerCase().includes(q) ||
        order.items.some(i => i.name.toLowerCase().includes(q) || (i.code || '').includes(q))

      // Date Filter
      const orderDate = new Date(order.timestamp).getTime()
      let dateMatch = true
      if (filterDate === "Today") dateMatch = orderDate >= todayStart.getTime()
      else if (filterDate === "Yesterday") dateMatch = orderDate >= yesterdayStart.getTime() && orderDate < todayStart.getTime()
      else if (filterDate === "Last 7 Days") dateMatch = orderDate >= last7Start.getTime()
      else if (filterDate === "Last 30 Days") dateMatch = orderDate >= last30Start.getTime()

      // Exact Filters
      const matchType = filterType === "All" || order.orderType === filterType
      const matchOrderState = filterOrderState === "All" || order.status === filterOrderState
      const matchPayment = filterPayment === "All" || order.paymentStatus === filterPayment
      const matchPaymentMethod = filterPaymentMethod === "All" || (order.payments && order.payments.length > 0 && order.payments[0].method === filterPaymentMethod)
      const matchCashierDrop = filterCashier === "All" || order.cashierName === filterCashier

      return searchMatches && dateMatch && matchType && matchOrderState && matchPayment && matchPaymentMethod && matchCashierDrop
    })

    // Sort order
    result.sort((a, b) => {
      if (sortBy === "Newest") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      if (sortBy === "Oldest") return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      if (sortBy === "Highest Amount") return b.total - a.total
      if (sortBy === "Lowest Amount") return a.total - b.total
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return result
  }, [orders, searchQuery, filterDate, filterType, filterPayment, filterPaymentMethod, filterOrderState, filterCashier, sortBy])

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedOrders.length / itemsPerPage)
  const paginatedOrders = filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground">

      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl shadow-sm gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            Order History
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Enterprise Ops</span>
          </h1>
          <p className="text-sm text-muted-foreground font-bold mt-1">
            {filteredAndSortedOrders.length} order(s) found based on current filters.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleRefresh} className={`p-3 bg-secondary hover:bg-border rounded-xl text-muted-foreground transition-colors ${isRefreshing ? 'animate-spin text-primary' : ''}`} title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>

          <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-black hover:bg-secondary/80 transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>

          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-black hover:bg-secondary/80 transition-colors">
            <FileText className="w-4 h-4" /> CSV
          </button>

          <button onClick={() => { clearCart(); navigate("/pos") }} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary/95 shadow-lg shadow-primary/20 transition-all active:scale-95">
            <Plus className="w-5 h-5" /> Create New Order
          </button>
        </div>
      </div>

      {/* SEARCH & FILTERS PANEL */}
      <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-5">
        <div className="flex gap-3 items-center flex-wrap md:flex-nowrap">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order #, Customer, Phone, Table, Cashier, or Items..."
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm font-bold transition-all"
            />
          </div>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`h-12 px-6 rounded-xl border text-xs font-black uppercase transition-all flex items-center gap-2 ${showAdvancedFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary text-muted-foreground hover:border-muted-foreground'
              }`}
          >
            <Filter className="w-4 h-4" /> Advanced Filters
          </button>
        </div>

        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 pt-4 border-t border-border/50">
                <div>
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Date Range</label>
                  <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full h-10 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none">
                    <option value="All">All Time</option>
                    <option value="Today">Today</option>
                    <option value="Yesterday">Yesterday</option>
                    <option value="Last 7 Days">Last 7 Days</option>
                    <option value="Last 30 Days">Last 30 Days</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Order Status</label>
                  <select value={filterOrderState} onChange={(e) => setFilterOrderState(e.target.value)} className="w-full h-10 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none">
                    <option value="All">All Statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Confirmed">Confirmed / Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Payment Status</label>
                  <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="w-full h-10 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none">
                    <option value="All">All Statuses</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Order Type</label>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full h-10 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none">
                    <option value="All">All Types</option>
                    <option value="Dine In">Dine In</option>
                    <option value="Takeaway">Takeaway</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Payment Method</label>
                  <select value={filterPaymentMethod} onChange={(e) => setFilterPaymentMethod(e.target.value)} className="w-full h-10 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none">
                    <option value="All">All Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Debit Card">Card</option>
                    <option value="JazzCash">JazzCash</option>
                    <option value="EasyPaisa">EasyPaisa</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Sort By</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full h-10 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none">
                    <option value="Newest">Newest First</option>
                    <option value="Oldest">Oldest First</option>
                    <option value="Highest Amount">Highest Amount</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={() => {
                    setFilterDate("Today")
                    setFilterType("All")
                    setFilterOrderState("All")
                    setFilterPayment("All")
                    setFilterPaymentMethod("All")
                    setFilterCashier("All")
                    setSortBy("Newest")
                    setSearchQuery("")
                  }} className="w-full h-10 rounded-lg bg-secondary border border-border text-xs font-black uppercase hover:bg-border transition-colors">
                    Reset
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ORDERS TABLE */}
      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col">
        {selectedOrderIds.size > 0 && (
          <div className="bg-primary/10 border-b border-border p-3 flex justify-between items-center px-6">
            <span className="text-sm font-bold text-primary">{selectedOrderIds.size} orders selected</span>
            <div className="flex gap-2">
              <button onClick={handleBulkMarkPaid} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors">Mark Paid</button>
              <button onClick={handleBulkMarkComplete} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors">Mark Complete</button>
              <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors">Delete Selected</button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 bg-secondary z-10 shadow-sm">
              <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground font-black">
                <th className="p-4 w-12 text-center">
                  <input type="checkbox" onChange={handleSelectAll} checked={paginatedOrders.length > 0 && selectedOrderIds.size === paginatedOrders.length} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                </th>
                <th className="p-4">Order #</th>
                <th className="p-4">Date & Time</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Type</th>
                <th className="p-4">Table/Phone</th>
                <th className="p-4">Items</th>
                <th className="p-4">Total</th>
                <th className="p-4">Badges (Pay/Status)</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {paginatedOrders.map((order) => (
                <tr key={order.id} className={`hover:bg-secondary/40 transition-colors group cursor-pointer ${selectedOrderIds.has(order.id) ? 'bg-primary/5' : ''}`} onClick={() => setSelectedOrder(order)}>
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectOrder(order.id)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                  </td>
                  <td className="p-4 font-black">
                    <div className="flex flex-col items-start gap-1">
                      <span>#{order.orderNumber}</span>
                      {order.isEdited && <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase border border-amber-500/20 font-bold tracking-widest leading-none">Edited</span>}
                    </div>
                  </td>
                  <td className="p-4 text-xs font-medium text-muted-foreground">
                    <div>{new Date(order.timestamp).toLocaleDateString()}</div>
                    <div className="font-bold text-foreground">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="p-4 font-bold">
                    {order.customerName || "Guest"}
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-xs bg-secondary px-2 py-1 rounded-md border border-border inline-block mb-1">{order.orderType}</span>
                  </td>
                  <td className="p-4">
                    {order.orderType === 'Dine In' ? (
                      <div className="text-[10px] font-bold text-muted-foreground">Table: {order.tableNumber || "—"}</div>
                    ) : order.orderType === 'Delivery' ? (
                      <div className="text-[10px] font-bold text-muted-foreground">{order.customerPhone || "—"}</div>
                    ) : (
                      <div className="text-[10px] font-bold text-muted-foreground">—</div>
                    )}
                  </td>
                  <td className="p-4 font-bold text-xs">
                    {order.items.reduce((s, i) => s + i.quantity, 0)} Items
                  </td>
                  <td className="p-4 font-black text-primary">
                    Rs {order.total.toLocaleString()}
                    {order.paymentStatus === 'Paid' && (
                      <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                        {order.payments?.[0]?.method || "Cash"}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 w-max">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold w-6">PAY:</span>
                        <select
                          value={order.paymentStatus}
                          onChange={(e) => handlePaymentStatusChange(order, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className={`text-[9px] pl-1.5 pr-4 py-0.5 rounded font-black uppercase border cursor-pointer outline-none ${paymentStatusColors[order.paymentStatus] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}
                        >
                          {Object.keys(paymentStatusColors).map(status => (
                            <option key={status} value={status} className="bg-card text-foreground">{status}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold w-6">KIT:</span>
                        <select
                          value={order.kitchenStatus}
                          onChange={(e) => handleKitchenStatusChange(order, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className={`text-[9px] pl-1.5 pr-4 py-0.5 rounded font-black uppercase border cursor-pointer outline-none ${kitchenStatusColors[order.kitchenStatus] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}
                        >
                          {Object.keys(kitchenStatusColors).map(status => (
                            <option key={status} value={status} className="bg-card text-foreground">{status}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold w-6">ORD:</span>
                        <select
                          value={order.status}
                          onChange={(e) => handleOrderStatusChange(order, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className={`text-[9px] pl-1.5 pr-4 py-0.5 rounded font-black uppercase border cursor-pointer outline-none ${orderStatusColors[order.status] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}
                        >
                          {Object.keys(orderStatusColors).map(status => (
                            <option key={status} value={status} className="bg-card text-foreground">{status}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="grid grid-cols-4 gap-1 w-[140px] ml-auto" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSelectedOrder(order)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center" title="View Details"><FileText className="w-4 h-4" /></button>
                      <button onClick={() => handlePrintReceipt(order)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-primary transition-colors flex items-center justify-center" title="Print/Reprint Receipt"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => handleEditClick(order)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-amber-500 transition-colors flex items-center justify-center" title="Edit Order"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteOrder(order)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-red-600 transition-colors flex items-center justify-center" title="Delete Order"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-bold">No orders found matching the criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-secondary/30 border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-muted-foreground">
          <div className="flex items-center gap-2">
            Show
            <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="bg-card border border-border rounded-lg px-2 py-1 outline-none">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            entries
          </div>
          <div>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedOrders.length)} of {filteredAndSortedOrders.length} entries
          </div>
          <div className="flex items-center gap-1">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-1.5 bg-card hover:bg-secondary border border-border rounded-lg disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3">Page {currentPage} of {totalPages || 1}</span>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-1.5 bg-card hover:bg-secondary border border-border rounded-lg disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* ENTERPRISE DRAWER: VIEW DETAILS */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="relative w-full max-w-4xl bg-card h-full shadow-2xl flex flex-col border-l border-border">

              {/* Drawer Header */}
              <div className="p-6 border-b border-border bg-secondary/30 flex items-start justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-black">Order #{selectedOrder.orderNumber}</h2>
                    <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest border ${orderStatusColors[selectedOrder.status]}`}>{selectedOrder.status}</span>
                  </div>
                  <p className="text-sm font-bold text-muted-foreground">{new Date(selectedOrder.timestamp).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePrintReceipt(selectedOrder)} className="px-4 py-2 bg-secondary border border-border rounded-xl text-xs font-black flex items-center gap-2 hover:bg-border transition-colors"><Printer className="w-4 h-4" /> Print</button>
                  <button onClick={() => setSelectedOrder(null)} className="p-2 bg-secondary border border-border rounded-xl hover:bg-border transition-colors"><X className="w-5 h-5" /></button>
                </div>
              </div>

              {/* Drawer Tabs */}
              <div className="flex overflow-x-auto border-b border-border hide-scrollbar shrink-0 px-2">
                {[
                  { id: "general", icon: Info, label: "General" },
                  { id: "items", icon: Utensils, label: "Items" },
                  { id: "billing", icon: DollarSign, label: "Billing & Payment" },
                  { id: "kitchen", icon: Server, label: "Kitchen & Sync" },
                  { id: "timeline", icon: Clock, label: "Timeline" },
                  { id: "history", icon: History, label: "Edit History" },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-4 border-b-2 text-sm font-black whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
              </div>

              {/* Drawer Content Area */}
              <div className="flex-1 overflow-auto p-6 bg-background custom-scrollbar">

                {/* 1. General Tab */}
                {activeTab === "general" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-secondary/30 rounded-2xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Customer</p>
                        <p className="text-base font-black">{selectedOrder.customerName || "Guest"}</p>
                        <p className="text-sm font-bold mt-1 text-muted-foreground">{selectedOrder.customerPhone || "No Phone Number"}</p>
                      </div>
                      <div className="p-4 bg-secondary/30 rounded-2xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Order Details</p>
                        <p className="text-base font-black">{selectedOrder.orderType}</p>
                        <p className="text-sm font-bold mt-1 text-muted-foreground">Table: {selectedOrder.tableNumber || "N/A"} • Guests: {selectedOrder.guestCount || 1}</p>
                      </div>
                      <div className="p-4 bg-secondary/30 rounded-2xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Staff</p>
                        <p className="text-base font-black">{selectedOrder.cashierName}</p>
                      </div>
                      <div className="p-4 bg-secondary/30 rounded-2xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                        <p className="text-sm font-bold">{selectedOrder.notes || "No general notes provided."}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Items Tab */}
                {activeTab === "items" && (
                  <div className="space-y-4">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex gap-4 p-4 border border-border rounded-2xl bg-card items-center">
                        <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center shrink-0">
                          <Utensils className="w-6 h-6 text-muted-foreground opacity-50" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-base">{item.name}</h4>
                          {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                            <p className="text-xs text-muted-foreground font-bold mt-1">Mods: {item.selectedModifiers.map(m => m.name).join(", ")}</p>
                          )}
                          {item.notes && <p className="text-xs text-amber-500 font-bold mt-1">Note: {item.notes}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-muted-foreground">{item.quantity}x @ Rs. {item.price}</p>
                          <p className="text-lg font-black text-primary mt-1">Rs. {(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Billing & Payment Tab */}
                {activeTab === "billing" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h3 className="font-black text-lg mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Billing Summary</h3>
                      <div className="space-y-3 text-sm font-bold">
                        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>Rs. {selectedOrder.subtotal.toLocaleString()}</span></div>
                        {selectedOrder.serviceCharge > 0 && (
                          <div className="flex justify-between text-muted-foreground"><span>Service Charges</span><span>Rs. {selectedOrder.serviceCharge.toLocaleString()}</span></div>
                        )}
                        {selectedOrder.deliveryCharge !== undefined && selectedOrder.deliveryCharge > 0 && (
                          <div className="flex justify-between text-muted-foreground"><span>Delivery Charges</span><span>Rs. {selectedOrder.deliveryCharge.toLocaleString()}</span></div>
                        )}
                        {selectedOrder.tax > 0 && (
                          <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>Rs. {selectedOrder.tax.toLocaleString()}</span></div>
                        )}
                        <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>- Rs. {selectedOrder.discount.toLocaleString()}</span></div>
                        <div className="pt-3 border-t border-border flex justify-between text-lg font-black text-foreground">
                          <span>Grand Total</span><span>Rs. {selectedOrder.total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h3 className="font-black text-lg mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-500" /> Payment Information</h3>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest border ${paymentStatusColors[selectedOrder.paymentStatus]}`}>{selectedOrder.paymentStatus}</span>
                        </div>
                        {selectedOrder.payments?.map((pay, i) => (
                          <div key={i} className="p-3 bg-secondary/50 rounded-xl border border-border text-sm font-bold">
                            <div className="flex justify-between mb-2"><span className="text-foreground">{pay.method}</span><span className="text-primary">Rs. {pay.amount.toLocaleString()}</span></div>
                            <div className="flex justify-between text-xs text-muted-foreground"><span>Received: Rs. {pay.received || pay.amount}</span><span>Change: Rs. {pay.change || 0}</span></div>
                            <div className="text-xs text-muted-foreground mt-2">{new Date(pay.timestamp).toLocaleString()} • by {pay.cashier}</div>
                          </div>
                        )) || <p className="text-sm font-bold text-muted-foreground">No payment records found.</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Kitchen & Sync Tab */}
                {activeTab === "kitchen" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h3 className="font-black text-lg mb-4">Kitchen Information</h3>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest border ${kitchenStatusColors[selectedOrder.kitchenStatus]}`}>{selectedOrder.kitchenStatus}</span>
                        </div>
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <p className="text-xs font-bold text-amber-600 uppercase mb-1">Kitchen Notes</p>
                          <p className="text-sm font-bold text-amber-700">{selectedOrder.kitchenNotes || "No kitchen notes."}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h3 className="font-black text-lg mb-4">System & Sync</h3>
                      <div className="space-y-3 text-sm font-bold">
                        <div className="flex justify-between"><span className="text-muted-foreground">Sync Status</span><span className="text-primary">{selectedOrder.syncStatus || 'Synced'}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Receipt Reprints</span><span>{selectedOrder.receiptReprints || 0} times</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Timeline Tab */}
                {activeTab === "timeline" && (
                  <div className="max-w-2xl mx-auto py-4">
                    <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-6 before:w-0.5 before:bg-border">
                      {selectedOrder.timeline.map((event, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[30px] bg-card border-2 border-primary w-4 h-4 rounded-full mt-1.5 z-10" />
                          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                            <p className="font-black text-foreground">{event.event}</p>
                            {event.remarks && <p className="text-sm text-muted-foreground font-bold mt-1">{event.remarks}</p>}
                            <div className="flex items-center gap-2 mt-3 text-xs font-bold text-muted-foreground">
                              <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                              <span>•</span>
                              <span>By {event.cashier}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Edit History & Audit Log */}
                {activeTab === "history" && (
                  <div className="space-y-4">
                    {selectedOrder.auditLog && selectedOrder.auditLog.length > 0 ? (
                      selectedOrder.auditLog.map((log, idx) => (
                        <div key={idx} className="bg-card border border-border rounded-2xl p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-xs font-black bg-secondary px-2 py-1 rounded-md uppercase text-primary border border-primary/20">{log.actionType}</span>
                              <p className="text-sm font-bold mt-2">By {log.who} at {new Date(log.when).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-3 bg-secondary/30 p-3 rounded-xl border border-border/50 text-sm font-bold">
                            <div><p className="text-xs text-muted-foreground uppercase mb-1">Previous Value</p><p className="line-through opacity-70">{log.oldValue}</p></div>
                            <div><p className="text-xs text-muted-foreground uppercase mb-1">New Value</p><p className="text-emerald-500">{log.newValue}</p></div>
                          </div>
                          {log.reason && <p className="text-xs font-bold text-muted-foreground mt-3 italic">Reason: {log.reason}</p>}
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-12 text-muted-foreground">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-bold">No edits or audit logs found for this order.</p>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-border bg-secondary/30 flex justify-end gap-3 shrink-0">
                <button onClick={() => handleDuplicate(selectedOrder)} className="px-5 py-2.5 bg-card hover:bg-secondary border border-border rounded-xl text-sm font-black transition-colors">Duplicate Order</button>
                <button onClick={() => handleEditClick(selectedOrder)} className="px-5 py-2.5 bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-xl text-sm font-black transition-colors">Edit Order</button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="hidden">
        {printOrder && <ReceiptPreview order={printOrder} autoPrint={true} onClose={() => setPrintOrder(null)} />}
      </div>
    </div>
  )
}
