import { Navigate, useLocation } from "react-router-dom"
import { hasPermission, useAuthStore } from "../store/authStore"
import { useEffect } from "react"
import { ROUTE_FALLBACK_ORDER, ROUTE_PERMISSIONS } from "../constants/routePermissions"

function firstAllowedPath() {
  for (const path of ROUTE_FALLBACK_ORDER) {
    const permission = ROUTE_PERMISSIONS[path]
    if (!permission || hasPermission(permission)) return path
  }
  return '/pos'
}

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

  const required = ROUTE_PERMISSIONS[location.pathname]
  if (required && !hasPermission(required)) {
    return <Navigate to={firstAllowedPath()} replace />
  }

  return <>{children}</>
}
