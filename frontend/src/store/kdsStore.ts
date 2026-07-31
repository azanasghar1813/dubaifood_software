import { create } from 'zustand'
import { type Order, useOrderStore } from './orderStore'
import { type CartItem } from './posStore'

// Fallback ID generator for non-secure contexts (e.g. local IP testing without HTTPS)
const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export type KitchenStatus = 'Waiting' | 'Accepted' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled'
export type KitchenPriority = 'Normal' | 'High' | 'VIP' | 'Rush' | 'Late'

export interface KitchenItem {
  id: string
  cartItemId: string
  name: string
  quantity: number
  modifiers: { name: string }[]
  notes: string | null
  kitchen: string
  status: KitchenStatus
  type: 'ADD' | 'REMOVE' | 'NORMAL'
}

export interface KitchenTicket {
  id: string
  orderId: string
  orderNumber: string
  table: string
  customer: string
  orderType: string
  cashier: string
  orderTime: string
  priority: KitchenPriority
  status: KitchenStatus
  items: KitchenItem[]
  notes: string
  kitchen: string // "Fast Food" | "Restaurant" etc.
}

interface KdsState {
  tickets: KitchenTicket[]
  filters: {
    status: KitchenStatus | 'All'
    priority: KitchenPriority | 'All'
    kitchen: string | 'All'
    searchQuery: string
  }
  
  // Actions
  receiveOrder: (order: Order) => void
  receiveOrderEdit: (oldOrder: Order, newOrder: Order) => void
  updateTicketStatus: (ticketId: string, status: KitchenStatus) => void
  updateItemStatus: (ticketId: string, itemId: string, status: KitchenStatus) => void
  setFilter: (key: keyof KdsState['filters'], value: string) => void
}

export const useKdsStore = create<KdsState>((set, get) => ({
  tickets: [],
  filters: {
    status: 'All',
    priority: 'All',
    kitchen: 'All',
    searchQuery: ''
  },

  receiveOrder: (order) => {
    // Separate items by kitchen
    const kitchenItems = new Map<string, KitchenItem[]>()

    order.items.forEach(item => {
      // Default to "Fast Food" if kitchen is missing for some reason
      const kitchen = item.kitchen || 'Fast Food'
      if (!kitchenItems.has(kitchen)) {
        kitchenItems.set(kitchen, [])
      }
      kitchenItems.get(kitchen)!.push({
        id: generateId(),
        cartItemId: item.cartItemId,
        name: item.name,
        quantity: item.quantity,
        modifiers: item.selectedModifiers,
        notes: item.notes,
        kitchen,
        status: 'Waiting',
        type: 'NORMAL'
      })
    })

    const newTickets: KitchenTicket[] = []
    
    // Determine priority
    let priority: KitchenPriority = 'Normal'
    if (order.customerName?.toLowerCase().includes('vip')) priority = 'VIP'

    kitchenItems.forEach((items, kitchen) => {
      newTickets.push({
        id: `KDS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        table: order.tableNumber || 'N/A',
        customer: order.customerName || 'Walk-in',
        orderType: order.orderType,
        cashier: order.cashierName,
        orderTime: order.timestamp,
        priority,
        status: 'Waiting',
        items,
        notes: order.notes || '',
        kitchen
      })
    })

    set(state => ({
      tickets: [...state.tickets, ...newTickets]
    }))
  },

  receiveOrderEdit: (oldOrder, newOrder) => {
    // Diffing logic to find ADDs and REMOVEs
    const oldItemsMap = new Map(oldOrder.items.map(i => [i.cartItemId, i]))
    const newItemsMap = new Map(newOrder.items.map(i => [i.cartItemId, i]))

    const adds: KitchenItem[] = []
    const removes: KitchenItem[] = []

    newOrder.items.forEach(newItem => {
      const oldItem = oldItemsMap.get(newItem.cartItemId)
      const kitchen = newItem.kitchen || 'Fast Food'

      if (!oldItem) {
        // Completely new item
        adds.push({
          id: generateId(),
          cartItemId: newItem.cartItemId,
          name: newItem.name,
          quantity: newItem.quantity,
          modifiers: newItem.selectedModifiers,
          notes: newItem.notes,
          kitchen,
          status: 'Waiting',
          type: 'ADD'
        })
      } else if (newItem.quantity > oldItem.quantity) {
        // Increased quantity
        adds.push({
          id: generateId(),
          cartItemId: newItem.cartItemId,
          name: newItem.name,
          quantity: newItem.quantity - oldItem.quantity,
          modifiers: newItem.selectedModifiers,
          notes: newItem.notes,
          kitchen,
          status: 'Waiting',
          type: 'ADD'
        })
      } else if (newItem.quantity < oldItem.quantity) {
        // Decreased quantity
        removes.push({
          id: generateId(),
          cartItemId: newItem.cartItemId,
          name: newItem.name,
          quantity: oldItem.quantity - newItem.quantity,
          modifiers: newItem.selectedModifiers,
          notes: newItem.notes,
          kitchen,
          status: 'Waiting',
          type: 'REMOVE'
        })
      }
    })

    oldOrder.items.forEach(oldItem => {
      if (!newItemsMap.has(oldItem.cartItemId)) {
        const kitchen = oldItem.kitchen || 'Fast Food'
        removes.push({
          id: generateId(),
          cartItemId: oldItem.cartItemId,
          name: oldItem.name,
          quantity: oldItem.quantity,
          modifiers: oldItem.selectedModifiers,
          notes: oldItem.notes,
          kitchen,
          status: 'Waiting',
          type: 'REMOVE'
        })
      }
    })

    if (adds.length === 0 && removes.length === 0) return

    // Group diff items by kitchen
    const kitchenDiffs = new Map<string, KitchenItem[]>()
    
    adds.forEach(item => {
      if (!kitchenDiffs.has(item.kitchen)) kitchenDiffs.set(item.kitchen, [])
      kitchenDiffs.get(item.kitchen)!.push(item)
    })
    
    removes.forEach(item => {
      if (!kitchenDiffs.has(item.kitchen)) kitchenDiffs.set(item.kitchen, [])
      kitchenDiffs.get(item.kitchen)!.push(item)
    })

    const newTickets: KitchenTicket[] = []
    
    kitchenDiffs.forEach((items, kitchen) => {
      newTickets.push({
        id: `KDS-MOD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        table: newOrder.tableNumber || 'N/A',
        customer: newOrder.customerName || 'Walk-in',
        orderType: newOrder.orderType,
        cashier: newOrder.cashierName,
        orderTime: new Date().toISOString(),
        priority: 'Rush', // Edits are typically Rush
        status: 'Waiting',
        items,
        notes: `EDITED TICKET`,
        kitchen
      })
    })

    set(state => ({
      tickets: [...state.tickets, ...newTickets]
    }))
  },

  updateTicketStatus: (ticketId, status) => {
    set(state => {
      const tickets = state.tickets.map(t => 
        t.id === ticketId ? { ...t, status } : t
      )
      const ticket = tickets.find(t => t.id === ticketId)
      if (ticket) {
        const orderStore = useOrderStore.getState()
        const order = orderStore.orders.find(o => o.id === ticket.orderId)
        if (order) {
          const newKitchenStatus = status
          const newPaymentStatus = order.paymentStatus
          
          let newOrderStatus = order.status
          if (newKitchenStatus === 'Served' && newPaymentStatus === 'Paid') {
            newOrderStatus = 'Completed'
          } else if (newKitchenStatus === 'Cancelled') {
            newOrderStatus = 'Cancelled'
          }
          
          orderStore.updateOrder(order.id, { 
            kitchenStatus: newKitchenStatus,
            status: newOrderStatus
          })
          
          orderStore.addTimelineEvent(order.id, {
            event: `Kitchen: ${status}`,
            cashier: 'Kitchen Station',
            remarks: `KDS Ticket #${ticket.orderNumber} updated`
          })
        }
      }
      return { tickets }
    })
  },

  updateItemStatus: (ticketId, itemId, status) => {
    set(state => ({
      tickets: state.tickets.map(t => 
        t.id === ticketId 
          ? { 
              ...t, 
              items: t.items.map(i => i.id === itemId ? { ...i, status } : i) 
            } 
          : t
      )
    }))
  },

  setFilter: (key, value) => {
    set(state => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    }))
  }
}))
