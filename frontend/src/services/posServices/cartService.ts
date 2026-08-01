import { apiClient } from "../../api/client"

const CART_BASE_URL = "/cart"
const ORDER_BASE_URL = "/orders"
const PAYMENT_BASE_URL = "/payments"

export const cartService = {
  async getDraftOrder() {
    const res = await apiClient.get(CART_BASE_URL)
    return res.data
  },

  async addItem(itemData: any) {
    const res = await apiClient.post(`${CART_BASE_URL}/items`, itemData)
    return res.data
  },

  async updateItemQuantity(itemId: string, quantity: number) {
    const res = await apiClient.put(`${CART_BASE_URL}/items/${itemId}`, { quantity })
    return res.data
  },

  async updateItemDetails(itemId: string, itemData: { notes?: string; modifiers?: any[]; addons?: any[]; comboComponents?: any[]; variant_id?: string | null }) {
    const res = await apiClient.patch(`${CART_BASE_URL}/items/${itemId}`, itemData)
    return res.data
  },

  async duplicateItem(itemId: string) {
    const res = await apiClient.post(`${CART_BASE_URL}/items/${itemId}/duplicate`, {})
    return res.data
  },

  async removeItem(itemId: string) {
    const res = await apiClient.delete(`${CART_BASE_URL}/items/${itemId}`)
    return res.data
  },

  async holdOrder(holdName: string) {
    const res = await apiClient.post(`${ORDER_BASE_URL}/draft/hold`, { holdName })
    return res.data
  },

  async getHeldOrders() {
    const res = await apiClient.get(`${ORDER_BASE_URL}/held`)
    return res.data
  },

  async resumeOrder(orderId: string) {
    const res = await apiClient.post(`${ORDER_BASE_URL}/resume/${orderId}`, {})
    return res.data
  },

  async setNotes(notesData: { notes?: string; kitchen_notes?: string }) {
    const res = await apiClient.patch(`${CART_BASE_URL}/notes`, notesData)
    return res.data
  },

  async setMeta(metaData: { order_type?: string; customer_id?: string | null; table_id?: string | null }) {
    const res = await apiClient.patch(`${CART_BASE_URL}/meta`, metaData)
    return res.data
  },

  async clearCart() {
    const res = await apiClient.delete(CART_BASE_URL)
    return res.data
  },

  async checkout(orderData: any) {
    const res = await apiClient.post(`${CART_BASE_URL}/checkout`, orderData)
    return res.data
  },

  async addPayment(orderId: string, paymentData: any) {
    const res = await apiClient.post(`${PAYMENT_BASE_URL}/order/${orderId}`, paymentData)
    return res.data
  }
}
