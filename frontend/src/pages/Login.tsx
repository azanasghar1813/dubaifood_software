import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { authService } from "../services/authService"
import { useLoadingStore } from "../store/loadingStore"
import { toast } from "../store/toastStore"
import { Lock, User, ChevronDown, Loader2 } from "lucide-react"
import { motion } from "framer-motion"

export default function Login() {
  const [users, setUsers] = useState<{ id: string, username: string, firstName: string, lastName: string, role_name?: string }[]>([])
  const [selectedUsername, setSelectedUsername] = useState("")
  const [pin, setPin] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  
  const navigate = useNavigate()
  const { setSession } = useAuthStore()
  const { globalLoading } = useLoadingStore()

  useEffect(() => {
    // Fetch active users for the dropdown
    const fetchUsers = async () => {
      try {
        const response = await authService.getUsers()
        if (response.data && response.data.length > 0) {
          setUsers(response.data)
          setSelectedUsername(response.data[0].username)
        }
      } catch (error) {
        // Error handled globally
      }
    }
    fetchUsers()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedUsername || pin.length < 4) return

    try {
      const response = await authService.login({ username: selectedUsername, pin })
      if (response.success && response.data) {
        const { token, user, cashierSessionId } = response.data
        
        const sessionUser = {
          id: user.id,
          username: user.username || selectedUsername,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || selectedUsername,
          role: user.role,
          permissions: user.permissions || []
        }

        setSession(sessionUser, token, cashierSessionId || null)
        toast.success("Welcome back", `Successfully logged in as ${sessionUser.name}`)
        navigate("/dashboard")
      }
    } catch (error) {
      // API client handles the error toast
      setPin("")
    }
  }

  const selectedUserDisplay = users.find(u => u.username === selectedUsername)
  const displayName = selectedUserDisplay 
    ? `${selectedUserDisplay.firstName} ${selectedUserDisplay.lastName}` 
    : "Select Cashier"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-400" />
          
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black tracking-tight mb-2">Dubai Foods</h1>
            <p className="text-muted-foreground font-medium">Terminal Authentication</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground ml-1">Select Cashier</label>
              <div className="relative">
                <div 
                  className={`w-full h-14 pl-12 pr-4 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-between cursor-pointer hover:bg-secondary transition-colors ${globalLoading ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <User className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-lg">{displayName}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                
                {isDropdownOpen && !globalLoading && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 w-full mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto"
                  >
                    {users.map(user => (
                      <div 
                        key={user.id}
                        onClick={() => {
                          setSelectedUsername(user.username)
                          setIsDropdownOpen(false)
                        }}
                        className={`px-4 py-3 cursor-pointer hover:bg-secondary transition-colors font-bold ${selectedUsername === user.username ? 'bg-primary/10 text-primary' : ''}`}
                      >
                        {user.firstName} {user.lastName} <span className="text-xs text-muted-foreground ml-2">({user.role_name || 'Cashier'})</span>
                      </div>
                    ))}
                    {users.length === 0 && (
                      <div className="px-4 py-3 text-muted-foreground">No active users found.</div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground ml-1">Enter PIN</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  disabled={globalLoading || users.length === 0}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full h-14 pl-12 pr-4 rounded-xl bg-secondary/50 border border-border/50 focus:outline-none focus:border-primary focus:bg-background transition-all text-xl font-black tracking-widest disabled:opacity-50"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={pin.length < 4 || globalLoading || !selectedUsername}
              className="w-full h-14 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2"
            >
              {globalLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
