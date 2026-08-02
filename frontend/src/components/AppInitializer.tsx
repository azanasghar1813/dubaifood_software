import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { authService } from '../services/authService'
import { Loader2 } from 'lucide-react'

/**
 * Enterprise Application Initializer.
 * Ensures the session is validated and critical configuration is loaded
 * before rendering protected routes.
 */
export function AppInitializer({ children }: { children: React.ReactNode }) {
  const { token, logout, setSession, setCashierSessionId } = useAuthStore()
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const initializeApp = async () => {
      // If no token exists, simply finish initializing. 
      // ProtectedRoutes will handle redirecting to /login.
      if (!token) {
        setIsInitializing(false)
        return
      }

      try {
        // 1. Validate Session
        const response = await authService.validateSession()
        
        if (response.data) {
          const { user } = response.data
          const sessionUser = {
            id: user.id,
            username: user.username || user.name,
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || "",
            role: user.role,
            permissions: user.permissions || []
          }
          
          setSession(sessionUser, token, (user as any).cashierSessionId || null)
          if ((user as any).cashierSessionId) {
            setCashierSessionId((user as any).cashierSessionId)
          }
          
          // 2. Load Business Configuration (Future)
          // await configService.getGeneralSettings()
          
          // 3. Load Menu Cache (Future)
          // await menuService.getProducts()
          
        }
      } catch (error) {
        // Validation failed (e.g. token expired)
        // Error handler already threw a toast, just clear state
        console.error("Session validation failed during startup:", error)
        logout()
      } finally {
        setIsInitializing(false)
      }
    }

    initializeApp()
  }, [token, logout, setSession, setCashierSessionId])

  if (isInitializing) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-bold">Initializing Dubai Foods POS...</h2>
        <p className="text-muted-foreground mt-2">Loading secure session & configuration</p>
      </div>
    )
  }

  return <>{children}</>
}
