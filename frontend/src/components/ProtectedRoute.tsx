import { Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "../store/authStore"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
