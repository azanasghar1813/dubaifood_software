import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, Download, Printer, RefreshCw,
  X, Eye
} from "lucide-react"

// Mock Audit Logs
const initialLogs = [
  { 
    id: "LOG-001",
    time: "05:12 PM",
    date: "Today",
    user: "Ali Shan",
    role: "Manager",
    module: "Orders",
    action: "Order Cancelled",
    description: "Cancelled unpaid order #ORD-8012 due to customer change of mind.",
    device: "Counter PC 1",
    computerName: "TERMINAL-01",
    ipAddress: "192.168.1.10",
    status: "Success",
    severity: "Critical",
    oldValue: "Order Status: Confirmed (Unpaid)",
    newValue: "Order Status: Cancelled (Voided)",
    reason: "Customer requested cancellation before prep began"
  },
  { 
    id: "LOG-002",
    time: "05:08 PM",
    date: "Today",
    user: "Ahmed Raza",
    role: "Cashier",
    module: "POS",
    action: "Discount Applied",
    description: "Applied Promo Code 'WELCOME10' (10% Off) on order #ORD-8015.",
    device: "Counter PC 1",
    computerName: "TERMINAL-01",
    ipAddress: "192.168.1.10",
    status: "Success",
    severity: "Warning",
    oldValue: "Discount: Rs. 0",
    newValue: "Discount: Rs. 240 (10% discount)",
    reason: "Promotion voucher applied"
  },
  { 
    id: "LOG-003",
    time: "04:55 PM",
    date: "Today",
    user: "Ali Shan",
    role: "Manager",
    module: "Permissions",
    action: "Permission Changed",
    description: "Granted 'refund' permissions to Cashier role globally.",
    device: "Manager Office PC",
    computerName: "MGR-LAPTOP",
    ipAddress: "192.168.1.100",
    status: "Success",
    severity: "Critical",
    oldValue: "Cashier Refund Permission: False",
    newValue: "Cashier Refund Permission: True",
    reason: "Temporary permissions for evening rush hour override"
  },
  { 
    id: "LOG-004",
    time: "04:30 PM",
    date: "Today",
    user: "Umar Farooq",
    role: "Cashier",
    module: "Products",
    action: "Price Changed",
    description: "Modified retail price of Malai Boti Pizza (Medium) from 1150 to 1200.",
    device: "Counter PC 2",
    computerName: "TERMINAL-02",
    ipAddress: "192.168.1.11",
    status: "Success",
    severity: "Warning",
    oldValue: "Retail Price: Rs. 1,150",
    newValue: "Retail Price: Rs. 1,200",
    reason: "Menu markup update"
  },
  { 
    id: "LOG-005",
    time: "04:12 PM",
    date: "Today",
    user: "System",
    role: "System Sync",
    module: "Synchronization",
    action: "Synchronization Completed",
    description: "Uploaded 12 cached orders to master database mirror.",
    device: "Local Server Gateway",
    computerName: "DF-GATEWAY",
    ipAddress: "192.168.1.1",
    status: "Success",
    severity: "Success",
    oldValue: "Unsynced Local Orders: 12",
    newValue: "Unsynced Local Orders: 0",
    reason: "Auto-sync cron interval"
  },
  { 
    id: "LOG-006",
    time: "03:45 PM",
    date: "Today",
    user: "Bilal Hassan",
    role: "Kitchen Staff",
    module: "KDS",
    action: "PIN Failure",
    description: "Incorrect PIN override entry on Fast Food KDS station (Failed attempts: 3).",
    device: "FF-KDS Terminal",
    computerName: "KDS-FASTFOOD",
    ipAddress: "192.168.1.50",
    status: "Failed",
    severity: "Error",
    oldValue: "Attempt: 2",
    newValue: "Attempt: 3 (Warning: Account Lockout near)",
    reason: "Cashier login validation override"
  },
  { 
    id: "LOG-007",
    time: "02:15 PM",
    date: "Today",
    user: "Umar Farooq",
    role: "Cashier",
    module: "Backup",
    action: "Backup Created",
    description: "Manual database snapshot SQLite snapshot generated successfully.",
    device: "Counter PC 2",
    computerName: "TERMINAL-02",
    ipAddress: "192.168.1.11",
    status: "Success",
    severity: "Info",
    oldValue: "Database State: Active",
    newValue: "Backup File: db_snapshot_20260728.sqlite",
    reason: "Pre-shift close backup routine"
  }
]

export default function ActivityLogs() {
  const [logs] = useState<any[]>(initialLogs)
  const [search, setSearch] = useState("")
  const [filterModule, setFilterModule] = useState("All")
  const [filterSeverity, setFilterSeverity] = useState("All")
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Drawer states
  const [selectedLog, setSelectedLog] = useState<any | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)




  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "SELECT"

      // F2 Focus Search
      if (e.key === "F2") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // Ctrl + E: Export
      if (e.ctrlKey && e.key === "e") {
        e.preventDefault()
        alert("Exporting audit log table as CSV.")
      }

      // Ctrl + P: Print
      if (e.ctrlKey && e.key === "p" && !isInput) {
        e.preventDefault()
        window.print()
      }

      // F5 Refresh
      if (e.key === "F5") {
        e.preventDefault()
        handleRefresh()
      }

      // Esc: Close Drawer
      if (e.key === "Escape" && isDrawerOpen) {
        e.preventDefault()
        setIsDrawerOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isDrawerOpen])

  // KPIs
  const stats = useMemo(() => {
    const total = logs.length
    const critical = logs.filter(l => l.severity === "Critical").length
    const warning = logs.filter(l => l.severity === "Warning").length
    const failed = logs.filter(l => l.status === "Failed").length
    
    return { total, critical, warning, failed }
  }, [logs])

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = search.toLowerCase()
      const matchSearch = log.user.toLowerCase().includes(q) || 
                          log.action.toLowerCase().includes(q) || 
                          log.module.toLowerCase().includes(q) || 
                          log.description.toLowerCase().includes(q) || 
                          log.device.toLowerCase().includes(q)
      
      const matchModule = filterModule === "All" || log.module === filterModule
      const matchSeverity = filterSeverity === "All" || log.severity === filterSeverity

      return matchSearch && matchModule && matchSeverity
    })
  }, [logs, search, filterModule, filterSeverity])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const handleOpenLog = (log: any) => {
    setSelectedLog(log)
    setIsDrawerOpen(true)
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">
      
      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Activity Logs & Audit Center
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Enterprise Auditing</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Business Day: 6AM–6AM
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleRefresh}
            className={`p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border relative transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => alert("Audit log data exported.")}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          <button 
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" /> Print Log
          </button>
        </div>
      </div>

      {/* ====================================================
          STATISTICS CARDS
          ==================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Today's Activities", val: stats.total, color: "text-blue-500" },
          { label: "Critical Operations", val: stats.critical, color: "text-red-500" },
          { label: "Warning events", val: stats.warning, color: "text-amber-500" },
          { label: "Failed Validations", val: stats.failed, color: "text-rose-500" }
        ].map((card, i) => (
          <div key={i} className="p-4 bg-card border border-border rounded-2xl flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{card.label}</span>
              <h4 className="text-xl font-black mt-2 text-foreground">{card.val}</h4>
            </div>
          </div>
        ))}
      </div>

      {/* ====================================================
          GLOBAL SEARCH & ADVANCED FILTERS
          ==================================================== */}
      <div className="bg-card border border-border rounded-3xl p-4 shadow-sm space-y-4">
        <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-4 h-4" /></span>
            <input 
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Username, Action, Description, Terminal ID... (Press F2 to focus)"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-sm font-bold text-foreground placeholder:text-muted-foreground transition-all"
            />
          </div>

          <select 
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="h-11 px-3 rounded-xl bg-secondary border border-border text-xs font-bold focus:outline-none"
          >
            <option value="All">All Modules</option>
            <option value="POS">POS Billing</option>
            <option value="Orders">Orders</option>
            <option value="Products">Products</option>
            <option value="KDS">Kitchen Display</option>
            <option value="Permissions">Permissions</option>
            <option value="Backup">Backup</option>
            <option value="Synchronization">Sync Center</option>
          </select>

          <select 
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="h-11 px-3 rounded-xl bg-secondary border border-border text-xs font-bold focus:outline-none"
          >
            <option value="All">All Severities</option>
            <option value="Info">Info</option>
            <option value="Success">Success</option>
            <option value="Warning">Warning</option>
            <option value="Critical">Critical</option>
            <option value="Error">Error</option>
          </select>
        </div>
      </div>

      {/* ====================================================
          AUDIT TABLE
          ==================================================== */}
      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-secondary/30 text-muted-foreground text-xs uppercase font-bold border-b border-border">
            <tr>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">Operator</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Module</th>
              <th className="px-6 py-4">Action Event</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Device</th>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredLogs.map((log) => (
              <tr 
                key={log.id}
                onClick={() => handleOpenLog(log)}
                className="hover:bg-secondary/20 transition-colors cursor-pointer group"
              >
                <td className="px-6 py-4 font-bold text-muted-foreground text-xs">{log.time}</td>
                <td className="px-6 py-4 font-black text-foreground">{log.user}</td>
                <td className="px-6 py-4 text-xs font-semibold text-muted-foreground">{log.role}</td>
                <td className="px-6 py-4 text-xs font-bold">{log.module}</td>
                <td className="px-6 py-4 text-xs font-black text-primary">{log.action}</td>
                <td className="px-6 py-4 text-xs text-muted-foreground max-w-xs truncate">{log.description}</td>
                <td className="px-6 py-4 text-xs text-foreground font-semibold">{log.device}</td>
                <td className="px-6 py-4">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border ${
                    log.severity === "Success" ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                    log.severity === "Critical" ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse' :
                    log.severity === "Warning" ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                    log.severity === "Error" ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    'bg-blue-500/10 text-blue-500 border-blue-500/20'
                  }`}>
                    {log.severity}
                  </span>
                </td>
                <td className="px-6 py-4 text-right" onClick={e=>e.stopPropagation()}>
                  <button 
                    onClick={() => handleOpenLog(log)}
                    className="p-2 bg-secondary text-foreground hover:bg-border border border-border rounded-xl transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted-foreground font-bold">No audit records match filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ====================================================
          LOG DETAILS DRAWER (RIGHT-SIDE)
          ==================================================== */}
      <AnimatePresence>
        {isDrawerOpen && selectedLog && (
          <div className="fixed inset-0 z-50 flex justify-end">
            
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />

            {/* Drawer Body */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 overflow-hidden text-foreground"
            >
              <div className="p-6 border-b border-border bg-secondary/30 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-lg font-black text-foreground">Audit Log details</h2>
                  <p className="text-xs text-muted-foreground font-semibold mt-1">Log Event ID: {selectedLog.id}</p>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 bg-secondary hover:bg-border rounded-xl text-muted-foreground border border-border transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form fields */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-background/40">
                
                <div className="space-y-4">
                  <div className="p-4 bg-secondary/40 border border-border rounded-2xl space-y-3 text-xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Operator User:</span>
                      <span className="text-foreground">{selectedLog.user}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigned Role:</span>
                      <span className="text-foreground">{selectedLog.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">System Module:</span>
                      <span className="text-foreground">{selectedLog.module}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Action Event:</span>
                      <span className="text-primary font-black">{selectedLog.action}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Terminal Station:</span>
                      <span className="text-foreground">{selectedLog.device}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">LAN IP Address:</span>
                      <span className="text-foreground font-mono">{selectedLog.ipAddress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hostname:</span>
                      <span className="text-foreground font-mono">{selectedLog.computerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Timestamp:</span>
                      <span className="text-foreground">{selectedLog.date}, {selectedLog.time}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-card border border-border rounded-2xl space-y-3 text-xs font-bold">
                    <h4 className="text-xs uppercase font-black tracking-wider text-muted-foreground">Pre/Post State Changes</h4>
                    
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-black">Pre-Change value</span>
                      <div className="p-2 bg-secondary rounded-lg font-mono text-[10px] text-red-500 border border-red-500/10">
                        {selectedLog.oldValue}
                      </div>
                    </div>

                    <div className="space-y-1 mt-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-black">Post-Change value</span>
                      <div className="p-2 bg-secondary rounded-lg font-mono text-[10px] text-emerald-500 border border-emerald-500/10">
                        {selectedLog.newValue}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-card border border-border rounded-2xl space-y-1 text-xs font-bold">
                    <span className="text-[10px] text-muted-foreground uppercase font-black">Operator Reason override</span>
                    <p className="p-3 bg-secondary rounded-xl text-foreground font-semibold italic">
                      "{selectedLog.reason || 'No custom override reason provided.'}"
                    </p>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-6 border-t border-border bg-card shrink-0">
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-full py-3 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center transition-colors"
                >
                  Close Details
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
