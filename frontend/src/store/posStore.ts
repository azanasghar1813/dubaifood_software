import { create } from 'zustand'
import { useOrderStore } from './orderStore'
import { useSettingsStore } from './settingsStore'
import type { PaymentRecord, PaymentStatus, Order, OrderStatus } from './orderStore'
import { useKdsStore } from './kdsStore'
import { usePrinterStore } from './printerStore'

export interface Modifier {
  name: string
  price?: number
}

export interface Product {
  id: string
  name: string
  price: number
  category: string
  image?: string
  code: string
  status: string
  stockStatus?: string
  isFavorite?: boolean
  isPopular?: boolean
  modifiers?: Modifier[]
  shortcut?: string
  sizes?: { name: string, price: number, code?: string }[]
  kitchen?: string
}

export interface CartItem extends Product {
  cartItemId: string
  quantity: number
  selectedModifiers: Modifier[]
  notes: string
  discount: number
  isEdited: boolean
  editState?: 'new' | 'modified' | 'removed' | 'unchanged'
  removalReason?: string
}

export interface CustomerProfile {
  id: string
  name: string
  phone: string
  type: string
  isVip: boolean
  address?: string
  notes?: string
  guestCount?: number
  birthday?: string
  history?: any[]
}

export type TableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Preparing' | 'Ready' | 'Cleaning' | 'Closed'

export interface Table {
  id: string
  label: string
  zone: 'Ground' | 'Family Hall' | 'Rooftop'
  status: TableStatus
  currentOrderId?: string
}

export interface TimelineEvent {
  event: string
  timestamp: string
  cashier: string
  remarks?: string
}

export interface OrderState {
  id: string
  cart: CartItem[]
  customer: CustomerProfile | null
  discount: number
  isTaxEnabled: boolean
  deliveryCharges: number
  orderType: 'Dine In' | 'Takeaway' | 'Delivery' | 'Drive Through'
  orderStatus: 'Draft' | 'Preparing' | 'Ready' | 'Served' | 'Completed' | 'Cancelled' | 'Paid' | 'Pending' | 'Confirmed'
  tableNumber: string | null
  guestCount: number
  serviceChargeRate: number
  startTime: Date
  timeline: TimelineEvent[]
}

interface POSState {
  // Global App State
  menuContext: 'Fast Food' | 'Restaurant' | 'Deals'
  gridDensity: 'small' | 'medium' | 'large'
  
  // Restaurant Management
  activeOrderId: string
  openOrders: Record<string, OrderState>
  
  // Active Order Fields
  cart: CartItem[]
  customer: CustomerProfile | null
  discount: number
  isTaxEnabled: boolean
  deliveryCharges: number
  orderType: 'Dine In' | 'Takeaway' | 'Delivery' | 'Drive Through'

  orderStatus: 'Draft' | 'Preparing' | 'Ready' | 'Served' | 'Completed' | 'Cancelled' | 'Paid' | 'Pending' | 'Confirmed'
  tableNumber: string | null
  guestCount: number
  serviceChargeRate: number
  startTime: Date
  timeline: TimelineEvent[]
  
  // Edit Mode
  editingOrderId: string | null
  originalOrderState: Order | null
  loadOrderForEdit: (order: Order) => void
  clearEditMode: () => void
  completeOrder: (cashierName: string, payments?: PaymentRecord[], paymentStatus?: PaymentStatus) => void
  holdOrder: (cashierName: string) => void
  
  // Actions
  addToCart: (product: Product, quantity?: number, selectedModifiers?: Modifier[], notes?: string) => void
  removeFromCart: (cartItemId: string, reason?: string) => void
  updateQuantity: (cartItemId: string, quantity: number) => void
  updateItemModifiers: (cartItemId: string, modifiers: Modifier[]) => void
  updateItemNotes: (cartItemId: string, notes: string) => void
  duplicateItem: (cartItemId: string) => void
  applyItemDiscount: (cartItemId: string, discount: number) => void
  clearCart: () => void
  setCustomer: (customer: CustomerProfile | null) => void
  setDiscount: (amount: number) => void
  setDeliveryCharges: (amount: number) => void
  toggleTax: () => void
  setOrderType: (type: 'Dine In' | 'Takeaway' | 'Delivery' | 'Drive Through') => void
  setMenuContext: (context: 'Fast Food' | 'Restaurant' | 'Deals') => void
  setGridDensity: (density: 'small' | 'medium' | 'large') => void
  
  setOrderStatus: (status: POSState['orderStatus']) => void
  setTableNumber: (table: string | null) => void
  setGuestCount: (count: number) => void
  addTimelineEvent: (event: string) => void

  // Multi-Order Management
  switchOrder: (orderId: string) => void
  parkCurrentOrder: () => void
  
  // Computed
  getSubtotal: () => number
  getTax: () => number
  getServiceCharge: () => number
  getGrandTotal: () => number
  getRoundOff: () => number
  getNetTotal: () => number
}

export const usePosStore = create<POSState>((set, get) => ({
  activeOrderId: Date.now().toString(),
  openOrders: {},
  editingOrderId: null,
  originalOrderState: null,

  cart: [],
  customer: null,
  discount: 0,
  isTaxEnabled: true,
  deliveryCharges: 0,
  orderType: 'Dine In',
  menuContext: 'Fast Food',
  gridDensity: (localStorage.getItem('pos:gridDensity') as 'small' | 'medium' | 'large') || 'medium',

  orderStatus: 'Draft',
  tableNumber: null,
  guestCount: 1,
  serviceChargeRate: 0,
  startTime: new Date(),
  timeline: [{ event: 'Created', timestamp: new Date().toISOString(), cashier: '' }],

  setMenuContext: (context) => set({ menuContext: context }),

  setGridDensity: (density) => {
    localStorage.setItem('pos:gridDensity', density)
    set({ gridDensity: density })
  },

  setOrderStatus: (status) => set(state => {
    state.addTimelineEvent(`Status changed to ${status}`)
    return { orderStatus: status }
  }),
  
  loadOrderForEdit: (order) => set({
    editingOrderId: order.id,
    originalOrderState: order,
    cart: order.items.map((i: CartItem) => ({ ...i, editState: 'unchanged' })),
    customer: order.customerName ? { 
      id: "cust-1", 
      name: order.customerName, 
      phone: order.customerPhone || "", 
      type: "Regular", 
      address: "", 
      notes: "", 
      isVip: order.isVip || false 
    } : null,
    orderType: order.orderType,
    orderStatus: order.status,
    tableNumber: order.tableNumber,
    guestCount: order.guestCount || 1,
    serviceChargeRate: order.serviceCharge ? (order.serviceCharge / order.subtotal) : 0,
    startTime: new Date(order.timestamp),
    timeline: order.timeline || [],
    discount: order.discount || 0
  }),
  
  clearEditMode: () => set({ editingOrderId: null, originalOrderState: null }),

  completeOrder: (cashierName, payments = [], paymentStatus = 'Paid') => {
    const state = get()
    const { addOrder, updateOrder, addAuditLog, orders, orderCounter } = useOrderStore.getState()
    
    if (state.editingOrderId) {
      // Edit Flow
      const { unlockOrder, addTimelineEvent } = useOrderStore.getState()
      const originalOrder = orders.find(o => o.id === state.editingOrderId)
      if (originalOrder) {
        // --- Per-item granular Kitchen Diff & Audit Log ---
        const originalItemsMap = new Map(originalOrder.items.map(i => [i.cartItemId, i]))

        state.cart.forEach(item => {
          const original = originalItemsMap.get(item.cartItemId)

          if (item.editState === 'new') {
            // Newly added item
            addAuditLog(originalOrder.id, {
              who: cashierName,
              actionType: 'Added Item',
              oldValue: '—',
              newValue: `${item.quantity}x ${item.name}`,
              reason: ''
            })
          } else if (item.editState === 'removed') {
            // Removed item
            addAuditLog(originalOrder.id, {
              who: cashierName,
              actionType: 'Removed Item',
              oldValue: `${original?.quantity ?? item.quantity}x ${item.name}`,
              newValue: '—',
              reason: item.removalReason || 'No reason given'
            })
          } else if (item.editState === 'modified' && original) {
            // Quantity changed
            if (original.quantity !== item.quantity) {
              addAuditLog(originalOrder.id, {
                who: cashierName,
                actionType: 'Changed Quantity',
                oldValue: `${original.quantity}x ${item.name}`,
                newValue: `${item.quantity}x ${item.name}`,
                reason: ''
              })
            }
          }
        })

        // Total change audit
        const oldTotal = originalOrder.total
        const newTotal = state.getNetTotal()
        if (oldTotal !== newTotal) {
          addAuditLog(originalOrder.id, {
            who: cashierName,
            actionType: 'Other',
            oldValue: `Rs ${oldTotal.toLocaleString()}`,
            newValue: `Rs ${newTotal.toLocaleString()}`,
            reason: 'Total updated after item changes'
          })
        }

        // Timeline entry
        addTimelineEvent(originalOrder.id, {
          event: 'Order Edited',
          cashier: cashierName,
          remarks: `${state.cart.filter(i => i.editState === 'new').length} added, ${state.cart.filter(i => i.editState === 'removed').length} removed, ${state.cart.filter(i => i.editState === 'modified').length} modified`
        })

        const updatedData = {
          items: [...state.cart.filter(item => item.editState !== 'removed')],
          customerName: state.customer?.name || "Guest",
          customerPhone: state.customer?.phone || "",
          isVip: state.customer?.isVip || false,
          tableNumber: state.tableNumber,
          guestCount: state.guestCount,
          orderType: state.orderType,
          subtotal: state.getSubtotal(),
          tax: state.getTax(),
          serviceCharge: state.getServiceCharge(),
          discount: state.discount,
          total: state.getNetTotal(),
          payments: payments.length > 0 ? [...originalOrder.payments, ...payments] : originalOrder.payments,
          paymentStatus: paymentStatus,
          status: ((originalOrder.kitchenStatus === 'Served' && paymentStatus === 'Paid') ? 'Completed' : 'Confirmed') as OrderStatus,
          roundOffAdjustment: state.getRoundOff(),
          lastEdited: new Date().toISOString(),
          editedBy: cashierName,
          isLocked: false,
          lockedBy: undefined as string | undefined
        }

        const newUpdatedOrder = { ...originalOrder, ...updatedData }
        updateOrder(originalOrder.id, updatedData)
        unlockOrder(originalOrder.id)

        // Send granular kitchen diff ticket
        useKdsStore.getState().receiveOrderEdit(originalOrder, newUpdatedOrder as Order)
      }
      set({ editingOrderId: null, originalOrderState: null })
    } else {
      // New Order Flow
      const newOrder: Order = {
        id: `ord-${Date.now()}`,
        orderNumber: orderCounter.toString(),
        cashierName: cashierName,
        customerName: state.customer?.name || "Guest",
        customerPhone: state.customer?.phone || "",
        isVip: state.customer?.isVip || false,
        tableNumber: state.tableNumber,
        guestCount: state.guestCount,
        orderType: state.orderType,
        items: [...state.cart],
        subtotal: state.getSubtotal(),
        tax: state.getTax(),
        serviceCharge: state.getServiceCharge(),
        discount: state.discount,
        total: state.getNetTotal(),
        status: 'Confirmed',
        kitchenStatus: 'Waiting',
        paymentStatus: paymentStatus,
        payments: payments,
        roundOffAdjustment: state.getRoundOff(),
        timestamp: new Date().toISOString(),
        timeline: [{ event: "Order Created", timestamp: new Date().toISOString(), cashier: cashierName }],
        auditLog: []
      }
      addOrder(newOrder)

      // Automatically Route to KDS
      useKdsStore.getState().receiveOrder(newOrder)
      
      // Enqueue Print Job for Receipt
      if (usePrinterStore.getState().settings.autoPrintReceipt) {
        usePrinterStore.getState().enqueuePrintJob({
          type: 'Receipt',
          printerType: 'Receipt',
          content: JSON.stringify({ orderId: newOrder.id })
        })
      }
    }
  },

  holdOrder: (cashierName) => {
    const state = get()
    const { addOrder, updateOrder, orders, orderCounter } = useOrderStore.getState()
    
    if (state.editingOrderId) {
      const originalOrder = orders.find(o => o.id === state.editingOrderId)
      if (originalOrder) {
        updateOrder(originalOrder.id, {
          items: [...state.cart],
          customerName: state.customer?.name || "Guest",
          tableNumber: state.tableNumber,
          orderType: state.orderType,
          subtotal: state.getSubtotal(),
          tax: state.getTax(),
          serviceCharge: state.getServiceCharge(),
          discount: state.discount,
          total: state.getNetTotal(),
          status: 'Draft',
          paymentStatus: 'Unpaid',
          roundOffAdjustment: state.getRoundOff()
        })
      }
      set({ editingOrderId: null })
    } else {
      addOrder({
        id: `ord-${Date.now()}`,
        orderNumber: orderCounter.toString(),
        cashierName: cashierName,
        customerName: state.customer?.name || "Guest",
        customerPhone: state.customer?.phone || "",
        isVip: state.customer?.isVip || false,
        tableNumber: state.tableNumber,
        guestCount: state.guestCount,
        orderType: state.orderType,
        items: [...state.cart],
        subtotal: state.getSubtotal(),
        tax: state.getTax(),
        serviceCharge: state.getServiceCharge(),
        discount: state.discount,
        total: state.getNetTotal(),
        status: 'Draft',
        kitchenStatus: 'Waiting',
        paymentStatus: 'Unpaid',
        payments: [],
        roundOffAdjustment: state.getRoundOff(),
        timestamp: new Date().toISOString(),
        timeline: [{ event: "Order Held", timestamp: new Date().toISOString(), cashier: cashierName }],
        auditLog: []
      })
    }
  },

  setTableNumber: (table) => set({ tableNumber: table }),
  setGuestCount: (count) => set({ guestCount: count }),
  addTimelineEvent: (event) => set(state => ({ timeline: [...state.timeline, { event, timestamp: new Date().toISOString(), cashier: '' }] })),

  switchOrder: (orderId) => set(state => {
    // 1. Save current active fields to openOrders
    const currentOrderData: OrderState = {
      id: state.activeOrderId,
      cart: state.cart,
      customer: state.customer,
      discount: state.discount,
      isTaxEnabled: state.isTaxEnabled,
      deliveryCharges: state.deliveryCharges,
      orderType: state.orderType,
      orderStatus: state.orderStatus,
      tableNumber: state.tableNumber,
      guestCount: state.guestCount,
      serviceChargeRate: state.serviceChargeRate,
      startTime: state.startTime,
      timeline: state.timeline
    }

    const openOrders = { ...state.openOrders, [state.activeOrderId]: currentOrderData }

    // 2. Load the target order if it exists, else create blank
    const targetOrder = openOrders[orderId] || {
      id: orderId,
      cart: [],
      customer: null,
      discount: 0,
      isTaxEnabled: state.isTaxEnabled,
      deliveryCharges: 0,
      orderType: 'Dine In',
      orderStatus: 'Draft',
      tableNumber: null,
      guestCount: 1,
      serviceChargeRate: 0,
      startTime: new Date(),
      timeline: [{ event: 'Created', timestamp: new Date().toISOString(), cashier: '' }]
    }

    return {
      openOrders,
      activeOrderId: targetOrder.id,
      cart: targetOrder.cart,
      customer: targetOrder.customer,
      discount: targetOrder.discount,
      isTaxEnabled: targetOrder.isTaxEnabled,
      deliveryCharges: targetOrder.deliveryCharges,
      orderType: targetOrder.orderType,
      orderStatus: targetOrder.orderStatus,
      tableNumber: targetOrder.tableNumber,
      guestCount: targetOrder.guestCount,
      serviceChargeRate: targetOrder.serviceChargeRate,
      startTime: targetOrder.startTime,
      timeline: targetOrder.timeline
    }
  }),

  parkCurrentOrder: () => {
    const state = get()
    const currentOrderData: OrderState = {
      id: state.activeOrderId,
      cart: state.cart,
      customer: state.customer,
      discount: state.discount,
      isTaxEnabled: state.isTaxEnabled,
      deliveryCharges: state.deliveryCharges,
      orderType: state.orderType,
      orderStatus: state.orderStatus,
      tableNumber: state.tableNumber,
      guestCount: state.guestCount,
      serviceChargeRate: state.serviceChargeRate,
      startTime: state.startTime,
      timeline: state.timeline
    }
    set({ openOrders: { ...state.openOrders, [state.activeOrderId]: currentOrderData } })
  },

  addToCart: (product, quantity = 1, selectedModifiers = [], notes = "") =>
    set((state) => {
      if (selectedModifiers.length === 0 && notes === "") {
        const existingIndex = state.cart.findIndex(
          (item) => item.id === product.id && item.name === product.name && item.selectedModifiers.length === 0 && item.notes === "" && item.editState !== 'removed'
        )
        if (existingIndex !== -1) {
          const newCart = [...state.cart]
          const existing = newCart.splice(existingIndex, 1)[0]
          existing.quantity += quantity
          if (state.editingOrderId && existing.editState !== 'new') existing.editState = 'modified'
          newCart.unshift(existing) // Move to top
          return { cart: newCart }
        }
      }
      const cartItemId = `${product.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      const newItem: CartItem = { 
        ...product, 
        cartItemId, 
        quantity, 
        selectedModifiers, 
        notes, 
        discount: 0, 
        isEdited: false,
        editState: state.editingOrderId ? 'new' : undefined
      }
      return { cart: [newItem, ...state.cart] }
    }),

  removeFromCart: (cartItemId, reason) =>
    set((state) => {
      if (!state.editingOrderId) {
        return { cart: state.cart.filter((item) => item.cartItemId !== cartItemId) }
      }
      
      return {
        cart: state.cart.map(item => {
          if (item.cartItemId === cartItemId) {
            if (item.editState === 'new') return null // Filter out below
            return { ...item, editState: 'removed', removalReason: reason || 'Manager Override' } as CartItem
          }
          return item
        }).filter(Boolean) as CartItem[]
      }
    }),

  updateQuantity: (cartItemId, quantity) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.cartItemId === cartItemId 
          ? { ...item, quantity, isEdited: true, editState: (state.editingOrderId && item.editState !== 'new') ? 'modified' : item.editState } 
          : item
      ),
    })),
    
  updateItemModifiers: (cartItemId, modifiers) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.cartItemId === cartItemId 
          ? { ...item, selectedModifiers: modifiers, isEdited: true, editState: (state.editingOrderId && item.editState !== 'new') ? 'modified' : item.editState } 
          : item
      ),
    })),

  updateItemNotes: (cartItemId, notes) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.cartItemId === cartItemId 
          ? { ...item, notes, isEdited: true, editState: (state.editingOrderId && item.editState !== 'new') ? 'modified' : item.editState } 
          : item
      ),
    })),

  duplicateItem: (cartItemId) =>
    set((state) => {
      const itemToDuplicate = state.cart.find(i => i.cartItemId === cartItemId)
      if (!itemToDuplicate) return state
      const newCartItemId = `${itemToDuplicate.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      const duplicatedItem = { ...itemToDuplicate, cartItemId: newCartItemId, isEdited: false, editState: state.editingOrderId ? 'new' : undefined } as CartItem
      return { cart: [duplicatedItem, ...state.cart] }
    }),

  applyItemDiscount: (cartItemId, discount) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.cartItemId === cartItemId 
          ? { ...item, discount, isEdited: true, editState: (state.editingOrderId && item.editState !== 'new') ? 'modified' : item.editState } 
          : item
      ),
    })),

  clearCart: () => set({
    activeOrderId: Date.now().toString(),
    cart: [], 
    customer: null, 
    discount: 0, 
    deliveryCharges: 0,
    tableNumber: null,
    guestCount: 1,
    orderStatus: 'Draft',
    startTime: new Date(),
    timeline: [{ event: 'Created', timestamp: new Date().toISOString(), cashier: '' }]
  }),
  
  setCustomer: (customer) => set({ customer }),
  setDiscount: (discount) => set({ discount }),
  setDeliveryCharges: (deliveryCharges) => set({ deliveryCharges }),
  toggleTax: () => set((state) => ({ isTaxEnabled: !state.isTaxEnabled })),
  setOrderType: (orderType) => set({ orderType, deliveryCharges: orderType === 'Delivery' ? 0 : 0 }),

  getSubtotal: () => {
    return get().cart.filter(item => item.editState !== 'removed').reduce((total, item) => {
      const modifierTotal = item.selectedModifiers.reduce((sum, mod) => sum + (mod.price || 0), 0)
      const itemTotal = ((item.price + modifierTotal) * item.quantity) - item.discount
      return total + Math.max(0, itemTotal)
    }, 0)
  },
  
  getTax: () => {
    if (!get().isTaxEnabled || get().orderType !== 'Dine In') return 0;
    const subtotal = get().getSubtotal()
    const discount = get().discount
    const taxRate = useSettingsStore.getState().taxRate / 100
    return Math.max(0, (subtotal - discount)) * taxRate
  },

  getServiceCharge: () => {
    if (get().orderType !== 'Dine In') return 0
    const subtotal = get().getSubtotal()
    return subtotal * get().serviceChargeRate
  },
  
  getGrandTotal: () => {
    const subtotal = get().getSubtotal()
    const discount = get().discount
    const tax = get().getTax()
    const delivery = get().deliveryCharges
    const service = get().getServiceCharge()
    return Math.max(0, subtotal - discount) + tax + delivery + service
  },

  getNetTotal: () => {
    const grandTotal = get().getGrandTotal()
    return Math.round(grandTotal) // Round off logic
  },
  
  getRoundOff: () => {
    const grandTotal = get().getGrandTotal()
    const netTotal = get().getNetTotal()
    return netTotal - grandTotal
  }
}))
