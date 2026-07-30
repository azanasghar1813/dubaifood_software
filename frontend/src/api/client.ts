import axios from 'axios'
import { handleApiError } from './errorHandler'
import { useAuthStore } from '../store/authStore'
import { useLoadingStore } from '../store/loadingStore'

// The base URL can be configured via environment variables
// Default to localhost:5000/api/v1 for development
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

export const apiClient = axios.create({
  baseURL,
  timeout: 10000, // 10 seconds default timeout
  headers: {
    'Content-Type': 'application/json'
  }
})

// ----------------------------------------------------
// Request Interceptor
// ----------------------------------------------------
apiClient.interceptors.request.use(
  (config) => {
    // 1. Start global loading indicator
    useLoadingStore.getState().startLoading()

    // 2. Attach Authorization Header if token exists
    const token = useAuthStore.getState().token
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    return config
  },
  (error) => {
    useLoadingStore.getState().stopLoading()
    return Promise.reject(error)
  }
)

// ----------------------------------------------------
// Response Interceptor
// ----------------------------------------------------
apiClient.interceptors.response.use(
  (response) => {
    // 1. Stop global loading indicator
    useLoadingStore.getState().stopLoading()

    // 2. Return data directly (unwrap Axios response)
    // Most of our APIs return { success: true, data: { ... } }
    return response.data
  },
  (error) => {
    // 1. Stop global loading indicator
    useLoadingStore.getState().stopLoading()

    // 2. Pass to global error handler
    handleApiError(error)

    // 3. Reject promise so caller can handle it if needed
    return Promise.reject(error)
  }
)
