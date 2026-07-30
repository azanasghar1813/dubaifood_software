import { apiClient } from '../api/client'

export const menuService = {
  /**
   * Get all active products.
   */
  getProducts: async () => {
    return apiClient.get('/catalog/products')
  },

  /**
   * Get all categories and their hierarchy.
   */
  getCategories: async () => {
    return apiClient.get('/catalog/categories')
  },

  /**
   * Get modifier groups and their items.
   */
  getModifiers: async () => {
    return apiClient.get('/catalog/modifiers')
  },

  /**
   * Get active deals and combo meals.
   */
  getDeals: async () => {
    return apiClient.get('/catalog/deals')
  }
}
