import * as Mock from './mockData'

// Simulated network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const api = {
  getProducts: async () => {
    await delay(400)
    return Mock.PRODUCTS
  },
  getCategories: async () => {
    await delay(200)
    return Mock.CATEGORIES
  },
  getOrders: async () => {
    await delay(300)
    return Mock.ORDERS
  },
  getInventory: async () => {
    await delay(300)
    return Mock.INVENTORY
  },
  getCustomers: async () => {
    await delay(400)
    return Mock.CUSTOMERS
  },
  getExpenses: async () => {
    await delay(300)
    return Mock.EXPENSES
  },
  getEmployees: async () => {
    await delay(300)
    return Mock.EMPLOYEES
  },
  getReports: async () => {
    await delay(500)
    return Mock.REPORTS
  },
  getDashboardMetrics: async () => {
    await delay(400)
    return Mock.DASHBOARD_METRICS
  }
}
