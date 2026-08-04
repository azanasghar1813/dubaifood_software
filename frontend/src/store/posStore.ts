import { create } from 'zustand'
import { cartService } from '../services/posServices/cartService'
import { apiClient } from '../api/client'
import { useOrderStore } from './orderStore'

export interface OrderItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
  notes: string | null
  status: string
  modifiers: any[]
}

export interface ActiveOrder {
  id: string
  order_number: string
  status: string
  order_type: string
  subtotal: number
  tax_total: number
  discount_total: number
  grand_total: number
  items: OrderItem[]
  hold_name?: string | null
}

export type CartItem = OrderItem & { 
  name: string; 
  price: number; 
  cartItemId: string; 
  selectedModifiers: any[]; 
  editState?: string; 
  removalReason?: string;
  category?: string;
  kitchen?: string;
  code?: string;
};

interface POSState {
  // Global App State
  menuContext: 'Fast Food' | 'Restaurant' | 'Deals'
  gridDensity: 'small' | 'medium' | 'large'
  
  // New backend-driven state
  activeOrder: ActiveOrder | null
  isLoadingOrder: boolean
  
  // Legacy UI state aliases for compatibility
  cart: CartItem[]
  
  // UI interactions
  editingOrderId: string | null
  customer: any | null
  deliveryCharges: number
  tableNumber: string | null
  guestCount: number
  isTaxEnabled: boolean
  orderType: string
  openOrders: Record<string, any>
  activeOrderId: string
  startTime: Date

  // Async Backend Actions
  fetchDraftOrder: () => Promise<void>
  loadOrderForEdit: (order: any) => void
  addToCart: (product: any, quantity?: number, selectedModifiers?: any[], notes?: string) => Promise<void>
  removeFromCart: (cartItemId: string, reason?: string) => Promise<void>
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>
  updateItemModifiers: (cartItemId: string, modifiers: any[]) => Promise<void>
  updateItemNotes: (cartItemId: string, notes: string) => Promise<void>
  duplicateItem: (cartItemId: string) => Promise<void>
  holdOrder: (holdName: string) => Promise<void>
  resumeOrder: (orderId: string) => Promise<void>
  completeOrder: (payments?: any[]) => Promise<void>
  clearCart: () => void
  
  // Legacy accessors
  getSubtotal: () => number
  getTax: () => number
  getServiceCharge: () => number
  getGrandTotal: () => number
  getNetTotal: () => number
  getRoundOff: () => number

  // Setters
  setMenuContext: (context: 'Fast Food' | 'Restaurant' | 'Deals') => void
  setGridDensity: (density: 'small' | 'medium' | 'large') => void
  setOrderType: (type: 'Dine In' | 'Takeaway' | 'Delivery' | 'Drive Through') => void
  setCustomer: (customer: any | null) => void
  setTableNumber: (table: string | null) => void
  setGuestCount: (count: number) => void
  setDeliveryCharges: (amount: number) => void
  toggleTax: () => void
  clearEditMode: () => void
  switchOrder: (orderId: string) => void
}

export const usePosStore = create<POSState>((set, get) => ({
  menuContext: 'Fast Food',
  gridDensity: (localStorage.getItem('pos:gridDensity') as 'small' | 'medium' | 'large') || 'medium',
  
  activeOrder: null,
  isLoadingOrder: false,
  
  cart: [],
  
  editingOrderId: null,
  customer: null,
  deliveryCharges: 0,
  tableNumber: null,
  guestCount: 1,
  isTaxEnabled: true,
  orderType: 'Dine In',
  openOrders: {},
  activeOrderId: Date.now().toString(),
  startTime: new Date(),

  fetchDraftOrder: async () => {
    set({ isLoadingOrder: true })
    try {
      const res = await cartService.getDraftOrder()
      if (res.success) {
        set({ 
          activeOrder: res.data, 
          cart: (res.data?.items || []).map((item: any) => ({ ...item, name: item.variant_name ? `${item.product_name} (${item.variant_name})` : (item.product_name || 'Unknown'), price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0, cartItemId: item._cart_item_id || item.id, selectedModifiers: item.modifiers || [] }))
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  loadOrderForEdit: (order) => {
    set({
      activeOrder: order,
      cart: (order?.items || []).map((item: any) => ({ 
        ...item, 
        name: item.variant_name ? `${item.product_name_snapshot || item.product_name || item.name} (${item.variant_name})` : (item.product_name_snapshot || item.product_name || item.name || 'Unknown'), 
        price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0, 
        cartItemId: item._cart_item_id || item.cartItemId || item.id, 
        selectedModifiers: item.modifiers || item.selectedModifiers || [] 
      })),
      editingOrderId: order?.id || null,
      orderType: order?.orderType || order?.order_type || get().orderType,
      tableNumber: order?.tableNumber || order?.table_id || null,
      customer: order?.customerName ? { name: order.customerName } : get().customer
    })
  },

  addToCart: async (product, quantity = 1, selectedModifiers = [], notes = "") => {
    set({ isLoadingOrder: true })
    try {
      const state = get()
      let res: any;
      if (state.editingOrderId) {
        res = await apiClient.post(`/orders/${state.editingOrderId}/items`, {
          product_id: product.id,
          variant_id: product.variant_id,
          quantity,
          modifiers: selectedModifiers,
          notes
        })
      } else {
        res = await cartService.addItem({
          product_id: product.id,
          variant_id: product.variant_id,
          quantity,
          modifiers: selectedModifiers,
          notes
        })
      }
      
      if (res.success) {
        set({ 
          activeOrder: res.data, 
          cart: (res.data?.items || []).map((item: any) => ({ 
            ...item, 
            name: item.variant_name ? `${item.product_name_snapshot || item.product_name || item.name} (${item.variant_name})` : (item.product_name_snapshot || item.product_name || item.name || 'Unknown'), 
            price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0, 
            cartItemId: item._cart_item_id || item.cartItemId || item.id, 
            selectedModifiers: item.modifiers || item.selectedModifiers || [] 
          }))
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  removeFromCart: async (cartItemId, reason?: string) => {
    set({ isLoadingOrder: true })
    try {
      const state = get()
      let res: any;
      if (state.editingOrderId) {
        res = await apiClient.delete(`/orders/${state.editingOrderId}/items/${cartItemId}`, { data: { reason } })
      } else {
        res = await cartService.removeItem(cartItemId)
      }
      
      if (res.success) {
        set({ 
          activeOrder: res.data, 
          cart: (res.data?.items || []).map((item: any) => ({ 
            ...item, 
            name: item.variant_name ? `${item.product_name_snapshot || item.product_name || item.name} (${item.variant_name})` : (item.product_name_snapshot || item.product_name || item.name || 'Unknown'), 
            price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0, 
            cartItemId: item._cart_item_id || item.cartItemId || item.id, 
            selectedModifiers: item.modifiers || item.selectedModifiers || [] 
          }))
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  updateQuantity: async (cartItemId, quantity) => {
    set({ isLoadingOrder: true })
    try {
      const state = get()
      let res: any;
      if (state.editingOrderId) {
        res = await apiClient.put(`/orders/${state.editingOrderId}/items/${cartItemId}`, { quantity })
      } else {
        res = await cartService.updateItemQuantity(cartItemId, quantity)
      }
      
      if (res.success) {
        set({ 
          activeOrder: res.data, 
          cart: (res.data?.items || []).map((item: any) => ({ 
            ...item, 
            name: item.variant_name ? `${item.product_name_snapshot || item.product_name || item.name} (${item.variant_name})` : (item.product_name_snapshot || item.product_name || item.name || 'Unknown'), 
            price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0, 
            cartItemId: item._cart_item_id || item.cartItemId || item.id, 
            selectedModifiers: item.modifiers || item.selectedModifiers || [] 
          }))
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  updateItemModifiers: async (cartItemId, modifiers) => {
    set({ isLoadingOrder: true })
    try {
      const res = await cartService.updateItemDetails(cartItemId, { modifiers })
      if (res.success) {
        set({ 
          activeOrder: res.data, 
          cart: (res.data?.items || []).map((item: any) => ({ ...item, name: item.variant_name ? `${item.product_name} (${item.variant_name})` : (item.product_name || 'Unknown'), price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0, cartItemId: item._cart_item_id || item.id, selectedModifiers: item.modifiers || [] }))
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  updateItemNotes: async (cartItemId, notes) => {
    set({ isLoadingOrder: true })
    try {
      const res = await cartService.updateItemDetails(cartItemId, { notes })
      if (res.success) {
        set({ 
          activeOrder: res.data, 
          cart: (res.data?.items || []).map((item: any) => ({ ...item, name: item.variant_name ? `${item.product_name} (${item.variant_name})` : (item.product_name || 'Unknown'), price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0, cartItemId: item._cart_item_id || item.id, selectedModifiers: item.modifiers || [] }))
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  duplicateItem: async (cartItemId) => {
    set({ isLoadingOrder: true })
    try {
      const res = await cartService.duplicateItem(cartItemId)
      if (res.success) {
        set({ 
          activeOrder: res.data, 
          cart: (res.data?.items || []).map((item: any) => ({ ...item, name: item.variant_name ? `${item.product_name} (${item.variant_name})` : (item.product_name || 'Unknown'), price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0, cartItemId: item._cart_item_id || item.id, selectedModifiers: item.modifiers || [] }))
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  holdOrder: async (holdName) => {
    set({ isLoadingOrder: true })
    try {
      const res = await cartService.holdOrder(holdName)
      if (res.success) {
        // Clear active order because it's held
        set({ activeOrder: null, cart: [] })
        await get().fetchDraftOrder() // create new draft
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  resumeOrder: async (orderId) => {
    set({ isLoadingOrder: true })
    try {
      const res = await cartService.resumeOrder(orderId)
      if (res.success) {
        set({ 
          activeOrder: res.data, 
          cart: (res.data?.items || []).map((item: any) => ({ ...item, name: item.variant_name ? `${item.product_name} (${item.variant_name})` : (item.product_name || 'Unknown'), price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0, cartItemId: item._cart_item_id || item.id, selectedModifiers: item.modifiers || [] }))
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  completeOrder: async (payments: any[] = []) => {
    const state = get()
    if (!state.activeOrder) return
    
    set({ isLoadingOrder: true })
    try {
      let order = state.activeOrder as any

      if (!order.order_number) {
        const checkoutResult = await cartService.checkout({
          order_type: order.order_type || order.orderType || 'DINE_IN',
          customer_id: order.customer_id || null,
          table_id: order.table_id || null,
          notes: order.notes || null,
          branch_id: order.branch_id || 'DEFAULT_BRANCH',
          business_date: order.business_date,
          delivery_charges: state.orderType === 'Delivery' ? state.deliveryCharges : 0,
          is_tax_enabled: state.orderType === 'Dine In' ? state.isTaxEnabled : false
        })

        if (checkoutResult.success) {
          order = checkoutResult.data
          set({ activeOrder: order, cart: (order?.items || []).map((item: any) => ({ ...item, name: item.variant_name ? `${item.product_name} (${item.variant_name})` : (item.product_name || 'Unknown'), price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0, cartItemId: item._cart_item_id || item.id, selectedModifiers: item.modifiers || [] })) })
        }
      }

      for (const p of payments) {
        await cartService.addPayment(order.id, {
          payment_method: String(p.method || p.paymentMethod || 'CASH').toUpperCase().replace(/ /g, '_'),
          amount: p.amount,
          amount_received: p.received ?? p.amount,
          transaction_reference: p.transaction_reference || p.reference || null,
          approval_code: p.approval_code || null,
          notes: p.notes || null
        })
      }
      // Draft order is now completed. Fetch a new draft order and sync history.
      set({ activeOrder: null, cart: [], editingOrderId: null })
      await get().fetchDraftOrder()
      useOrderStore.getState().syncOrdersFromBackend()
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  clearCart: () => {
    void cartService.clearCart().then(() => {
      set({ activeOrder: null, cart: [], editingOrderId: null })
      void get().fetchDraftOrder()
    }).catch(() => {
      set({ activeOrder: null, cart: [], editingOrderId: null })
      void get().fetchDraftOrder()
    })
  },

  getSubtotal: () => get().activeOrder?.totals?.subtotal ?? get().activeOrder?.subtotal ?? 0,
  getTax: () => {
    if (get().orderType !== 'Dine In') return 0;
    const tax = get().activeOrder?.totals?.tax_total ?? get().activeOrder?.tax_total ?? 0;
    return get().isTaxEnabled ? tax : 0;
  },
  getServiceCharge: () => 0, // Implement if needed
  getGrandTotal: () => {
    const sub = get().getSubtotal();
    const tax = get().getTax();
    const discount = get().activeOrder?.totals?.discount_total ?? get().activeOrder?.discount_total ?? 0;
    const isInclusive = get().activeOrder?.items?.[0]?.is_tax_inclusive === true;
    
    if (isInclusive) {
      return sub - discount;
    }
    return sub + tax - discount;
  },
  getNetTotal: () => {
    const base = get().getGrandTotal();
    const orderType = get().orderType;
    if (orderType === 'Delivery') {
      return base + (get().deliveryCharges || 0);
    }
    return base;
  },
  getRoundOff: () => 0,

  setMenuContext: (context) => set({ menuContext: context }),
  
  setGridDensity: (density) => {
    localStorage.setItem('pos:gridDensity', density)
    set({ gridDensity: density })
  },
  
  setOrderType: (orderType) => {
    set({ orderType })
    // Would ideally update backend order type here too
  },
  
  setCustomer: (customer) => set({ customer }),
  setTableNumber: (table) => set({ tableNumber: table }),
  setGuestCount: (count) => set({ guestCount: count }),
  setDeliveryCharges: (deliveryCharges) => set({ deliveryCharges }),
  toggleTax: () => set((state) => ({ isTaxEnabled: !state.isTaxEnabled })),
  clearEditMode: () => set({ editingOrderId: null }),
  switchOrder: (orderId) => console.log('switchOrder stub called', orderId)
}))
