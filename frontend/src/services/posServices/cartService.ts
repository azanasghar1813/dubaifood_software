import { apiClient } from "../../api/client"

const CART_BASE_URL = "/cart"
const ORDER_BASE_URL = "/orders"
const PAYMENT_BASE_URL = "/payments"

export const cartService = {
  async getDraftOrder() {
    const res = await apiClient.get(CART_BASE_URL) as any
    return res
  },

  async addItem(itemData: any) {
    const res = await apiClient.post(`${CART_BASE_URL}/items`, itemData) as any
    return res
  },

  async updateItemQuantity(itemId: string, quantity: number) {
    const res = await apiClient.put(`${CART_BASE_URL}/items/${itemId}`, { quantity }) as any
    return res
  },

  async updateItemDetails(itemId: string, itemData: { notes?: string; modifiers?: any[]; addons?: any[]; comboComponents?: any[]; variant_id?: string | null }) {
    const res = await apiClient.patch(`${CART_BASE_URL}/items/${itemId}`, itemData) as any
    return res
  },

  async duplicateItem(itemId: string) {
    const res = await apiClient.post(`${CART_BASE_URL}/items/${itemId}/duplicate`, {}) as any
    return res
  },

  async removeItem(itemId: string) {
    const res = await apiClient.delete(`${CART_BASE_URL}/items/${itemId}`) as any
    return res
  },

  async holdOrder(holdName: string) {
    const res = await apiClient.post(`${ORDER_BASE_URL}/draft/hold`, { holdName }) as any
    return res
  },

  async getHeldOrders() {
    const res = await apiClient.get(`${ORDER_BASE_URL}/held`) as any
    return res
  },

  async resumeOrder(orderId: string) {
    const res = await apiClient.post(`${ORDER_BASE_URL}/resume/${orderId}`, {}) as any
    return res
  },

  async setNotes(notesData: { notes?: string; kitchen_notes?: string }) {
    const res = await apiClient.patch(`${CART_BASE_URL}/notes`, notesData) as any
    return res
  },

  async setMeta(metaData: { order_type?: string; customer_id?: string | null; table_id?: string | null }) {
    const res = await apiClient.patch(`${CART_BASE_URL}/meta`, metaData) as any
    return res
  },

  async clearCart() {
    const res = await apiClient.delete(CART_BASE_URL) as any
    return res
  },

  async checkout(orderData: any) {
    const res = await apiClient.post(`${CART_BASE_URL}/checkout`, orderData) as any
    return res
  },

  async addPayment(orderId: string, paymentData: any) {
    const res = await apiClient.post(`${PAYMENT_BASE_URL}/order/${orderId}`, paymentData) as any
    return res
  }
}
