import { useState, useRef, useEffect } from "react"
import { useUIStore } from "../store/uiStore"
import { useAuthStore } from "../store/authStore"
import { Bell,  LogOut, Users, X, ChevronDown, Lock, User as UserIcon, Wifi, Printer, Clock, RefreshCw, Calendar, Search, Settings, Sun, Moon, Minus, Square } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"

export default function TopNavbar() {
  const {} = useUIStore()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false)
  
  // Switch Cashier State
  const dummyCashiers = [{ id: '1', name: 'Ali (Mock)', role: 'cashier', shift_id: '1', initial_float: 0 }]
  const [selectedCashier, setSelectedCashier] = useState(dummyCashiers[0])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())

  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const handleSwitchCashier = (e: React.FormEvent) => {
    e.preventDefault()
    setError("Shift Engine not yet integrated. Please logout.")
  }

  const openSwitchModal = () => {
    setIsProfileOpen(false)
    setIsSwitchModalOpen(true)
    setSelectedCashier(dummyCashiers[0])
    setPin("")
    setError("")
  }

  return (
    <>
      <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-4 z-10 sticky top-0 shadow-sm">
        {/* Global Header Search */}
        <div className="hidden md:flex items-center flex-1 max-w-2xl mr-8">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search POS globally... (F3)"
              className="w-full h-9 pl-9 pr-4 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          
          {/* Status Indicators */}
          <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 border-r border-border/50 text-muted-foreground">
            <button className="flex items-center gap-1.5 hover:text-foreground transition-colors" title="Sync Data">
              <RefreshCw className="w-4 h-4 text-blue-500" />
            </button>
            <Wifi className="w-4 h-4 text-emerald-500" />
            <Printer className="w-4 h-4 text-emerald-500" />
            <div className="flex flex-col items-end justify-center px-4 py-1 border-r border-border/50">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <Calendar className="w-3.5 h-3.5" />
                {currentTime.toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-black text-foreground">
                <Clock className="w-4 h-4 text-orange-500" />
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              const root = document.documentElement;
              if (root.classList.contains('dark')) root.classList.remove('dark');
              else root.classList.add('dark');
            }}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sun className="w-5 h-5 hidden dark:block" />
            <Moon className="w-5 h-5 block dark:hidden" />
          </button>

          <Link
            to="/settings"
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-5 h-5" />
          </Link>

          <Link
            to="/notifications"
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-card" />
          </Link>

          <div className="relative" ref={profileRef}>
            <div 
              className="flex items-center gap-3 pl-4 border-l border-border/50 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-bold text-foreground">{user?.name || "Guest"}</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg border border-primary/20">
                {user?.name?.charAt(0) || "?"}
              </div>
            </div>

            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-3 w-56 bg-card border border-border shadow-xl rounded-xl overflow-hidden"
                >
                  <div className="p-4 border-b border-border/50 bg-secondary/30">
                    <p className="font-bold">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.role}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={openSwitchModal}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors text-left"
                    >
                      <Users className="w-4 h-4 text-primary" />
                      Switch Cashier
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Window Controls (Electron Mock) */}
          <div className="hidden lg:flex items-center border-l border-border/50 ml-2 pl-2">
            <button className="p-2 hover:bg-secondary rounded transition-colors text-muted-foreground">
              <Minus className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-secondary rounded transition-colors text-muted-foreground">
              <Square className="w-3.5 h-3.5" />
            </button>
            <button className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded transition-colors text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Switch Cashier Modal */}
      <AnimatePresence>
        {isSwitchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSwitchModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl p-6 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-400" />
              
              <button 
                onClick={() => setIsSwitchModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-secondary text-muted-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold">Switch Cashier</h2>
                <p className="text-sm text-muted-foreground">Select a cashier and enter PIN.</p>
              </div>

              <form onSubmit={handleSwitchCashier} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground ml-1">Cashier</label>
                  <div className="relative">
                    <div 
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-between cursor-pointer hover:bg-secondary transition-colors"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <span className="font-bold">{selectedCashier.name}</span>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                    
                    {isDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-full left-0 w-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                      >
                        {dummyCashiers.map(cashier => (
                          <div 
                            key={cashier.id}
                            onClick={() => {
                              setSelectedCashier(cashier)
                              setIsDropdownOpen(false)
                            }}
                            className={`px-4 py-2 text-sm cursor-pointer hover:bg-secondary transition-colors font-bold ${selectedCashier.id === cashier.id ? 'bg-primary/10 text-primary' : ''}`}
                          >
                            {cashier.name}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground ml-1">PIN</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 focus:outline-none focus:border-primary focus:bg-background transition-all text-lg font-black tracking-widest"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-destructive text-xs font-medium text-center">{error}</p>
                )}

                <button 
                  type="submit" 
                  disabled={pin.length < 4}
                  className="w-full h-12 mt-2 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Switch Session
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
