import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Cloud, CheckCircle2, RefreshCw, Wifi, WifiOff, Database, Server, Laptop, 
  Terminal, ShieldCheck, Play, Pause, RotateCcw, AlertTriangle, ShieldAlert, 
  Settings, Trash2, Plus, Edit3, Check, X, Search, Filter, History, HelpCircle
} from "lucide-react"

export default function Synchronization() {
  // Sync Center States
  const [isSyncing, setIsSyncing] = useState(false)
  const [autoSync, setAutoSync] = useState(true)
  const [syncInterval, setSyncInterval] = useState("30 Seconds")
  const [isPaused, setIsPaused] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("All")
  
  // Register new device form
  const [newDeviceName, setNewDeviceName] = useState("")
  const [newDeviceIp, setNewDeviceIp] = useState("")
  const [newDeviceRole, setNewDeviceRole] = useState("Counter PC")

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Network State Simulator
  const [networkQuality, setNetworkQuality] = useState<"Excellent" | "Good" | "Poor" | "Offline">("Excellent")
  const [latency, setLatency] = useState(24)

  const [devices, setDevices] = useState([
    { id: "DEV-A1", name: "Counter PC 1 (Billing)", ip: "192.168.1.10", role: "Cashier Terminal", status: "Online", lastSeen: "Just Now" },
    { id: "DEV-A2", name: "Counter PC 2 (Takeaway)", ip: "192.168.1.11", role: "Cashier Terminal", status: "Online", lastSeen: "2 mins ago" },
    { id: "DEV-K1", name: "Fast Food Kitchen KDS", ip: "192.168.1.50", role: "Kitchen Display", status: "Online", lastSeen: "Just Now" },
    { id: "DEV-K2", name: "Restaurant Kitchen KDS", ip: "192.168.1.51", role: "Kitchen Display", status: "Offline", lastSeen: "1 hr ago" },
    { id: "DEV-M1", name: "Manager Office Laptop", ip: "192.168.1.100", role: "Backoffice Admin", status: "Online", lastSeen: "5 mins ago" }
  ])

  const [pendingChanges, setPendingChanges] = useState({
    orders: 4,
    products: 0,
    customers: 2,
    reports: 1,
    settings: 0,
    cashiers: 1
  })

  const [syncHistory, setSyncHistory] = useState([
    { id: "H-9921", date: "Today", time: "05:00 PM", device: "Counter PC 1", uploaded: 12, downloaded: 4, duration: "1.2s", status: "Successful" },
    { id: "H-9920", date: "Today", time: "04:30 PM", device: "Manager PC", uploaded: 0, downloaded: 18, duration: "2.4s", status: "Successful" },
    { id: "H-9919", date: "Today", time: "04:00 PM", device: "Counter PC 2", uploaded: 6, downloaded: 2, duration: "0.8s", status: "Successful" },
    { id: "H-9918", date: "Today", time: "03:30 PM", device: "Fast Food Kitchen", uploaded: 0, downloaded: 0, duration: "0.5s", status: "Successful" },
    { id: "H-9917", date: "Today", time: "03:00 PM", device: "Counter PC 1", uploaded: 15, downloaded: 6, duration: "1.9s", status: "Failed" }
  ])

  const [conflicts, setConflicts] = useState([
    { id: "C-101", type: "Order Edited on 2 registers", item: "Order #ORD-8012", localTime: "04:55 PM", cloudTime: "04:54 PM", description: "Counter PC 1 modified payment type to Card while Counter PC 2 marked it as Unpaid cash." }
  ])

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "SELECT"

      // F5 Refresh
      if (e.key === "F5") {
        e.preventDefault()
        handleAutoDetect()
      }

      // Ctrl + S: Trigger Sync Now
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault()
        triggerSync()
      }

      // Ctrl + F: Search Focus
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [pendingChanges])

  const handleAutoDetect = () => {
    setLatency(Math.floor(Math.random() * 30) + 10)
    alert("Refreshing local server and testing cloud ping latency...")
  }

  const triggerSync = () => {
    if (isSyncing || networkQuality === "Offline") return
    setIsSyncing(true)

    // Simulate Sync upload and download completion
    setTimeout(() => {
      setIsSyncing(false)
      const count = pendingChanges.orders + pendingChanges.customers + pendingChanges.reports + pendingChanges.cashiers
      setPendingChanges({
        orders: 0,
        products: 0,
        customers: 0,
        reports: 0,
        settings: 0,
        cashiers: 0
      })
      setSyncHistory(prev => [
        {
          id: `H-${Math.floor(Math.random() * 9000) + 1000}`,
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          device: "Local Station PC 1",
          uploaded: count,
          downloaded: 3,
          duration: "1.4s",
          status: "Successful"
        },
        ...prev
      ])
    }, 2000)
  }

  const handleRegisterDevice = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDeviceName || !newDeviceIp) return
    const newDev = {
      id: `DEV-X${devices.length + 1}`,
      name: newDeviceName,
      ip: newDeviceIp,
      role: newDeviceRole,
      status: "Online",
      lastSeen: "Just Now"
    }
    setDevices([...devices, newDev])
    setNewDeviceName("")
    setNewDeviceIp("")
  }

  const handleRemoveDevice = (id: string) => {
    if (confirm("Disconnect and remove this terminal ID?")) {
      setDevices(devices.filter(d => d.id !== id))
    }
  }

  const handleResolveConflict = (conflictId: string, resolution: "local" | "cloud" | "merge") => {
    setConflicts(conflicts.filter(c => c.id !== conflictId))
    alert(`Conflict resolved: Retaining data from "${resolution}" database.`)
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">
      
      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Synchronization Command Center
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Offline-First</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Manage multi-terminal LAN database mesh, offline caching queue, and secure Cloud backup syncing.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={triggerSync}
            disabled={isSyncing || networkQuality === "Offline"}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? "Syncing data..." : "Sync Now [Ctrl+S]"}
          </button>
        </div>
      </div>

      {/* ====================================================
          SYNC STATUS CARDS
          ==================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Internet", val: networkQuality, sub: `Latency: ${latency} ms`, color: networkQuality === "Offline" ? "text-red-500" : "text-emerald-500" },
          { label: "Cloud Sync Gateway", val: isPaused ? "Paused" : "Connected", sub: "Cloud DB Mirror Active", color: isPaused ? "text-amber-500" : "text-emerald-500" },
          { label: "SQLite DB Status", val: "Healthy", sub: "Integrity check pass", color: "text-emerald-500" },
          { label: "Pending Upload Queue", val: `${pendingChanges.orders} Orders`, sub: `${pendingChanges.customers + pendingChanges.reports + pendingChanges.cashiers} meta records waiting`, color: "text-amber-500" },
          { label: "Last Auto-Sync", val: "2 mins ago", sub: "Successfully uploaded", color: "text-zinc-400" },
          { label: "Auto Sync Status", val: autoSync ? `Every ${syncInterval}` : "Disabled", sub: "Periodic sync task", color: autoSync ? "text-emerald-500" : "text-zinc-500" }
        ].map((card, i) => (
          <div key={i} className="p-4 bg-card border border-border/50 rounded-2xl flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{card.label}</span>
              <h4 className="text-base font-black mt-2 text-foreground">{card.val}</h4>
            </div>
            <span className={`text-[8px] font-bold mt-2 ${card.color}`}>{card.sub}</span>
          </div>
        ))}
      </div>

      {/* ====================================================
          MAIN DIAGNOSTICS & CONSOLE GRID
          ==================================================== */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Side: Pending queues & conflict resolution */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          
          {/* Pending Changes indicators */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">Pending Offline Queue</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: "Orders Waiting", val: pendingChanges.orders, color: "text-orange-500" },
                { label: "Products Waiting", val: pendingChanges.products, color: "text-zinc-500" },
                { label: "Customers Waiting", val: pendingChanges.customers, color: "text-blue-500" },
                { label: "Reports Waiting", val: pendingChanges.reports, color: "text-amber-500" },
                { label: "Settings Waiting", val: pendingChanges.settings, color: "text-zinc-500" },
                { label: "Cashiers Waiting", val: pendingChanges.cashiers, color: "text-indigo-500" }
              ].map((item, idx) => (
                <div key={idx} className="p-3 bg-secondary/40 border border-border rounded-xl text-center">
                  <span className="text-[9px] text-muted-foreground uppercase font-black">{item.label}</span>
                  <p className={`text-xl font-black mt-2 ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sync History timeline */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <History className="w-5 h-5 text-primary" /> Sync History Log
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-secondary/30 text-muted-foreground text-xs uppercase font-bold border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Device Terminal</th>
                    <th className="px-4 py-3 text-center">Uploaded</th>
                    <th className="px-4 py-3 text-center">Downloaded</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {syncHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-bold text-muted-foreground text-xs">{row.date}, {row.time}</td>
                      <td className="px-4 py-3 font-black text-foreground">{row.device}</td>
                      <td className="px-4 py-3 text-center font-bold">{row.uploaded}</td>
                      <td className="px-4 py-3 text-center font-bold">{row.downloaded}</td>
                      <td className="px-4 py-3 text-xs">{row.duration}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase border ${
                          row.status === "Successful" 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Conflict Resolution Block */}
          {conflicts.length > 0 && (
            <div className="p-6 bg-amber-500/10 border border-amber-500/25 rounded-[2.5rem] shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-black uppercase tracking-wider">Sync Conflict Warnings</h3>
              </div>
              
              {conflicts.map(conf => (
                <div key={conf.id} className="p-4 bg-card border border-border rounded-2xl space-y-3 text-xs font-bold text-foreground">
                  <div className="flex justify-between">
                    <span className="text-primary font-black">{conf.item}</span>
                    <span className="text-muted-foreground">Conflict ID: {conf.id}</span>
                  </div>
                  <p className="text-muted-foreground font-semibold leading-relaxed">{conf.description}</p>
                  
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => handleResolveConflict(conf.id, "local")}
                      className="px-3 py-1.5 bg-secondary hover:bg-border border border-border text-[10px] uppercase font-black rounded-lg transition-colors"
                    >
                      Keep Local PC Data
                    </button>
                    <button 
                      onClick={() => handleResolveConflict(conf.id, "cloud")}
                      className="px-3 py-1.5 bg-secondary hover:bg-border border border-border text-[10px] uppercase font-black rounded-lg transition-colors"
                    >
                      Keep Cloud Data
                    </button>
                    <button 
                      onClick={() => handleResolveConflict(conf.id, "merge")}
                      className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-[10px] uppercase font-black rounded-lg transition-colors"
                    >
                      Automated Merge Rules
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Right Side: Connected Devices list & sync controls */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          
          {/* Sync actions & Interval configs */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">Sync Preferences</h3>
            
            <div className="space-y-4 text-xs font-bold">
              <div className="flex justify-between items-center p-2 bg-secondary/40 border border-border rounded-xl">
                <span className="text-muted-foreground">Enable Periodic Auto-Sync</span>
                <input type="checkbox" checked={autoSync} onChange={e=>setAutoSync(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
              </div>

              {autoSync && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Sync Interval</label>
                  <select 
                    value={syncInterval}
                    onChange={e=>setSyncInterval(e.target.value)}
                    className="w-full h-9 rounded-lg bg-secondary border border-border px-2 focus:outline-none"
                  >
                    <option value="10 Seconds">Every 10 Seconds</option>
                    <option value="30 Seconds">Every 30 Seconds</option>
                    <option value="1 Minute">Every 1 Minute</option>
                    <option value="5 Minutes">Every 5 Minutes</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Connected LAN Terminals list */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">Registered Devices</h3>
            
            <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
              {devices.map(dev => (
                <div key={dev.id} className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl">
                  <div>
                    <span className="font-black text-xs text-foreground block">{dev.name}</span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">IP: {dev.ip} • Role: {dev.role}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                      dev.status === "Online" 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                    }`}>
                      {dev.status}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveDevice(dev.id)}
                      className="text-red-500 hover:bg-red-500/10 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Register New Terminal Form */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Register POS Terminal</h3>
            <form onSubmit={handleRegisterDevice} className="space-y-3 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-muted-foreground">Terminal Name</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. Counter PC 3" 
                  value={newDeviceName}
                  onChange={e=>setNewDeviceName(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-secondary border border-border outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-muted-foreground">LAN IP Address</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. 192.168.1.12" 
                  value={newDeviceIp}
                  onChange={e=>setNewDeviceIp(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-secondary border border-border outline-none focus:border-orange-500"
                />
              </div>

              <button 
                type="submit"
                className="w-full h-9 bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase rounded-lg transition-colors flex items-center justify-center gap-1 mt-2"
              >
                <Plus className="w-3.5 h-3.5" /> Register Terminal
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  )
}
