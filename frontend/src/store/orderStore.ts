import { create } from 'zustand'
import type { CartItem } from './posStore'
import { fetchOrders, fetchOrderDetail, type HistoryOrderRow, type HistoryOrderDetail } from '../api/historyApi'

export type OrderStatus = 'Draft' | 'Held' | 'Active' | 'Completed' | 'Cancelled' | 'Refunded'
export type KitchenStatus = 'Pending' | 'Sent' | 'Preparing' | 'Ready' | 'Served' | 'Completed' | 'Cancelled'
export type PaymentStatus = 'Unpaid' | 'Paid' | 'Refunded'
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
  actionType: string
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
  customerAddress?: string
  isVip?: boolean
  tableNumber?: string | null
  guestCount?: number
  orderType: 'Dine In' | 'Takeaway' | 'Delivery' | 'Drive Through'
  items: CartItem[]
  subtotal: number
  tax: number
  serviceCharge: number
  deliveryCharge?: number
  discount: number
  isEdited?: boolean
  total: number
  businessDate?: string
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
  syncStatus?: 'Pending' | 'Synced' | 'Failed'
  receiptReprints?: number
}

interface OrderState {
  orders: Order[]
  orderCounter: number
  isSyncingFromBackend: boolean
  addOrder: (order: Order) => void
  updateOrder: (id: string, updates: Partial<Order>) => void
  addAuditLog: (orderId: string, log: Omit<AuditLogEntry, 'id' | 'when'>) => void
  addTimelineEvent: (orderId: string, event: Omit<TimelineEvent, 'timestamp'>) => void
  getOrders: () => Order[]
  lockOrder: (id: string, cashier: string) => void
  unlockOrder: (id: string, override?: boolean) => void
  syncOrdersFromBackend: (filters?: any) => Promise<void>
}

const mapLifecycleState = (state: string): OrderStatus => {
  const normalized = String(state || '').toUpperCase()
  if (normalized === 'DRAFT') return 'Draft'
  if (normalized === 'HELD') return 'Held'
  if (normalized === 'ACTIVE') return 'Active'
  if (normalized === 'COMPLETED') return 'Completed'
  if (normalized === 'CANCELLED') return 'Cancelled'
  if (normalized === 'REFUNDED') return 'Refunded'
  return 'Draft'
}

const mapKitchenState = (state: string): KitchenStatus => {
  const normalized = String(state || '').toUpperCase()
  if (normalized === 'PENDING') return 'Pending'
  if (normalized === 'SENT') return 'Sent'
  if (normalized === 'PREPARING') return 'Preparing'
  if (normalized === 'READY') return 'Ready'
  if (normalized === 'SERVED') return 'Served'
  return 'Pending'
}

const mapPaymentState = (state: string): PaymentStatus => {
  const normalized = String(state || '').toUpperCase()
  if (normalized === 'PAID') return 'Paid'
  if (normalized === 'REFUNDED') return 'Refunded'
  return 'Unpaid'
}

const formatName = (nameOrId?: string): string => {
  if (!nameOrId) return 'Staff'
  if (nameOrId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)) {
    return 'Staff'
  }
  return nameOrId
}

export const mapHistoryDetailToOrder = (row: HistoryOrderRow, detail?: HistoryOrderDetail): Order => {
  const items = (detail?.items || []).map((item: any, index: number) => ({
    cartItemId: item.id || `${row.id}-item-${index}`,
    id: item.product_id || item.id || `${row.id}-product-${index}`,
    variant_id: item.variant_id || null,
    name: item.variant_name ? `${item.product_name_snapshot || item.product_name || item.name || 'Item'} (${item.variant_name})` : (item.product_name_snapshot || item.product_name || item.name || 'Item'),
    price: Number(item.final_unit_price ?? item.unit_price ?? item.price ?? 0),
    quantity: Number(item.quantity ?? 1),
    subtotal: Number(item.subtotal ?? (Number(item.final_unit_price ?? item.unit_price ?? item.price ?? 0) * Number(item.quantity ?? 1))),
    category: item.category || item.category_name || 'Unknown',
    code: item.code || item.product_code || '',
    selectedModifiers: item.modifiers || item.selectedModifiers || [],
    combo_components: item.combo_components || [],
    notes: item.notes || '',
    isEdited: Boolean(item.is_edited || item.updated_at),
    discount: Number(item.discount_total ?? item.discount ?? 0),
    status: 'Active'
  })) as any

  const payments = (detail?.payments || []).map((payment: any, index: number) => ({
    id: payment.id || `${row.id}-payment-${index}`,
    method: payment.payment_method || payment.method || 'Cash',
    amount: Number(payment.amount || 0),
    received: payment.amount_received ?? payment.received,
    change: payment.change_amount ?? payment.change,
    timestamp: payment.created_at || row.updated_at,
    cashier: formatName(payment.cashier_name || row.cashier_user_id),
    status: payment.status || 'Completed'
  })) as PaymentRecord[]

  const timeline = (detail?.timeline || []).map((event: any) => ({
    event: event.event_type || event.notes || 'Event',
    timestamp: event.created_at ? (event.created_at.includes('Z') ? event.created_at : event.created_at.replace(' ', 'T') + 'Z') : new Date().toISOString(),
    cashier: formatName(event.user_id || event.actor_user_id),
    remarks: event.description || event.notes || ''
  }))

  const auditLog = (detail?.audit_trail || []).map((entry: any) => ({
    id: entry.id,
    who: formatName(entry.user_id),
    when: entry.created_at,
    actionType: (entry.action || 'Other') as AuditLogEntry['actionType'],
    oldValue: typeof entry.old_value === 'string' ? entry.old_value : JSON.stringify(entry.old_value ?? ''),
    newValue: typeof entry.new_value === 'string' ? entry.new_value : JSON.stringify(entry.new_value ?? ''),
    reason: entry.reason || ''
  }))

  return {
    id: row.id,
    orderNumber: row.order_number.replace('POS-', '').replace(new RegExp(`^\\d{8}-`), ''),
    cashierName: formatName(row.cashier_user_id),
    customerName: row.customer_name || detail?.metadata?.customer_name || row.customer_id || 'Guest',
    customerPhone: row.customer_phone || detail?.metadata?.customer_phone || undefined,
    customerAddress: detail?.metadata?.customer_address || undefined,
    isVip: false,
    tableNumber: row.table_id || null,
    guestCount: 1,
    orderType: (row.order_type === 'TAKEAWAY' ? 'Takeaway' : row.order_type === 'DELIVERY' ? 'Delivery' : row.order_type === 'DRIVE_THROUGH' ? 'Drive Through' : 'Dine In'),
    items,
    subtotal: Number(row.subtotal || 0),
    tax: Number(row.tax_total || 0),
    serviceCharge: Number(row.service_charge ?? detail?.metadata?.service_charge ?? 0),
    deliveryCharge: Number(row.delivery_charges ?? detail?.metadata?.delivery_charges ?? 0),
    discount: Number(row.discount_total || 0),
    total: Number(row.grand_total || 0),
    businessDate: row.business_date,
    status: mapLifecycleState(row.lifecycle_state),
    kitchenStatus: mapKitchenState(row.kitchen_state),
    paymentStatus: mapPaymentState(row.payment_state),
    timestamp: row.created_at ? (row.created_at.includes('Z') ? row.created_at : row.created_at.replace(' ', 'T') + 'Z') : new Date().toISOString(),
    lastEdited: row.updated_at ? (row.updated_at.includes('Z') ? row.updated_at : row.updated_at.replace(' ', 'T') + 'Z') : new Date().toISOString(),
    isEdited: Boolean(row.is_edited),
    editedBy: undefined,
    isLocked: false,
    lockedBy: undefined,
    timeline,
    auditLog,
    notes: row.notes || undefined,
    kitchenNotes: undefined,
    payments,
    splits: undefined,
    roundOffAdjustment: 0,
    syncStatus: 'Synced',
    receiptReprints: 0
  }
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  orderCounter: 1,
  isSyncingFromBackend: false,

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
  })),

  syncOrdersFromBackend: async (filters = {}) => {
    set({ isSyncingFromBackend: true })
    try {
      const listResult = await fetchOrders(filters, { page: 1, limit: 1000, sort_by: 'NEWEST' })
      const rows = listResult.data || []
      const detailedOrders = []
      const chunkSize = 10
      
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const chunkResults = await Promise.all(
          chunk.map(async (row: HistoryOrderRow) => {
            try {
              const detailResult = await fetchOrderDetail(row.id)
              return mapHistoryDetailToOrder(row, detailResult.data)
            } catch {
              return mapHistoryDetailToOrder(row)
            }
          })
        )
        detailedOrders.push(...chunkResults)
      }

      const highestOrderNumber = detailedOrders.reduce((max, order) => {
        const parsed = Number(order.orderNumber)
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max
      }, 0)

      set({
        orders: detailedOrders,
        orderCounter: highestOrderNumber + 1,
        isSyncingFromBackend: false
      })
    } catch (error) {
      console.error('Failed to sync backend orders', error)
      set({ isSyncingFromBackend: false })
    }
  }
}))

