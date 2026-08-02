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
  fetchTickets: () => Promise<void>
  updateTicketStatus: (ticketId: string, status: KitchenStatus) => Promise<void>
  updateItemStatus: (ticketId: string, itemId: string, status: KitchenStatus) => Promise<void>
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

  fetchTickets: async () => {
    try {
      const { kitchenService } = await import('../services/kitchenService')
      const res = await kitchenService.getQueue()
      if (res.success && res.data) {
        const backendTickets = res.data.tickets || res.data // handle both shapes
        const mappedTickets: KitchenTicket[] = backendTickets.map((row: any) => {
          // Normalize priority
          let p = row.priority?.toUpperCase() || 'NORMAL'
          if (p === 'RUSH') p = 'Rush'
          if (p === 'NORMAL') p = 'Normal'

          // Normalize Status
          let s = row.kitchen_state?.toUpperCase() || 'PENDING'
          if (s === 'PENDING') s = 'Waiting'
          if (s === 'SENT') s = 'Accepted'

          return {
            id: row.id,
            orderId: row.id,
            orderNumber: row.order_number,
            table: row.table_id || 'N/A',
            customer: row.customer_id || 'Walk-in',
            orderType: row.order_type,
            cashier: row.cashier_name || 'System',
            orderTime: row.created_at,
            priority: p as KitchenPriority,
            status: s as KitchenStatus,
            notes: row.kitchen_notes || row.customer_notes || '',
            kitchen: 'All', // Handle multiple stations if needed
            items: row.items.map((item: any) => {
              let is = item.kitchen_state?.toUpperCase() || 'PENDING'
              if (is === 'PENDING' || is === 'SENT') is = 'Waiting'

              return {
                id: item.id,
                cartItemId: item.id,
                name: item.product_name_snapshot,
                quantity: item.quantity,
                modifiers: item.modifiers?.map((m: any) => ({ name: m.modifier_name_snapshot })) || [],
                notes: item.notes || null,
                kitchen: item.kitchen_station_name_snapshot || 'Main Kitchen',
                status: is as KitchenStatus,
                type: 'NORMAL'
              }
            })
          }
        })
        set({ tickets: mappedTickets })
      }
    } catch (error) {
      console.error('Failed to fetch kitchen tickets', error)
    }
  },

  updateTicketStatus: async (ticketId, status) => {
    // Optimistic update
    set(state => ({
      tickets: state.tickets.map(t => t.id === ticketId ? { ...t, status } : t)
    }))
    // Optional: map status back to backend values if needed, but not implemented here yet
    // Backend doesn't have an endpoint for updating entire ticket status directly, usually it's per item
  },

  updateItemStatus: async (ticketId, itemId, status) => {
    // Optimistic update
    set(state => ({
      tickets: state.tickets.map(t => 
        t.id === ticketId 
          ? { ...t, items: t.items.map(i => i.id === itemId ? { ...i, status } : i) } 
          : t
      )
    }))

    try {
      const { kitchenService } = await import('../services/kitchenService')
      if (status === 'Preparing') await kitchenService.startPreparingItem(itemId)
      else if (status === 'Ready') await kitchenService.markItemReady(itemId)
      else if (status === 'Served') await kitchenService.markItemServed(itemId)
      else if (status === 'Cancelled') await kitchenService.cancelItem(itemId)
      
      // Refresh to ensure sync
      get().fetchTickets()
    } catch (error) {
      console.error('Failed to update item status', error)
      // Rollback optimism could go here
    }
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
