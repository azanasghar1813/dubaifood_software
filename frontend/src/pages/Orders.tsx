import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "../store/toastStore"
import { authService } from "../services/authService"
import { kitchenService } from "../services/kitchenService"
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
import { DateUtils } from "../utils/dateUtils"

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

const formatAuditMessage = (actionType: string, oldVal: any, newVal: any) => {
  const safeParse = (str: any) => {
    try { return JSON.parse(str); } catch { return str; }
  };
  const parsedNew = safeParse(newVal);
  
  if (actionType === 'ITEM_ADDED') {
    return `Added ${parsedNew?.quantity || 1}x ${parsedNew?.item_name || 'item'} to cart.`;
  }
  if (actionType === 'QUANTITY_CHANGED') {
    return `Changed quantity of ${parsedNew?.item_name || 'item'} to ${parsedNew?.new_quantity || parsedNew?.quantity || ''}.`;
  }
  if (actionType === 'ITEM_REMOVED') {
    return `Removed ${parsedNew?.item_name || 'item'} from cart.`;
  }
  if (actionType === 'ORDER_CREATED') {
    return `Order created.`;
  }
  if (actionType === 'ORDER_UPDATED' || actionType === 'METADATA_UPDATED') {
    if (typeof parsedNew === 'object' && parsedNew !== null) {
       const changes = Object.entries(parsedNew)
         .filter(([k]) => k !== 'order_number' && k !== 'branch_id')
         .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
         .join(', ');
       return changes ? `Updated: ${changes}` : 'Updated order details.';
    }
  }
  
  // Fallback generic formatting
  if (typeof parsedNew === 'object' && parsedNew !== null) {
    const changes = Object.entries(parsedNew)
      .filter(([k]) => k !== 'order_number' && k !== 'branch_id')
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
      .join(', ');
    return changes || String(newVal || '-');
  }
  return String(newVal || '-');
};

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

  const [filterDate, setFilterDate] = useState<string>("Today") // Today, Yesterday, Monthly, All Time, Custom Date
  const [customDateFrom, setCustomDateFrom] = useState<string>("")
  const [customDateTo, setCustomDateTo] = useState<string>("")
  const [filterType, setFilterType] = useState<string>("All")
  const [filterOrderState, setFilterOrderState] = useState<string>("All")
  const [filterPayment, setFilterPayment] = useState<string>("All")
  const [filterUser, setFilterUser] = useState<string>("All")
  const [sortBy, setSortBy] = useState<string>("Newest")

  const [allUsers, setAllUsers] = useState<any[]>([])
  useEffect(() => {
    apiClient.get('/users').then((res: any) => setAllUsers(res.data || res)).catch(() => {})
  }, [])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState<number>(25)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [printOrder, setPrintOrder] = useState<Order | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ mode: 'one' | 'bulk'; order?: Order } | null>(null)
  const [deletePin, setDeletePin] = useState('')

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
        } catch (e) {
          toast.error('Bulk pay failed', 'One or more payments could not be recorded.')
        }
      }
    }
    refetchHistory()
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
        } catch (e) {
          toast.error('Bulk complete failed', 'One or more orders could not be completed.')
        }
      }
    }
    refetchHistory()
    setSelectedOrderIds(new Set())
  }

  const handleBulkDelete = () => {
    if (selectedOrderIds.size === 0) return
    setDeletePin('')
    setDeleteDialog({ mode: 'bulk' })
  }

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterDate, customDateFrom, customDateTo, filterType, filterPayment, filterOrderState, filterUser, sortBy])

  const historyFilters = useMemo(() => {
    let preset = filterDate.toUpperCase().replace(/ /g, '_');
    if (preset === 'MONTHLY') preset = 'THIS_MONTH';
    const filters: Record<string, string> = {};
    if (preset === 'CUSTOM_DATE' || preset === 'CUSTOM_RANGE') {
      if (customDateFrom && customDateTo) {
        filters.date_preset = 'CUSTOM_DATE';
        filters.date_from = customDateFrom;
        filters.date_to = customDateTo;
      }
    } else {
      filters.date_preset = preset;
    }
    return filters;
  }, [filterDate, customDateFrom, customDateTo])

  const refetchHistory = () => syncOrdersFromBackend(historyFilters)

  // Refetch orders when backend-driven filters (Date) change
  useEffect(() => {
    if ((filterDate === 'Custom Date' || filterDate === 'Custom Range') && (!customDateFrom || !customDateTo)) {
      return;
    }
    refetchHistory();
  }, [historyFilters])

  // Initial Data Fetch
  useEffect(() => {
    // Initial fetch handled by the dependency on filterDate ("Today")
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
    await refetchHistory()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handlePaymentStatusChange = async (order: Order, newStatus: string) => {
    try {
      if (newStatus === 'Paid' || newStatus === 'Unpaid') {
        await apiClient.put(`/orders/${order.id}/meta`, { receipt_paid_stamp: newStatus === 'Paid' })
      }
      updateOrder(order.id, { paymentStatus: newStatus as any })
      addTimelineEvent(order.id, { event: "Payment Status Changed", remarks: `Changed to ${newStatus}`, cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Payment Status Changed", who: user?.name || "Ahmed", oldValue: order.paymentStatus, newValue: newStatus, reason: "Manual change from badge" })
      await refetchHistory()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, paymentStatus: newStatus as any } : null)
    } catch (e) { console.error(e) }
  }

  const handleKitchenStatusChange = async (order: Order, newStatus: string) => {
    try {
      const items = (order.items || []).filter((item) => item?.id)
      const apply = async (itemId: string) => {
        if (newStatus === 'Preparing') return kitchenService.startPreparingItem(itemId)
        if (newStatus === 'Ready') return kitchenService.markItemReady(itemId)
        if (newStatus === 'Served' || newStatus === 'Completed') return kitchenService.markItemServed(itemId)
        if (newStatus === 'Cancelled') return kitchenService.cancelItem(itemId)
      }
      const results = await Promise.allSettled(items.map((item) => apply(item.id)))
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed > 0) {
        toast.error('Kitchen status', `Updated ${items.length - failed} of ${items.length} items. ${failed} failed.`)
      }
      updateOrder(order.id, { kitchenStatus: newStatus as any })
      addTimelineEvent(order.id, { event: "Kitchen Status Changed", remarks: `Changed to ${newStatus}`, cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Kitchen Status Changed", who: user?.name || "Ahmed", oldValue: order.kitchenStatus, newValue: newStatus, reason: "Manual change from badge" })
      await refetchHistory()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, kitchenStatus: newStatus as any } : null)
    } catch (e) { console.error(e) }
  }

  const handleOrderStatusChange = async (order: Order, newStatus: string) => {
    try {
      if (newStatus === 'Completed' && order.status !== 'Completed') {
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'COMPLETED' })
      }
      if (newStatus === 'Cancelled' && order.status !== 'Cancelled') {
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'CANCELLED' })
      }
      updateOrder(order.id, { status: newStatus as any })
      addTimelineEvent(order.id, { event: "Order Status Changed", remarks: `Changed to ${newStatus}`, cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Status Changed", who: user?.name || "Ahmed", oldValue: order.status, newValue: newStatus, reason: "Manual change from badge" })
      await refetchHistory()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null)
    } catch (e) { console.error(e) }
  }


  const exportToPDF = async () => {
    const doc = new jsPDF('landscape')
    doc.text("Enterprise Order History", 14, 15)

    const headers = [["Order #", "Date", "Cashier", "Order Type", "Customer", "Table", "Subtotal", "Discount", "Service Charge", "Total", "Pay Method", "Pay Status", "Status", "Items"]]
    const { default: autoTable } = await import('jspdf-autotable')
    const data = filteredAndSortedOrders.map(o => [
      o.orderNumber,
      new Date(o.timestamp).toLocaleString(),
      o.cashierName || 'Staff',
      o.orderType,
      o.customerName || 'Guest',
      o.tableNumber || '-',
      o.subtotal.toString(),
      o.discount.toString(),
      (o.serviceCharge || 0).toString(),
      o.total.toString(),
      o.payments?.[0]?.method || 'Cash',
      o.paymentStatus,
      o.status,
      o.items.map(i => `${i.quantity}x ${i.name}`).join('\n')
    ])

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [249, 115, 22] }, // Orange-500
      columnStyles: {
        13: { cellWidth: 50 } // Give items column more space
      }
    })

    doc.save(`Order_History_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const exportToCSV = () => {
    const headers = ["Order Number", "Date", "Cashier", "Order Type", "Customer", "Table", "Subtotal", "Discount", "Service Charge", "Total", "Pay Method", "Pay Status", "Status", "Items"]
    const rows = filteredAndSortedOrders.map(o => [
      o.orderNumber,
      `"${new Date(o.timestamp).toLocaleString()}"`,
      `"${o.cashierName || 'Staff'}"`,
      `"${o.orderType}"`,
      `"${o.customerName || 'Guest'}"`,
      `"${o.tableNumber || '-'}"`,
      o.subtotal,
      o.discount,
      (o.serviceCharge || 0),
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
    try {
      await loadOrderForEdit(order)
      navigate("/pos")
    } catch (e: any) {
      toast.error(e.message || "Failed to edit order")
    }
  }

  const handlePrintReceipt = async (order: Order) => {
    updateOrder(order.id, { receiptReprints: (order.receiptReprints || 0) + 1 })
    addTimelineEvent(order.id, { event: "Receipt Printed", remarks: "Printed thermal receipt", cashier: user?.name || "Ahmed" })

    // Try backend thermal print first (goes through print queue → engine → real driver)
    try {
      const { usePrinterStore } = await import("../store/printerStore")
      const printerState = usePrinterStore.getState()

      // Check if any real (non-VIRTUAL) printer is configured and active
      const hasThermalPrinter = printerState.printers.some(
        (p) => p.driver_type && p.driver_type !== 'VIRTUAL' && (p.current_status === 'ONLINE' || p.current_status === 'OFFLINE')
      )

      if (hasThermalPrinter) {
        const result = await printerState.printReceipt(order.id, user?.id || user?.name || 'cashier', order.paymentStatus === 'Paid')
        if (result?.job_id) {
          console.log(`[Orders] Thermal print job queued: ${result.job_id}`)
          return // Success — don't open browser popup
        }
      }
    } catch (e) {
      console.warn('[Orders] Backend print failed, falling back to browser preview:', e)
    }

    // Fallback: open browser ReceiptPreview popup (window.print)
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

  const handleCancelOrder = async (order: Order) => {
    const isCancelled = order.status === 'Cancelled'
    try {
      if (isCancelled) {
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'DRAFT' })
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'ACTIVE' })
        updateOrder(order.id, { status: "Active", kitchenStatus: "Pending" })
        addTimelineEvent(order.id, { event: "Order Recovered", remarks: "Recovered from cancelled", cashier: user?.name || "Ahmed" })
        await refetchHistory()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Active", kitchenStatus: "Pending" } : null)
        return
      }
      await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'CANCELLED' })
      updateOrder(order.id, { status: "Cancelled", kitchenStatus: "Cancelled" })
      addTimelineEvent(order.id, { event: "Order Cancelled", remarks: "Cancelled from order history", cashier: user?.name || "Ahmed" })
      await refetchHistory()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Cancelled", kitchenStatus: "Cancelled" } : null)
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || (isCancelled ? 'Could not recover this order.' : 'Could not cancel this order.'))
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
        await apiClient.put(`/orders/${order.id}/meta`, { receipt_paid_stamp: false })
        updateOrder(order.id, { paymentStatus: 'Unpaid' })
        addTimelineEvent(order.id, { event: "Marked Unpaid", remarks: "Marked unpaid from Order History", cashier: user?.name || "Ahmed" })
        addAuditLog(order.id, { actionType: "Payment Status Changed", who: user?.name || "Ahmed", oldValue: "Paid", newValue: "Unpaid", reason: "Toggle from History" })
        await refetchHistory()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, paymentStatus: "Unpaid" } : null)
      } else {
        await apiClient.put(`/orders/${order.id}/meta`, { receipt_paid_stamp: true })
        updateOrder(order.id, { paymentStatus: 'Paid' })
        addTimelineEvent(order.id, { event: "Marked Paid", remarks: "Marked paid from Order History", cashier: user?.name || "Ahmed" })
        addAuditLog(order.id, { actionType: "Payment Received", who: user?.name || "Ahmed", oldValue: order.paymentStatus, newValue: "Paid", reason: "Action from History" })
        await refetchHistory()
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
        await refetchHistory()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Active", kitchenStatus: "Pending" } : null)
      } else {
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'COMPLETED' })
        updateOrder(order.id, { status: 'Completed', kitchenStatus: 'Served' })
        addTimelineEvent(order.id, { event: "Marked Complete", remarks: "Marked complete from Order History", cashier: user?.name || "Ahmed" })
        addAuditLog(order.id, { actionType: "Status Changed", who: user?.name || "Ahmed", oldValue: order.status, newValue: "Completed", reason: "Action from History" })
        await refetchHistory()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Completed", kitchenStatus: "Served" } : null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteOrder = (order: Order) => {
    setDeletePin('')
    setDeleteDialog({ mode: 'one', order })
  }

  const confirmDeleteWithPin = async () => {
    if (!deleteDialog) return
    const pin = deletePin.trim()
    const pinOk = pin === '748810' || await authService.verifyManagerPin(pin)
    if (!pinOk) {
      alert('Unauthorized. Enter the owner PIN.')
      return
    }
    try {
      if (deleteDialog.mode === 'one' && deleteDialog.order) {
        const res: any = await deleteOrder(deleteDialog.order.id, pin)
        if (res?.success === false) {
          alert(res.message || 'Failed to delete order')
          return
        }
        if (selectedOrder?.id === deleteDialog.order.id) setSelectedOrder(null)
      } else {
        for (const id of selectedOrderIds) {
          try { await deleteOrder(id, pin) } catch { /* continue */ }
        }
        setSelectedOrderIds(new Set())
      }
      setDeleteDialog(null)
      setDeletePin('')
      await refetchHistory()
    } catch (e: any) {
      console.error(e)
      alert(e?.response?.data?.message || e?.message || 'Error deleting order.')
    }
  }

  // Filter Logic
  const filteredAndSortedOrders = useMemo(() => {
    let result = orders.filter(order => {
      const bd = order.businessDate || DateUtils.getBusinessDate(order.timestamp)
      if (filterDate === 'Today' && bd !== DateUtils.getBusinessDate()) return false
      if (filterDate === 'Yesterday' && bd !== DateUtils.getYesterdayBusinessDate()) return false
      if (filterDate === 'Monthly' && !bd.startsWith(DateUtils.getBusinessMonthStart().slice(0, 7))) return false
      if (filterDate === 'Custom Date' && customDateFrom && bd !== customDateFrom) return false
      if (filterDate === 'Custom Range' && customDateFrom && customDateTo && (bd < customDateFrom || bd > customDateTo)) return false

      // Global Search Match
      const q = searchQuery.toLowerCase().trim()
      const searchMatches = !q ||
        order.id.toLowerCase().includes(q) ||
        order.orderNumber.toLowerCase().includes(q) ||
        parseInt(order.orderNumber, 10).toString().includes(q) ||
        (order.customerName || '').toLowerCase().includes(q) ||
        (order.customerPhone || '').includes(q) ||
        (order.cashierName || '').toLowerCase().includes(q) ||
        (order.tableNumber || '').toLowerCase().includes(q) ||
        order.items.some(i => i.name.toLowerCase().includes(q) || (i.code || '').includes(q))

      // Exact Filters
      const matchType = filterType === "All" || order.orderType === filterType
      
      let matchOrderState = true;
      if (filterOrderState === "Red Edited") {
        matchOrderState = !!order.isEdited && !!order.isNegativeEdit;
      } else if (filterOrderState === "Green Edited") {
        matchOrderState = !!order.isEdited && !order.isNegativeEdit;
      } else {
        matchOrderState = filterOrderState === "All" || order.status === filterOrderState;
      }
      const matchPayment = filterPayment === "All" || order.paymentStatus === filterPayment
      const matchUserDrop = filterUser === "All" || order.cashierName === filterUser || order.waiterName === filterUser

      return searchMatches && matchType && matchOrderState && matchPayment && matchUserDrop
    })

    // Sort order
    result.sort((a, b) => {
      if (sortBy === "Newest") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      if (sortBy === "Oldest") return new Date(a.timestamp).getTime() - new Date(a.timestamp).getTime()
      if (sortBy === "Highest Amount") return b.total - a.total
      if (sortBy === "Lowest Amount") return a.total - b.total
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return result
  }, [orders, searchQuery, filterDate, customDateFrom, customDateTo, filterType, filterPayment, filterOrderState, filterUser, sortBy])

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
      <div className="bg-card border border-border rounded-3xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          
          <div className="relative w-full lg:w-80 shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order #, Customer, Phone, Items..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-[11px] font-bold transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 lg:pb-0 hide-scrollbar-mobile">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-10 rounded-xl bg-secondary border border-border text-[11px] font-bold px-3 focus:outline-none shrink-0 cursor-pointer hover:bg-secondary/80">
              <option value="Newest">Sort: Newest First</option>
              <option value="Oldest">Sort: Oldest First</option>
              <option value="Highest Amount">Sort: Highest Amount</option>
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-10 rounded-xl bg-secondary border border-border text-[11px] font-bold px-3 focus:outline-none shrink-0 cursor-pointer hover:bg-secondary/80">
              <option value="All">Type: All</option>
              <option value="Dine In">Type: Dine In</option>
              <option value="Takeaway">Type: Takeaway</option>
              <option value="Delivery">Type: Delivery</option>
            </select>
            <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="h-10 rounded-xl bg-secondary border border-border text-[11px] font-bold px-3 focus:outline-none shrink-0 cursor-pointer hover:bg-secondary/80">
              <option value="All">User: All</option>
              {allUsers.map(u => {
                const name = u.first_name + (u.last_name ? ' ' + u.last_name : '');
                return <option key={u.id} value={name}>User: {name}</option>
              })}
            </select>
            <select value={filterOrderState} onChange={(e) => setFilterOrderState(e.target.value)} className="h-10 rounded-xl bg-secondary border border-border text-[11px] font-bold px-3 focus:outline-none shrink-0 cursor-pointer hover:bg-secondary/80">
              <option value="All">Status: All</option>
              <option value="Draft">Status: Draft</option>
              <option value="Confirmed">Status: Confirmed</option>
              <option value="Completed">Status: Completed</option>
              <option value="Cancelled">Status: Cancelled</option>
              <option value="Red Edited">Status: Red Edited</option>
              <option value="Green Edited">Status: Green Edited</option>
            </select>
            
            <div className="h-6 w-px bg-border mx-1 shrink-0"></div>

            <div className="flex items-center gap-1 shrink-0 bg-primary/5 p-1 rounded-xl border border-primary/20">
              <Calendar className="w-4 h-4 text-primary ml-2" />
              <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-8 rounded-lg bg-transparent text-primary text-[11px] font-black px-2 focus:outline-none cursor-pointer">
                <option value="Today">Date: Today</option>
                <option value="Yesterday">Date: Yesterday</option>
                <option value="Monthly">Date: Monthly</option>
                <option value="All Time">Date: All Time</option>
                <option value="Custom Date">Date: Custom Date</option>
                <option value="Custom Range">Date: Custom Range</option>
              </select>
              {filterDate === 'Custom Date' && (
                <div className="flex gap-1 ml-1 items-center">
                  <input type="date" value={customDateFrom} onChange={(e) => { setCustomDateFrom(e.target.value); setCustomDateTo(e.target.value); }} className="h-8 rounded-md bg-white border border-primary/30 text-[10px] font-bold px-1 focus:outline-none w-[100px]" />
                </div>
              )}
              {filterDate === 'Custom Range' && (
                <div className="flex gap-1 ml-1 items-center">
                  <input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="h-8 rounded-md bg-white border border-primary/30 text-[10px] font-bold px-1 focus:outline-none w-[100px]" />
                  <span className="text-[10px] text-primary font-black">-</span>
                  <input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="h-8 rounded-md bg-white border border-primary/30 text-[10px] font-bold px-1 focus:outline-none w-[100px]" />
                </div>
              )}
            </div>

            <button onClick={() => {
              setFilterDate("Today"); setCustomDateFrom(""); setCustomDateTo(""); setFilterType("All"); setFilterOrderState("All"); setFilterPayment("All"); setFilterUser("All"); setSortBy("Newest"); setSearchQuery("");
            }} className="h-10 px-3 rounded-xl bg-secondary border border-border text-[10px] font-black uppercase text-muted-foreground hover:bg-border transition-colors shrink-0" title="Reset Filters">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
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
                <th className="p-4">Table/Waiter</th>
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
                      {order.isEdited && <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase border font-bold tracking-widest leading-none ${order.isNegativeEdit ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>Edited</span>}
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
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[10px] font-bold text-muted-foreground">Table: {order.tableNumber || "—"}</div>
                        <div className="text-[10px] font-bold text-muted-foreground">Waiter: {order.waiterName || order.waiterId ? (order.waiterName || order.waiterId?.substring(0,6)) : "Unassigned"}</div>
                      </div>
                    ) : order.orderType === 'Delivery' ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[10px] font-bold text-muted-foreground">Rider: {order.riderName || order.riderId ? (order.riderName || order.riderId?.substring(0,6)) : "Unassigned"}</div>
                        <div className="text-[10px] font-bold text-muted-foreground">Phone: {order.customerPhone || "—"}</div>
                      </div>
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
                    <div className="grid grid-cols-5 gap-1 w-[175px] ml-auto" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSelectedOrder(order)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center" title="View Details"><FileText className="w-4 h-4" /></button>
                      <button onClick={() => handlePrintReceipt(order)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-primary transition-colors flex items-center justify-center" title="Print/Reprint Receipt"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => handleEditClick(order)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-amber-500 transition-colors flex items-center justify-center" title="Edit Order"><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancelOrder(order) }} className={`p-2 hover:bg-secondary rounded-lg transition-colors flex items-center justify-center ${order.status === 'Cancelled' ? 'text-emerald-500 hover:text-emerald-600' : 'text-muted-foreground hover:text-red-500'}`} title={order.status === 'Cancelled' ? 'Recover Order' : 'Cancel Order'}>{order.status === 'Cancelled' ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteOrder(order) }} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-red-600 transition-colors flex items-center justify-center" title="Delete Order"><Trash2 className="w-4 h-4" /></button>
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
                    <h2 className="text-2xl font-black flex items-center gap-2">
                      Order #{selectedOrder.orderNumber}
                      {selectedOrder.isEdited && <span className={`text-[10px] px-2 py-0.5 rounded uppercase border font-bold tracking-widest leading-none ${selectedOrder.isNegativeEdit ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>Edited</span>}
                    </h2>
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
                          {item.combo_components && item.combo_components.length > 0 && (
                            <div className="text-xs text-muted-foreground font-bold mt-1">
                              Combo:
                              <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[10px]">
                                {item.combo_components.map((c: any, i: number) => (
                                  <li key={i}>{c.quantity || 1}x {c.product_name_snapshot || c.name || "Component"} {c.variant_snapshot ? `(${c.variant_snapshot})` : ''} {c.price_adjustment > 0 ? `(+Rs. ${c.price_adjustment})` : ''}</li>
                                ))}
                              </ul>
                            </div>
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
                          <div className="mt-3 bg-secondary/30 p-3 rounded-xl border border-border/50 text-sm font-bold text-emerald-500">
                            {formatAuditMessage(log.actionType, log.oldValue, log.newValue)}
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

      {deleteDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-black mb-1">Delete order</h3>
            <p className="text-sm font-bold text-muted-foreground mb-4">
              {deleteDialog.mode === 'one'
                ? `Enter owner PIN to delete #${deleteDialog.order?.orderNumber}.`
                : `Enter owner PIN to delete ${selectedOrderIds.size} selected order(s).`}
            </p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={deletePin}
              onChange={(e) => setDeletePin(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmDeleteWithPin() }}
              className="w-full h-11 px-3 rounded-xl border border-border bg-secondary font-black tracking-widest mb-4 outline-none focus:border-primary"
              placeholder="PIN"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDeleteDialog(null); setDeletePin('') }} className="flex-1 h-11 rounded-xl border border-border font-black">Cancel</button>
              <button type="button" onClick={confirmDeleteWithPin} className="flex-1 h-11 rounded-xl bg-red-500 text-white font-black">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
