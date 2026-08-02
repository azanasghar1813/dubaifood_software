import { apiClient } from '../api/client'
import { Product, Category, Deal } from '../types'

export const catalogService = {
  getProducts: async (): Promise<Product[]> => {
    const res = await apiClient.get('/catalog/products/search')
    return res.data || []
  },
  
  createProduct: async (productData: Partial<Product>) => {
    return apiClient.post('/catalog/products', productData)
  },

  updateProduct: async (id: string, productData: Partial<Product>) => {
    return apiClient.put(`/catalog/products/${id}`, productData)
  },

  deleteProduct: async (id: string) => {
    return apiClient.delete(`/catalog/products/${id}`)
  },

  getCategories: async (): Promise<Category[]> => {
    const res = await apiClient.get('/catalog/categories')
    return res.data || []
  },

  createCategory: async (categoryData: Partial<Category>) => {
    return apiClient.post('/catalog/categories', categoryData)
  },

  updateCategory: async (id: string, categoryData: Partial<Category>) => {
    return apiClient.put(`/catalog/categories/${id}`, categoryData)
  },

  deleteCategory: async (id: string) => {
    return apiClient.delete(`/catalog/categories/${id}`)
  }
}
