import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { authService } from "../services/authService"
import { apiClient } from "../api/client"
import { useLoadingStore } from "../store/loadingStore"
import { toast } from "../store/toastStore"
import { TILL_LETTERS, tillLetterFromPrefix } from "../utils/receiptOrderNumber"

const TILL_CONFIRM_KEY = "till_letter_confirmed_v2"
import { Lock, User, ChevronDown, Loader2 } from "lucide-react"
import { motion } from "framer-motion"

export default function Login() {
  const [users, setUsers] = useState<{ id: string, username: string, firstName: string, lastName: string, role_name?: string }[]>([])
  const [selectedUsername, setSelectedUsername] = useState("")
  const [pin, setPin] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [needsDeviceId, setNeedsDeviceId] = useState(() => localStorage.getItem(TILL_CONFIRM_KEY) !== "1")
  const [deviceIdInput, setDeviceIdInput] = useState("")
  const [currentTillLetter, setCurrentTillLetter] = useState("")
  const [deviceSaving, setDeviceSaving] = useState(false)
  
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
    apiClient.get('/health').then((res: any) => {
      const prefix = String(res?.order_prefix || res?.data?.order_prefix || '').trim().toUpperCase()
      const letter = tillLetterFromPrefix(prefix)
      if (TILL_LETTERS.includes(letter as typeof TILL_LETTERS[number])) setCurrentTillLetter(letter)
      const confirmed = localStorage.getItem(TILL_CONFIRM_KEY) === "1"
      const serverWants = res?.needs_till_confirm === true || res?.data?.needs_till_confirm === true
      if (!confirmed || serverWants) setNeedsDeviceId(true)
    }).catch(() => {
      if (localStorage.getItem(TILL_CONFIRM_KEY) !== "1") setNeedsDeviceId(true)
    })
  }, [])

  const saveDeviceId = async () => {
    setDeviceSaving(true)
    try {
      await apiClient.post('/health/device-id', { order_prefix: deviceIdInput })
      localStorage.setItem(TILL_CONFIRM_KEY, "1")
      setNeedsDeviceId(false)
      toast.success("Till saved", `Receipts will use ${deviceIdInput.toUpperCase()} - #1, ${deviceIdInput.toUpperCase()} - #2`)
    } catch (e: any) {
      toast.error("Could not save device ID", e?.response?.data?.message || e?.message)
    } finally {
      setDeviceSaving(false)
    }
  }

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

      {needsDeviceId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-2">Choose this PC letter</h2>
            <p className="text-sm text-muted-foreground font-bold mb-2">
              Click A, B, C, D, E or F for THIS computer. Nothing is selected yet — you must tap one. This does not delete orders or today&apos;s sales.
            </p>
            {currentTillLetter && (
              <p className="text-sm font-black text-orange-500 mb-6">
                This PC is currently {currentTillLetter}. First till keep A. Second till pick B.
              </p>
            )}
            {!currentTillLetter && (
              <p className="text-sm font-black text-orange-500 mb-6">
                First till = A. Second till = B.
              </p>
            )}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {TILL_LETTERS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDeviceIdInput(id)}
                  className={`h-14 rounded-2xl border-2 font-black text-xl tracking-widest transition-all ${
                    deviceIdInput === id
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30'
                      : 'bg-secondary border-border text-foreground hover:border-primary/50'
                  }`}
                >
                  {id}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!TILL_LETTERS.includes(deviceIdInput as typeof TILL_LETTERS[number]) || deviceSaving}
              onClick={saveDeviceId}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase disabled:opacity-50"
            >
              {deviceSaving ? "Saving..." : "Save till"}
            </button>
          </div>
        </div>
      )}
      
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
