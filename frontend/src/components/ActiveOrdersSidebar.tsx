import React, { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  X, Search, Clock, Hash, User,
  Receipt, Edit,
  AlertCircle, ChevronRight,
  CheckCircle2, PlusCircle, CreditCard,
  Utensils
} from "lucide-react"
import { useOrderStore, mapHistoryDetailToOrder } from "../store/orderStore"
import type { Order, OrderStatus, KitchenStatus, PaymentStatus } from "../store/orderStore"
import { usePosStore } from "../store/posStore"
import { useAuthStore } from "../store/authStore"
import { fetchOrderDetail } from "../api/historyApi"
import { apiClient } from "../api/client"

interface ActiveOrdersSidebarProps {
  isOpen: boolean
  onClose: () => void
}

const orderStatusColors: Record<string, string> = {
  Draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  Held: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Active: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  Refunded: "bg-red-500/10 text-red-400 border-red-500/20"
}

const kitchenStatusColors: Record<string, string> = {
  Pending: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  Sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Preparing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Served: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

const paymentStatusColors: Record<string, string> = {
  Unpaid: "bg-red-500/10 text-red-450 border-red-500/20",
  Paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Refunded: "bg-purple-500/10 text-purple-450 border-purple-500/20"
}

export const ActiveOrdersSidebar: React.FC<ActiveOrdersSidebarProps> = ({ isOpen, onClose }) => {
  const { orders, syncOrdersFromBackend, updateOrder } = useOrderStore()
  const { loadOrderForEdit, clearCart, editingOrderId } = usePosStore()
  const { user } = useAuthStore()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<string>("All")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedActionIndex, setSelectedActionIndex] = useState(0)

  useEffect(() => {
    if (isOpen) {
      syncOrdersFromBackend()
    }
  }, [isOpen])

  const activeOrders = useMemo(() => {
    let result = orders.filter(o => o.status === 'Held' || o.status === 'Active')
    
    // Sort newest first (recently placed on top)
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    if (filter !== "All") {
      result = result.filter(o => o.orderType === filter)
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o => 
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.tableNumber && o.tableNumber.toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.toLowerCase().includes(q)) ||
        (o.orderType && o.orderType.toLowerCase().includes(q)) ||
        (o.status && o.status.toLowerCase().includes(q)) ||
        (o.paymentStatus && o.paymentStatus.toLowerCase().includes(q)) ||
        (o.kitchenStatus && o.kitchenStatus.toLowerCase().includes(q))
      )
    }
    return result
  }, [orders, searchQuery, filter])

  useEffect(() => {
    setSelectedIndex(0)
    setSelectedActionIndex(0)
  }, [searchQuery, filter])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(s => Math.min(s + 1, activeOrders.length - 1))
        setSelectedActionIndex(0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(s => Math.max(s - 1, 0))
        setSelectedActionIndex(0)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        const order = activeOrders[selectedIndex]
        if (order && order.paymentStatus === 'Unpaid') {
          setSelectedActionIndex(1)
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelectedActionIndex(0)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const order = activeOrders[selectedIndex]
        if (order) {
          if (selectedActionIndex === 1 && order.paymentStatus === 'Unpaid') {
            handleMarkComplete(null, order)
          } else {
            handleEdit(order)
          }
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, activeOrders, selectedIndex, selectedActionIndex])

  const handleEdit = async (order: Order) => {
    try {
      await loadOrderForEdit(order)
    } catch(e) {
      console.error(e)
    }
    onClose()
  }

  const handleMarkComplete = async (e: React.MouseEvent | null, order: Order) => {
    if (e) e.stopPropagation()
    const confirmMsg = `Mark order #${order.orderNumber} as COMPLETED?\nTotal: PKR ${order.total.toLocaleString()}`
    if (!window.confirm(confirmMsg)) return

    try {
      const { useOrderStore } = await import('../store/orderStore')
      useOrderStore.getState().updateOrder(order.id, { status: 'Completed' })

      await apiClient.post(`/payments/order/${order.id}`, { amount_received: order.total, payment_method: 'CASH' })
      syncOrdersFromBackend()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-card border-l border-border/50 shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Active Orders
                </h2>
                <p className="text-sm text-muted-foreground">Manage ongoing orders</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-border/50 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by order #, customer, table..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setSelectedIndex(s => Math.min(s + 1, activeOrders.length - 1))
                      setSelectedActionIndex(0)
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSelectedIndex(s => Math.max(s - 1, 0))
                      setSelectedActionIndex(0)
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault()
                      const order = activeOrders[selectedIndex]
                      if (order && order.paymentStatus === 'Unpaid') {
                        setSelectedActionIndex(1)
                      }
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault()
                      setSelectedActionIndex(0)
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      const order = activeOrders[selectedIndex]
                      if (order) {
                        if (selectedActionIndex === 1 && order.paymentStatus === 'Unpaid') {
                          handleMarkComplete(null, order)
                        } else {
                          handleEdit(order)
                        }
                      }
                    }
                  }}
                  className="w-full bg-secondary/50 border border-border/50 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {['All', 'Dine In', 'Takeaway', 'Delivery'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      filter === f 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {activeOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                  <Utensils className="w-12 h-12 opacity-20" />
                  <p>No active orders found</p>
                </div>
              ) : (
                activeOrders.map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleEdit(order)}
                    className={`bg-secondary/30 border cursor-pointer ${selectedIndex === index ? 'border-orange-500 ring-1 ring-orange-500' : 'border-border/50 hover:border-orange-500/30'} rounded-xl p-4 transition-all group`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-primary">#{order.orderNumber}</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-secondary text-foreground">
                            {order.orderType}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1 text-blue-400 font-medium">
                            <Hash className="w-3.5 h-3.5" />
                            Table {order.tableNumber || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          PKR {order.total.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className={`text-xs px-2 py-1 rounded-md border ${orderStatusColors[order.status] || ''}`}>
                        {order.status}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-md border ${kitchenStatusColors[order.kitchenStatus] || ''}`}>
                        {order.kitchenStatus}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-md border ${paymentStatusColors[order.paymentStatus] || ''}`}>
                        {order.paymentStatus}
                      </span>
                    </div>

                    <div className="flex gap-2 mt-2 pt-3 border-t border-border/50">
                      <button 
                        onClick={() => handleEdit(order)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedIndex === index && selectedActionIndex === 0
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/50 shadow-lg shadow-primary/20'
                            : 'bg-secondary hover:bg-secondary/80 text-foreground'
                        }`}
                      >
                        <Edit className="w-4 h-4" />
                        Edit / Load
                      </button>
                      
                      {order.paymentStatus === 'Unpaid' && (
                        <button 
                          onClick={(e) => handleMarkComplete(e, order)}
                          className={`flex-1 flex items-center justify-center gap-2 border py-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedIndex === index && selectedActionIndex === 1
                              ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/50 border-emerald-500 shadow-lg shadow-emerald-500/20'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/20'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
