import { Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { useEffect } from "react"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    // Save the current route to localStorage so the app can resume exactly where it was left off
    if (isAuthenticated && token && location.pathname !== '/' && location.pathname !== '/login') {
      localStorage.setItem('df_last_route', location.pathname + location.search)
    }
  }, [location, isAuthenticated, token])

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
