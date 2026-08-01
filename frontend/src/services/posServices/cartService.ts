import { apiClient } from "../../api/client"
import { useAuthStore } from "../../store/authStore"

const CART_BASE_URL = "/cart"
const ORDER_BASE_URL = "/orders"
const PAYMENT_BASE_URL = "/payments"

export const cartService = {
  getHeaders() {
    const { user } = useAuthStore.getState()
    return {
      "x-cashier-session-id": "mock-session-123",
      "x-user-id": user?.id || "mock-user-123"
    }
  },

  async getDraftOrder() {
    const res = await apiClient.get(CART_BASE_URL, { headers: this.getHeaders() })
    return res.data
  },

  async addItem(itemData: any) {
    const res = await apiClient.post(`${CART_BASE_URL}/items`, itemData, { headers: this.getHeaders() })
    return res.data
  },

  async updateItemQuantity(itemId: string, quantity: number) {
    const res = await apiClient.put(`${CART_BASE_URL}/items/${itemId}`, { quantity }, { headers: this.getHeaders() })
    return res.data
  },

  async updateItemDetails(itemId: string, itemData: { notes?: string; modifiers?: any[]; addons?: any[]; comboComponents?: any[]; variant_id?: string | null }) {
    const res = await apiClient.patch(`${CART_BASE_URL}/items/${itemId}`, itemData, { headers: this.getHeaders() })
    return res.data
  },

  async duplicateItem(itemId: string) {
    const res = await apiClient.post(`${CART_BASE_URL}/items/${itemId}/duplicate`, {}, { headers: this.getHeaders() })
    return res.data
  },

  async removeItem(itemId: string) {
    const res = await apiClient.delete(`${CART_BASE_URL}/items/${itemId}`, { headers: this.getHeaders() })
    return res.data
  },

  async holdOrder(holdName: string) {
    const res = await apiClient.post(`${ORDER_BASE_URL}/draft/hold`, { holdName }, { headers: this.getHeaders() })
    return res.data
  },

  async getHeldOrders() {
    const res = await apiClient.get(`${ORDER_BASE_URL}/held`, { headers: this.getHeaders() })
    return res.data
  },

  async resumeOrder(orderId: string) {
    const res = await apiClient.post(`${ORDER_BASE_URL}/resume/${orderId}`, {}, { headers: this.getHeaders() })
    return res.data
  },

  async setNotes(notesData: { notes?: string; kitchen_notes?: string }) {
    const res = await apiClient.patch(`${CART_BASE_URL}/notes`, notesData, { headers: this.getHeaders() })
    return res.data
  },

  async setMeta(metaData: { order_type?: string; customer_id?: string | null; table_id?: string | null }) {
    const res = await apiClient.patch(`${CART_BASE_URL}/meta`, metaData, { headers: this.getHeaders() })
    return res.data
  },

  async clearCart() {
    const res = await apiClient.delete(CART_BASE_URL, { headers: this.getHeaders() })
    return res.data
  },

  async checkout(orderData: any) {
    const res = await apiClient.post(`${CART_BASE_URL}/checkout`, orderData, { headers: this.getHeaders() })
    return res.data
  },

  async addPayment(orderId: string, paymentData: any) {
    const res = await apiClient.post(`${PAYMENT_BASE_URL}/order/${orderId}`, paymentData, { headers: this.getHeaders() })
    return res.data
  }
}
