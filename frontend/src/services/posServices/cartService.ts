import { apiClient } from "../../api/client"
import { useAuthStore } from "../../store/authStore"

const BASE_URL = "/orders"

export const cartService = {
  getHeaders() {
    const { user } = useAuthStore.getState()
    return {
      "x-cashier-session-id": "mock-session-123",
      "x-user-id": user?.id || "mock-user-123"
    }
  },

  async getDraftOrder() {
    const res = await apiClient.get(`${BASE_URL}/draft`, { headers: this.getHeaders() })
    return res.data
  },

  async addItem(itemData: any) {
    const res = await apiClient.post(`${BASE_URL}/draft/items`, itemData, { headers: this.getHeaders() })
    return res.data
  },

  async updateItemQuantity(itemId: string, quantity: number) {
    const res = await apiClient.put(`${BASE_URL}/draft/items/${itemId}`, { quantity }, { headers: this.getHeaders() })
    return res.data
  },

  async removeItem(itemId: string) {
    const res = await apiClient.delete(`${BASE_URL}/draft/items/${itemId}`, { headers: this.getHeaders() })
    return res.data
  },

  async holdOrder(holdName: string) {
    const res = await apiClient.post(`${BASE_URL}/draft/hold`, { holdName }, { headers: this.getHeaders() })
    return res.data
  },

  async getHeldOrders() {
    const res = await apiClient.get(`${BASE_URL}/held`, { headers: this.getHeaders() })
    return res.data
  },

  async resumeOrder(orderId: string) {
    const res = await apiClient.post(`${BASE_URL}/resume/${orderId}`, {}, { headers: this.getHeaders() })
    return res.data
  },

  async addPayment(orderId: string, paymentData: any) {
    const res = await apiClient.post(`${BASE_URL}/${orderId}/pay`, paymentData, { headers: this.getHeaders() })
    return res.data
  }
}
