import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore, CASHIERS } from "../store/authStore"
import { Lock, User, ChevronDown } from "lucide-react"
import { motion } from "framer-motion"

export default function Login() {
  const [selectedCashier, setSelectedCashier] = useState(CASHIERS[0])
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (login(selectedCashier, pin)) {
      navigate("/dashboard")
    } else {
      setError("Invalid PIN. Please try again (Hint: any 4+ digit PIN).")
    }
  }

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
                  className="w-full h-14 pl-12 pr-4 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-between cursor-pointer hover:bg-secondary transition-colors"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <User className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-lg">{selectedCashier}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                
                {isDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 w-full mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    {CASHIERS.map(cashier => (
                      <div 
                        key={cashier}
                        onClick={() => {
                          setSelectedCashier(cashier)
                          setIsDropdownOpen(false)
                        }}
                        className={`px-4 py-3 cursor-pointer hover:bg-secondary transition-colors font-bold ${selectedCashier === cashier ? 'bg-primary/10 text-primary' : ''}`}
                      >
                        {cashier}
                      </div>
                    ))}
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
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full h-14 pl-12 pr-4 rounded-xl bg-secondary/50 border border-border/50 focus:outline-none focus:border-primary focus:bg-background transition-all text-xl font-black tracking-widest"
                />
              </div>
            </div>

            {error && (
              <p className="text-destructive text-sm font-medium text-center">{error}</p>
            )}

            <button 
              type="submit" 
              disabled={pin.length < 4}
              className="w-full h-14 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              Sign In
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
