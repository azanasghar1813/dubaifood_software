import { create } from 'zustand'
import type { CartItem } from './posStore'

export type OrderStatus = 'Draft' | 'Confirmed' | 'Completed' | 'Cancelled'
export type KitchenStatus = 'Waiting' | 'Accepted' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled'
export type PaymentStatus = 'Unpaid' | 'Partial Paid' | 'Paid' | 'Refunded'
export type PaymentMethod = 'Cash' | 'JazzCash' | 'EasyPaisa' | 'Meezan' | 'Bank Transfer' | 'Debit Card' | 'Credit Card' | 'QR' | 'Store Credit' | 'Mixed'

export interface PaymentRecord {
  id: string
  method: PaymentMethod
  amount: number
  received?: number
  change?: number
  timestamp: string
  cashier: string
  status: 'Completed' | 'Refunded' | 'Pending'
}

export interface SplitRecord {
  id: string
  label: string
  amount: number
  payments: PaymentRecord[]
  status: PaymentStatus
}

export interface AuditLogEntry {
  id: string
  who: string
  when: string
  actionType: 'Added Item' | 'Removed Item' | 'Changed Quantity' | 'Changed Table' | 'Changed Customer' | 'Discount Applied' | 'Order Cancelled' | 'Kitchen Reprinted' | 'Other'
  oldValue: string
  newValue: string
  reason: string
}

export interface TimelineEvent {
  event: string
  timestamp: string
  cashier: string
  remarks?: string
}

export interface Order {
  id: string
  orderNumber: string
  cashierName: string
  customerName: string
  customerPhone?: string
  isVip?: boolean
  tableNumber?: string | null
  guestCount?: number
  orderType: 'Dine In' | 'Takeaway' | 'Delivery' | 'Drive Through'
  items: CartItem[]
  subtotal: number
  tax: number
  serviceCharge: number
  discount: number
  total: number
  status: OrderStatus
  kitchenStatus: KitchenStatus
  paymentStatus: PaymentStatus
  timestamp: string // Created Time
  lastEdited?: string // Updated Time
  editedBy?: string // Last Editor
  isLocked?: boolean
  lockedBy?: string
  timeline: TimelineEvent[]
  auditLog: AuditLogEntry[]
  notes?: string
  kitchenNotes?: string
  payments: PaymentRecord[]
  splits?: SplitRecord[]
  roundOffAdjustment?: number
}

interface OrderState {
  orders: Order[]
  orderCounter: number
  addOrder: (order: Order) => void
  updateOrder: (id: string, updates: Partial<Order>) => void
  addAuditLog: (orderId: string, log: Omit<AuditLogEntry, 'id' | 'when'>) => void
  addTimelineEvent: (orderId: string, event: Omit<TimelineEvent, 'timestamp'>) => void
  getOrders: () => Order[]
  lockOrder: (id: string, cashier: string) => void
  unlockOrder: (id: string, override?: boolean) => void
}

const generateMockOrders = (): Order[] => {
  const now = new Date()
  return [
    {
      id: "ord-1025",
      orderNumber: "1025",
      cashierName: "Ahmed",
      customerName: "Sheikh Tariq",
      customerPhone: "0501234567",
      isVip: true,
      tableNumber: "G5",
      guestCount: 4,
      orderType: "Dine In",
      items: [
        { cartItemId: "c1", id: "p1", name: "Premium Wagyu Burger", price: 85, quantity: 2, category: "Burgers", code: "WB01", selectedModifiers: [], notes: "No onions", isEdited: false, discount: 0, status: 'Active' },
        { cartItemId: "c2", id: "p2", name: "Truffle Fries", price: 45, quantity: 1, category: "Sides", code: "TF01", selectedModifiers: [], notes: "", isEdited: false, discount: 0, status: 'Active' }
      ],
      subtotal: 215,
      tax: 15.05,
      serviceCharge: 10,
      discount: 0,
      total: 240.05,
      status: "Confirmed",
      kitchenStatus: "Preparing",
      kitchenNotes: "Extra spicy",
      payments: [],
      roundOffAdjustment: 0,
      paymentStatus: "Unpaid",
      timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
      timeline: [
        { event: "Order Created", timestamp: new Date(now.getTime() - 15 * 60000).toISOString(), cashier: "Ahmed" },
        { event: "Sent to Kitchen", timestamp: new Date(now.getTime() - 14 * 60000).toISOString(), cashier: "Ahmed" },
        { event: "Kitchen Accepted", timestamp: new Date(now.getTime() - 13 * 60000).toISOString(), cashier: "Chef Ali" }
      ],
      auditLog: []
    },
    {
      id: "ord-1024",
      orderNumber: "1024",
      cashierName: "Sarah",
      customerName: "Walk-in",
      tableNumber: null,
      orderType: "Takeaway",
      items: [
        { cartItemId: "c3", id: "p3", name: "Zinger Burger", price: 25, quantity: 1, category: "Burgers", code: "ZB01", selectedModifiers: [], notes: "", isEdited: false, discount: 0, status: 'Active' }
      ],
      subtotal: 25,
      tax: 1.75,
      serviceCharge: 0,
      discount: 0,
      total: 26.75,
      status: "Confirmed",
      kitchenStatus: "Ready",
      paymentStatus: "Paid",
      payments: [
        { id: "pay2", method: "Debit Card", amount: 26.75, timestamp: new Date(now.getTime() - 25 * 60000).toISOString(), cashier: "Sarah", status: "Completed" }
      ],
      roundOffAdjustment: 0,
      timestamp: new Date(now.getTime() - 25 * 60000).toISOString(),
      timeline: [
        { event: "Order Created", timestamp: new Date(now.getTime() - 25 * 60000).toISOString(), cashier: "Sarah" },
        { event: "Sent to Kitchen", timestamp: new Date(now.getTime() - 24 * 60000).toISOString(), cashier: "Sarah" },
        { event: "Ready for Pickup", timestamp: new Date(now.getTime() - 5 * 60000).toISOString(), cashier: "Chef Ali" }
      ],
      auditLog: []
    },
    {
      id: "ord-1023",
      orderNumber: "1023",
      cashierName: "Ahmed",
      customerName: "Ali Reza",
      customerPhone: "0559876543",
      isVip: false,
      tableNumber: "T8",
      guestCount: 2,
      orderType: "Dine In",
      items: [
        { cartItemId: "c4", id: "p4", name: "Margherita Pizza", price: 65, quantity: 1, category: "Pizza", code: "PZ01", selectedModifiers: [], notes: "", isEdited: false, discount: 0, status: 'Active' },
        { cartItemId: "c5", id: "p5", name: "Diet Pepsi", price: 15, quantity: 2, category: "Drinks", code: "DP01", selectedModifiers: [], notes: "", isEdited: false, discount: 0, status: 'Active' }
      ],
      subtotal: 95,
      tax: 6.65,
      serviceCharge: 0,
      discount: 0,
      total: 101.65,
      status: "Completed",
      kitchenStatus: "Served",
      paymentStatus: "Paid",
      payments: [
        { id: "pay3", method: "Cash", amount: 101.65, received: 110, change: 8.35, timestamp: new Date(now.getTime() - 10 * 60000).toISOString(), cashier: "Ahmed", status: "Completed" }
      ],
      roundOffAdjustment: 0,
      timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
      timeline: [
        { event: "Order Created", timestamp: new Date(now.getTime() - 60 * 60000).toISOString(), cashier: "Ahmed" },
        { event: "Served", timestamp: new Date(now.getTime() - 40 * 60000).toISOString(), cashier: "Waiter" },
        { event: "Paid", timestamp: new Date(now.getTime() - 10 * 60000).toISOString(), cashier: "Ahmed" }
      ],
      auditLog: [
        { id: "al-1", who: "Ahmed", when: new Date(now.getTime() - 55 * 60000).toISOString(), actionType: "Added Item", oldValue: "None", newValue: "Diet Pepsi (x1)", reason: "Customer requested extra drink" }
      ],
      lastEdited: new Date(now.getTime() - 55 * 60000).toISOString(),
      editedBy: "Ahmed"
    }
  ]
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: generateMockOrders(),
  orderCounter: 1026,
  
  addOrder: (order) => set((state) => ({
    orders: [order, ...state.orders],
    orderCounter: state.orderCounter + 1
  })),

  updateOrder: (id, updates) => set((state) => ({
    orders: state.orders.map(order => 
      order.id === id ? { ...order, ...updates, lastEdited: new Date().toISOString() } : order
    )
  })),

  addAuditLog: (orderId, log) => set((state) => ({
    orders: state.orders.map(order => {
      if (order.id === orderId) {
        return {
          ...order,
          auditLog: [{ ...log, id: `al-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, when: new Date().toISOString() }, ...order.auditLog]
        }
      }
      return order
    })
  })),

  addTimelineEvent: (orderId, event) => set((state) => ({
    orders: state.orders.map(order => {
      if (order.id === orderId) {
        return {
          ...order,
          timeline: [...order.timeline, { ...event, timestamp: new Date().toISOString() }]
        }
      }
      return order
    })
  })),
  
  getOrders: () => get().orders,
  
  lockOrder: (id, cashier) => set(state => ({
    orders: state.orders.map(o => 
      o.id === id ? { ...o, isLocked: true, lockedBy: cashier } : o
    )
  })),
  
  unlockOrder: (id, _override) => set(state => ({
    orders: state.orders.map(o => 
      o.id === id ? { ...o, isLocked: false, lockedBy: undefined } : o
    )
  }))
}))
