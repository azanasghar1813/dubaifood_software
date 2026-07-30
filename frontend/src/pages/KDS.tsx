import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useKdsStore, type KitchenTicket, type KitchenStatus, type KitchenPriority } from '../store/kdsStore'
import { usePrinterStore } from '../store/printerStore'
import { useOrderStore } from '../store/orderStore'
import { 
  Clock, Search, Filter, ChefHat, CheckCircle2, 
  XCircle, AlertCircle, Play, X, RefreshCw, Maximize2,
  Volume2, VolumeX, List, HelpCircle, User, Wifi, Printer,
  ChevronRight, Trash, Ban, Check, Award
} from 'lucide-react'

// Status styling colors
const orderStatusColors: Record<string, string> = {
  Draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  Confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20"
}

const kitchenStatusColors: Record<string, string> = {
  Waiting: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Accepted: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Preparing: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Ready: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Served: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20"
}

const paymentStatusColors: Record<string, string> = {
  Unpaid: "bg-red-500/10 text-red-400 border-red-500/20",
  "Partial Paid": "bg-yellow-500/10 text-yellow-450 border-yellow-500/20",
  Paid: "bg-green-500/10 text-green-400 border-green-500/20",
  Refunded: "bg-purple-500/10 text-purple-400 border-purple-500/20"
}

export const KDS: React.FC = () => {
  const { tickets, filters, setFilter, updateTicketStatus, receiveOrder } = useKdsStore()
  const { orders } = useOrderStore()
  
  // Local KDS State
  const [selectedTicket, setSelectedTicket] = useState<KitchenTicket | null>(null)
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeKdsTab, setActiveKdsTab] = useState<"Fast Food" | "Restaurant" | "All">("All")
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("Active") // Active = Waiting, Accepted, Preparing, Ready
  const [typeFilter, setTypeFilter] = useState<string>("All")
  const [priorityFilter, setPriorityFilter] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")

  // Live timer tick helper
  const [tick, setTick] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Sound generator
  const playNotificationSound = (type: 'new' | 'update' | 'rush') => {
    if (!soundEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      if (type === 'new') {
        osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.3)
      } else if (type === 'rush') {
        // Urgent double chime
        osc.frequency.setValueAtTime(1200, ctx.currentTime)
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
        setTimeout(() => {
          const osc2 = ctx.createOscillator()
          const gain2 = ctx.createGain()
          osc2.frequency.setValueAtTime(1200, ctx.currentTime)
          gain2.gain.setValueAtTime(0.12, ctx.currentTime)
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
          osc2.connect(gain2)
          gain2.connect(ctx.destination)
          osc2.start()
          osc2.stop(ctx.currentTime + 0.15)
        }, 180)
      } else {
        // Update chord
        osc.frequency.setValueAtTime(660, ctx.currentTime)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.4)
      }
    } catch (e) {
      console.warn("Sound blocked by browser auto-play policy", e)
    }
  }

  // Pre-load mock tickets from orderStore if KDS list is empty
  useEffect(() => {
    if (tickets.length === 0 && orders.length > 0) {
      orders.forEach(order => {
        receiveOrder(order)
      })
    }
  }, [orders, tickets.length])

  // Watch for ticket changes to sound notifications
  const prevTicketsCount = useRef(tickets.length)
  useEffect(() => {
    if (tickets.length > prevTicketsCount.current) {
      const added = tickets[tickets.length - 1]
      if (added?.priority === 'VIP' || added?.priority === 'Rush') {
        playNotificationSound('rush')
      } else {
        playNotificationSound('new')
      }
    } else if (tickets.length === prevTicketsCount.current && tickets.length > 0) {
      // Check if ticket notes have "EDITED TICKET"
      const hasUpdates = tickets.some(t => t.notes === 'EDITED TICKET' && t.status === 'Waiting')
      if (hasUpdates) {
        playNotificationSound('update')
      }
    }
    prevTicketsCount.current = tickets.length
  }, [tickets])

  // Timers and clocks
  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000)
    const tickTimer = setInterval(() => setTick(t => t + 1), 10000) // Update timer colors every 10s
    return () => {
      clearInterval(clockTimer)
      clearInterval(tickTimer)
    }
  }, [])

  // Fullscreen support
  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => {
        console.warn(`Fullscreen error: ${err.message}`)
      })
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA"
      if (isInput) return

      // Shortcuts helper
      if (e.key === "F5") {
        e.preventDefault()
        handleRefresh()
      }

      if (selectedTicket) {
        // Ctrl+A: Accept
        if (e.ctrlKey && e.key === "a") {
          e.preventDefault()
          updateTicketStatus(selectedTicket.id, "Accepted")
          setSelectedTicket(prev => prev ? { ...prev, status: "Accepted" } : null)
          playNotificationSound('update')
        }
        // Ctrl+P: Preparing
        if (e.ctrlKey && e.key === "p") {
          e.preventDefault()
          updateTicketStatus(selectedTicket.id, "Preparing")
          setSelectedTicket(prev => prev ? { ...prev, status: "Preparing" } : null)
        }
        // Ctrl+R: Ready
        if (e.ctrlKey && e.key === "r") {
          e.preventDefault()
          updateTicketStatus(selectedTicket.id, "Ready")
          setSelectedTicket(prev => prev ? { ...prev, status: "Ready" } : null)
        }
        // Ctrl+C: Complete
        if (e.ctrlKey && e.key === "c") {
          e.preventDefault()
          updateTicketStatus(selectedTicket.id, "Served")
          setSelectedTicket(null)
        }
        // Esc: Close Drawer
        if (e.key === "Escape") {
          e.preventDefault()
          setSelectedTicket(null)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedTicket])

  // Bulk Operations
  const handleBulkMarkReady = () => {
    if (selectedTicketIds.length === 0) return
    selectedTicketIds.forEach(id => {
      updateTicketStatus(id, "Ready")
    })
    setSelectedTicketIds([])
    alert("Selected tickets marked as READY in kitchens.")
  }

  const handleRefresh = () => {
    playNotificationSound('update')
    alert("Synchronizing live orders from POS channels...")
  }

  // KPI summaries
  const kpiStats = useMemo(() => {
    const active = tickets.filter(t => t.status !== "Served" && t.status !== "Cancelled")
    const waiting = active.filter(t => t.status === "Waiting").length
    const accepted = active.filter(t => t.status === "Accepted").length
    const preparing = active.filter(t => t.status === "Preparing").length
    const ready = active.filter(t => t.status === "Ready").length
    
    // Average prep time calculation
    const completedToday = tickets.filter(t => t.status === "Served").length
    
    // Find longest wait ticket
    let longestWaitMins = 0
    let longestTicketNo = "N/A"
    active.forEach(t => {
      const wait = Math.floor((Date.now() - new Date(t.orderTime).getTime()) / 60000)
      if (wait > longestWaitMins) {
        longestWaitMins = wait
        longestTicketNo = `#${t.orderNumber}`
      }
    })

    return { waiting, accepted, preparing, ready, completedToday, longestTicketNo, longestWaitMins }
  }, [tickets, tick])

  // Filtered tickets mapping
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Kitchen Tab Filter
      const matchesKitchenTab = activeKdsTab === "All" || ticket.kitchen === activeKdsTab
      
      // Status Filters
      let matchesStatus = true
      if (statusFilter === "Active") {
        matchesStatus = ticket.status !== "Served" && ticket.status !== "Cancelled"
      } else if (statusFilter !== "All") {
        matchesStatus = ticket.status === statusFilter
      }

      // Type Filter
      const matchesType = typeFilter === "All" || ticket.orderType === typeFilter

      // Priority Filter
      const matchesPriority = priorityFilter === "All" || ticket.priority === priorityFilter

      // Search Query filter
      const q = searchQuery.toLowerCase()
      const matchesSearch = !searchQuery || 
                            ticket.orderNumber.includes(q) || 
                            ticket.table.toLowerCase().includes(q) || 
                            ticket.customer.toLowerCase().includes(q) ||
                            ticket.items.some(i => i.name.toLowerCase().includes(q))

      return matchesKitchenTab && matchesStatus && matchesType && matchesPriority && matchesSearch
    }).sort((a, b) => new Date(a.orderTime).getTime() - new Date(b.orderTime).getTime())
  }, [tickets, activeKdsTab, statusFilter, typeFilter, priorityFilter, searchQuery])

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-[200]" : "h-[calc(100vh-8.5rem)] rounded-3xl border border-border"} bg-background flex flex-col font-sans select-none overflow-hidden`}>
      
      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="h-20 bg-card border-b border-border px-6 flex items-center justify-between shrink-0 shadow-sm relative">
        <div className="flex items-center gap-3">
          <ChefHat className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none text-foreground flex items-center gap-2">
              KITCHEN COMMAND CENTER
              <span className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider animate-pulse">Live</span>
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Active Shift: <span className="text-foreground">Morning (chef_bilal)</span> • Business day: 6AM-6AM
            </p>
          </div>
        </div>

        {/* Kitchen Switcher Tabs */}
        <div className="flex bg-secondary p-1 rounded-xl shrink-0">
          {["All", "Fast Food", "Restaurant"].map((k) => (
            <button
              key={k}
              onClick={() => setActiveKdsTab(k as any)}
              className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${
                activeKdsTab === k 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* System Signals & Actions */}
        <div className="flex items-center gap-3">
          {isFullscreen && (
            <div className="hidden xl:flex items-center gap-2 text-xs font-bold text-muted-foreground border-r border-border pr-3">
              <span className="flex items-center gap-1"><Wifi className="w-3.5 h-3.5 text-emerald-500" /> Online</span>
              <span className="flex items-center gap-1"><Printer className="w-3.5 h-3.5 text-indigo-500" /> KDS Printer</span>
            </div>
          )}

          {isFullscreen && (
            <div className="flex items-center gap-2 text-xl font-black text-foreground tabular-nums">
              <Clock className="w-5 h-5 text-primary" />
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}

          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border transition-colors"
            title={soundEnabled ? "Disable Sounds" : "Enable Sounds"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button 
            onClick={handleFullscreenToggle}
            className="p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border transition-colors"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button 
            onClick={handleRefresh}
            className="p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border transition-colors"
            title="Refresh KDS Queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ====================================================
          SUMMARY CARDS
          ==================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 px-6 py-4 bg-card border-b border-border shrink-0">
        {[
          { label: "Waiting", val: kpiStats.waiting, sub: "New tickets", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
          { label: "Accepted", val: kpiStats.accepted, sub: "Staff acknowledged", color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
          { label: "Preparing", val: kpiStats.preparing, sub: "Currently cooking", color: "text-sky-500 bg-sky-500/10 border-sky-500/20" },
          { label: "Ready", val: kpiStats.ready, sub: "Food is boxed / plated", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
          { label: "Avg Prep Time", val: "14m", sub: "Monthly target: <15m", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
          { label: "Longest Wait", val: kpiStats.longestWaitMins > 0 ? `${kpiStats.longestWaitMins}m` : "0m", sub: `Ticket ${kpiStats.longestTicketNo}`, color: kpiStats.longestWaitMins > 20 ? "text-red-500 bg-red-500/10 border-red-500/20 animate-pulse" : "text-zinc-400 bg-secondary/50 border-border" },
          { label: "Completed Today", val: kpiStats.completedToday, sub: "Tickets cleared", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" }
        ].map((card, idx) => (
          <div key={idx} className={`p-3 rounded-2xl border flex flex-col justify-between shadow-sm ${card.color}`}>
            <div>
              <span className="text-[9px] uppercase font-black tracking-wider opacity-80">{card.label}</span>
              <p className="text-xl font-black tracking-tight mt-1">{card.val}</p>
            </div>
            <span className="text-[8px] font-bold opacity-70 mt-1.5">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* ====================================================
          KITCHEN PERFORMANCE OVERVIEW (Migrated from Dashboard)
          ==================================================== */}
      <div className="px-6 py-3 bg-card border-b border-border flex items-center gap-6 overflow-x-auto custom-scrollbar shrink-0">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <span className="uppercase text-[9px] font-black tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">Fast Food Kitchen</span>
          <span className="text-foreground">Avg Speed: 12 Mins</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <span className="uppercase text-[9px] font-black tracking-wider text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Restaurant Kitchen</span>
          <span className="text-foreground">Avg Speed: 22 Mins</span>
        </div>
        <div className="h-4 w-px bg-border hidden md:block"></div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-xl">
          <AlertCircle className="w-4 h-4" />
          <span>Delayed Tickets: 4 orders exceeded target timings</span>
        </div>
      </div>

      {/* ====================================================
          FILTERS & SEARCH BAR
          ==================================================== */}
      <div className="px-6 py-3 bg-secondary/20 border-b border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
        
        {/* Status filters */}
        <div className="flex gap-1.5 overflow-x-auto custom-scrollbar">
          {[
            { filter: "Active", label: "Active Queue" },
            { filter: "Waiting", label: "Waiting" },
            { filter: "Preparing", label: "Preparing" },
            { filter: "Ready", label: "Ready" },
            { filter: "Served", label: "Completed" },
            { filter: "All", label: "All Tickets" }
          ].map((item) => (
            <button
              key={item.filter}
              onClick={() => setStatusFilter(item.filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border transition-all ${
                statusFilter === item.filter
                  ? 'bg-card border-primary text-primary shadow-sm'
                  : 'bg-card border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Type / Priority Filters */}
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 px-2 rounded-lg bg-card border border-border text-xs font-bold outline-none"
          >
            <option value="All">All Types</option>
            <option value="Dine In">Dine In</option>
            <option value="Takeaway">Takeaway</option>
            <option value="Delivery">Delivery</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 px-2 rounded-lg bg-card border border-border text-xs font-bold outline-none"
          >
            <option value="All">All Priorities</option>
            <option value="Normal">Normal</option>
            <option value="VIP">VIP</option>
            <option value="Rush">Rush</option>
          </select>

          <div className="relative w-full sm:w-48 md:w-60">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-3.5 h-3.5" /></span>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table, customer, order..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-card border border-border focus:border-orange-500 outline-none text-xs font-bold"
            />
          </div>

          {/* Bulk Action Mark Ready */}
          {selectedTicketIds.length > 0 && (
            <button
              onClick={handleBulkMarkReady}
              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase transition-colors"
            >
              Mark Ready ({selectedTicketIds.length})
            </button>
          )}
        </div>
      </div>

      {/* ====================================================
          LIVE ORDER QUEUE (GRID LISTING)
          ==================================================== */}
      <div className="flex-1 overflow-y-auto p-6 bg-secondary/10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredTickets.map((ticket) => {
              const elapsedMs = Date.now() - new Date(ticket.orderTime).getTime()
              const elapsedMins = Math.floor(elapsedMs / 60000)
              
              // Waiting Time color logic: Green (<10), Yellow (10-20), Orange (20-30), Red (30+)
              let ageColor = 'border-emerald-500 bg-emerald-500/5'
              let timerBadgeColor = 'bg-emerald-500 text-white'
              
              if (elapsedMins >= 10 && elapsedMins < 20) {
                ageColor = 'border-yellow-500 bg-yellow-500/5'
                timerBadgeColor = 'bg-yellow-500 text-black'
              } else if (elapsedMins >= 20 && elapsedMins < 30) {
                ageColor = 'border-orange-500 bg-orange-500/5'
                timerBadgeColor = 'bg-orange-500 text-white animate-pulse'
              } else if (elapsedMins >= 30) {
                ageColor = 'border-red-500 bg-red-500/5 shadow-lg shadow-red-500/5'
                timerBadgeColor = 'bg-red-500 text-white animate-bounce'
              }

              if (ticket.status === 'Ready' || ticket.status === 'Served') {
                ageColor = 'border-border bg-card'
                timerBadgeColor = 'bg-secondary text-muted-foreground'
              }

              const isEdit = ticket.notes === 'EDITED TICKET'
              const isSelectedForBulk = selectedTicketIds.includes(ticket.id)

              return (
                <motion.div
                  layout
                  key={ticket.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-card rounded-[2rem] border-2 shadow-sm overflow-hidden flex flex-col min-h-[300px] justify-between relative ${ageColor} ${
                    isEdit ? 'border-amber-500/75' : ''
                  }`}
                >
                  {/* Select Checkbox for bulk actions */}
                  <div className="absolute top-4 left-4 z-10">
                    <input 
                      type="checkbox"
                      checked={isSelectedForBulk}
                      onChange={(e) => {
                        e.stopPropagation()
                        setSelectedTicketIds(prev => 
                          prev.includes(ticket.id) ? prev.filter(id => id !== ticket.id) : [...prev, ticket.id]
                        )
                      }}
                      className="w-4 h-4 rounded bg-background border-border text-primary cursor-pointer"
                    />
                  </div>

                  {/* Card Header */}
                  <div 
                    onClick={() => setSelectedTicket(ticket)}
                    className="p-5 pl-10 border-b border-border/50 bg-secondary/15 flex justify-between items-start cursor-pointer hover:bg-secondary/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl font-black text-foreground">Order #{ticket.orderNumber}</span>
                        {isEdit && (
                          <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">MODIFIED</span>
                        )}
                        {ticket.priority !== "Normal" && (
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                            ticket.priority === 'VIP' ? 'bg-purple-500 text-white' : 'bg-red-500 text-white'
                          }`}>
                            {ticket.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-bold mt-1">
                        Table: {ticket.table || "N/A"} • Type: {ticket.orderType}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5 font-semibold">
                        Cashier: {ticket.cashier}
                      </p>
                    </div>

                    <div className={`px-2.5 py-1 rounded-xl flex items-center gap-1 font-black text-sm shrink-0 ${timerBadgeColor}`}>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{elapsedMins}m</span>
                    </div>
                  </div>

                  {/* Card Body - Kitchen Items List */}
                  <div className="flex-1 p-5 overflow-y-auto max-h-[300px] custom-scrollbar space-y-4">
                    {ticket.items.map((item, idx) => (
                      <div key={idx} className={`flex gap-2.5 items-start ${item.type === 'REMOVE' ? 'opacity-40 line-through' : ''}`}>
                        <span className="font-black text-primary text-sm min-w-[2ch]">{item.quantity}x</span>
                        <div className="flex-1">
                          <div className="text-sm font-black text-foreground flex items-center gap-1.5 flex-wrap">
                            {item.type === 'ADD' && <span className="bg-emerald-600 text-white text-[8px] font-black px-1 py-0.5 rounded leading-none shrink-0">ADD</span>}
                            {item.type === 'REMOVE' && <span className="bg-red-500 text-white text-[8px] font-black px-1 py-0.5 rounded leading-none shrink-0">REMOVE</span>}
                            {item.name}
                          </div>
                          
                          {/* Modifiers List */}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="pl-3 mt-1 space-y-0.5">
                              {item.modifiers.map((m, mIdx) => (
                                <p key={mIdx} className="text-[10px] font-bold text-muted-foreground">- {m.name}</p>
                              ))}
                            </div>
                          )}

                          {/* Notes */}
                          {item.notes && (
                            <div className="text-[10px] font-bold text-amber-500 bg-amber-500/10 p-2 rounded-lg mt-1.5 border border-amber-500/20">
                              "{item.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Order Notes */}
                    {ticket.notes && !isEdit && (
                      <div className="border-t border-border/50 pt-3 mt-3">
                        <span className="text-[9px] uppercase font-black text-muted-foreground">Kitchen Notes</span>
                        <p className="text-[10px] font-semibold text-foreground bg-secondary/40 p-2 rounded-xl mt-1">
                          {ticket.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="p-4 border-t border-border/50 bg-secondary/10 flex gap-1.5 shrink-0">
                    {ticket.status === "Waiting" && (
                      <button
                        onClick={() => {
                          updateTicketStatus(ticket.id, "Accepted")
                          playNotificationSound('update')
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl transition-all"
                      >
                        Accept
                      </button>
                    )}

                    {(ticket.status === "Waiting" || ticket.status === "Accepted") && (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, "Preparing")}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-xl transition-all"
                      >
                        Prepare
                      </button>
                    )}

                    {ticket.status === "Preparing" && (
                      <button
                        onClick={() => {
                          updateTicketStatus(ticket.id, "Ready")
                          playNotificationSound('update')
                        }}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-xl transition-all"
                      >
                        Ready
                      </button>
                    )}

                    {ticket.status === "Ready" && (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, "Served")}
                        className="flex-1 py-2.5 bg-secondary hover:bg-border text-foreground text-xs font-black uppercase rounded-xl transition-all border border-border"
                      >
                        Served / Complete
                      </button>
                    )}

                    {ticket.status !== "Served" && ticket.status !== "Cancelled" && (
                      <button
                        onClick={() => {
                          const pin = prompt("Voiding kitchen tickets requires Manager approval. Enter PIN (1234):")
                          if (pin === "1234") {
                            updateTicketStatus(ticket.id, "Cancelled")
                          } else {
                            alert("Invalid PIN.")
                          }
                        }}
                        className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all flex items-center justify-center"
                        title="Void Ticket"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                </motion.div>
              )
            })}
          </AnimatePresence>

          {filteredTickets.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted-foreground">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 opacity-20 mb-3" />
              <h3 className="text-lg font-black text-foreground">KDS Queue Clear</h3>
              <p className="text-xs font-bold mt-1">No active tickets fit the selected kitchen switcher or filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================
          ORDER DETAILS DRAWER (RIGHT-SIDE TICKET PREVIEW)
          ==================================================== */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 overflow-hidden"
            >
              
              {/* Header */}
              <div className="p-6 border-b border-border bg-secondary/30 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-lg font-black text-foreground flex items-center gap-1.5">
                    Ticket # {selectedTicket.orderNumber}
                  </h3>
                  <p className="text-xs text-muted-foreground font-semibold mt-1">
                    Sent to: <span className="text-foreground">{selectedTicket.kitchen}</span> Kitchen • {new Date(selectedTicket.orderTime).toLocaleTimeString()}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 bg-secondary hover:bg-border rounded-xl text-muted-foreground border border-border transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-background/40">
                
                {/* Meta details */}
                <div className="p-4 bg-card border border-border rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-bold">Customer:</span>
                    <span className="font-black text-foreground">{selectedTicket.customer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-bold">Order Type:</span>
                    <span className="font-black text-foreground">{selectedTicket.orderType}</span>
                  </div>
                  {selectedTicket.table !== "N/A" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-bold">Table:</span>
                      <span className="font-black text-foreground">Table {selectedTicket.table}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-bold">Cashier:</span>
                    <span className="font-black text-foreground">{selectedTicket.cashier}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border/50">
                    <span className="text-muted-foreground font-bold">KDS status:</span>
                    <span className="font-black text-primary">{selectedTicket.status}</span>
                  </div>
                </div>

                {/* monospaced ticket */}
                <div className="p-5 bg-card border border-border rounded-[2rem] font-mono text-xs text-foreground">
                  <div className="text-center pb-3 border-b border-dashed border-border mb-3">
                    <h4 className="font-black uppercase">KITCHEN DUPLICATE</h4>
                    <p className="text-[10px] text-muted-foreground mt-1">Order #{selectedTicket.orderNumber}</p>
                  </div>
                  
                  <div className="space-y-3">
                    {selectedTicket.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="font-bold">{item.quantity}x</span>
                        <div>
                          <p className="font-bold">{item.name}</p>
                          {item.modifiers?.map((m, mIdx) => (
                            <p key={mIdx} className="text-[10px] text-muted-foreground pl-2">- {m.name}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedTicket.notes && (
                    <div className="mt-4 pt-3 border-t border-dashed border-border">
                      <p className="text-[10px] font-bold text-orange-500">Note: {selectedTicket.notes}</p>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-black tracking-wider text-muted-foreground">Kitchen Steps Timeline</h4>
                  <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    <div className="relative flex gap-3 items-start">
                      <div className="absolute -left-[23px] bg-background p-0.5 rounded-full border border-border">
                        <Clock className="w-3.5 h-3.5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-foreground">Ticket Created</p>
                        <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">by POS Terminal • {new Date(selectedTicket.orderTime).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    {selectedTicket.status !== "Waiting" && (
                      <div className="relative flex gap-3 items-start">
                        <div className="absolute -left-[23px] bg-background p-0.5 rounded-full border border-border">
                          <Check className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Kitchen Acknowledged</p>
                          <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">by Chef Station</p>
                        </div>
                      </div>
                    )}
                    {selectedTicket.status === "Ready" && (
                      <div className="relative flex gap-3 items-start">
                        <div className="absolute -left-[23px] bg-background p-0.5 rounded-full border border-border">
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">Marked Ready</p>
                          <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">by Chef Station</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Actions Footer */}
              <div className="p-6 border-t border-border bg-card grid grid-cols-2 gap-2 shrink-0">
                <button 
                  onClick={() => {
                    updateTicketStatus(selectedTicket.id, "Preparing")
                    setSelectedTicket(prev => prev ? { ...prev, status: "Preparing" } : null)
                  }}
                  className="py-3 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Play className="w-4 h-4 text-blue-500" /> Cook / Prepare
                </button>

                <button 
                  onClick={() => {
                    updateTicketStatus(selectedTicket.id, "Ready")
                    setSelectedTicket(prev => prev ? { ...prev, status: "Ready" } : null)
                  }}
                  className="py-3 bg-emerald-600 text-white hover:bg-emerald-700 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/10"
                >
                  <CheckCircle2 className="w-4 h-4" /> Ready
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
