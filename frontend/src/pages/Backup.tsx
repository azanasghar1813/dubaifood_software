import { useState, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { 
  Database, RefreshCw, Trash2
} from "lucide-react"

export default function Backup() {
  const [backups, setBackups] = useState([
    { id: "BKP-001", filename: "db_snapshot_2026-07-28_1700.sqlite", createdBy: "Ahmed Raza", size: "12.4 MB", type: "Local", status: "Verified", date: "Today, 05:00 PM" },
    { id: "BKP-002", filename: "db_snapshot_2026-07-28_0600.sqlite", createdBy: "System Auto", size: "12.2 MB", type: "Cloud Mirror", status: "Verified", date: "Today, 06:00 AM" },
    { id: "BKP-003", filename: "db_snapshot_2026-07-27_0600.sqlite", createdBy: "System Auto", size: "11.8 MB", type: "Cloud Mirror", status: "Verified", date: "Yesterday, 06:00 AM" },
    { id: "BKP-004", filename: "db_snapshot_2026-07-26_0600.sqlite", createdBy: "System Auto", size: "11.5 MB", type: "Local & Cloud", status: "Verified", date: "26 Jul 2026, 06:00 AM" }
  ])

  // Local configs
  const [autoBackup, setAutoBackup] = useState(true)
  const [retentionCount, setRetentionCount] = useState(30)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const storageSummary = {
    dbSize: "12.4 MB",
    diskFree: "45.2 GB",
    lastBackup: "Today, 05:00 PM",
    totalFiles: backups.length
  }

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + B: Create Backup
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault()
        handleCreateBackup()
      }

      // F5 Refresh list
      if (e.key === "F5") {
        e.preventDefault()
        handleVerifyIntegrity()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [backups])

  const handleCreateBackup = () => {
    if (isBackingUp) return
    setIsBackingUp(true)
    setTimeout(() => {
      setIsBackingUp(false)
      const newBkp = {
        id: `BKP-0${backups.length + 1}`,
        filename: `db_snapshot_${new Date().toISOString().split("T")[0]}_manual.sqlite`,
        createdBy: "Ahmed Raza",
        size: "12.5 MB",
        type: "Local",
        status: "Verified",
        date: "Just Now"
      }
      setBackups([newBkp, ...backups])
      alert("Local SQLite database backup generated successfully.")
    }, 1500)
  }

  const handleRestore = (filename: string) => {
    if (confirm(`CAUTION: Restoring "${filename}" will overwrite all current session tables and cache states. Proceed?`)) {
      setIsRestoring(true)
      setTimeout(() => {
        setIsRestoring(false)
        alert("Database snapshot restored and indices verified successfully. Session reloaded.")
      }, 2000)
    }
  }

  const handleDeleteBackup = (id: string) => {
    if (confirm("Permanently delete this backup archive from storage?")) {
      setBackups(backups.filter(b => b.id !== id))
    }
  }

  const handleVerifyIntegrity = () => {
    alert("Running database tables structural and key index integrity check... Status: Healthy.")
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">
      
      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Backup & Restore Center
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Enterprise Storage</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Perform database maintenance, schedule automatic storage snapshots, and restore recovery points.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleVerifyIntegrity}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Integrity check [F5]
          </button>
          
          <button 
            onClick={handleCreateBackup}
            disabled={isBackingUp}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 disabled:opacity-50 transition-all active:scale-95"
          >
            <Database className="w-4 h-4" />
            {isBackingUp ? "Backing up..." : "Create Backup [Ctrl+B]"}
          </button>
        </div>
      </div>

      {/* ====================================================
          DIAGNOSTIC TOTALS
          ==================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Database Size", val: storageSummary.dbSize, sub: "SQLite local file store", color: "text-blue-500" },
          { label: "Storage Disk Space", val: storageSummary.diskFree, sub: "Free storage space", color: "text-emerald-500" },
          { label: "Last Auto-Backup", val: storageSummary.lastBackup, sub: "Completed successfully", color: "text-emerald-500" },
          { label: "Configured Archives", val: `${storageSummary.totalFiles} Backups`, sub: "Retention target: 30 files", color: "text-amber-500" }
        ].map((card, i) => (
          <div key={i} className="p-4 bg-card border border-border/50 rounded-2xl flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{card.label}</span>
              <h4 className="text-xl font-black mt-2 text-foreground">{card.val}</h4>
            </div>
            <span className={`text-[8px] font-bold mt-2 ${card.color}`}>{card.sub}</span>
          </div>
        ))}
      </div>

      {/* ====================================================
          MAIN RECOVERY GRID
          ==================================================== */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Side: Backup archives history */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">Available Recovery Points</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-secondary/30 text-muted-foreground text-xs uppercase font-bold border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Filename</th>
                    <th className="px-6 py-4">Created By</th>
                    <th className="px-6 py-4">Archive Size</th>
                    <th className="px-6 py-4">Storage Destination</th>
                    <th className="px-6 py-4 text-center">Security Status</th>
                    <th className="px-6 py-4 text-right">Recover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {backups.map((bkp) => (
                    <tr key={bkp.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 font-black text-foreground text-xs">{bkp.filename}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-muted-foreground">{bkp.createdBy}</td>
                      <td className="px-6 py-4 text-xs font-bold">{bkp.size}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-muted-foreground">{bkp.type}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          {bkp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button 
                            onClick={() => handleRestore(bkp.filename)}
                            className="px-3 py-1.5 bg-primary text-white hover:bg-primary/95 text-[10px] uppercase font-black rounded-lg transition-all"
                          >
                            Restore
                          </button>
                          <button 
                            onClick={() => handleDeleteBackup(bkp.id)}
                            className="p-2 bg-secondary text-red-500 hover:bg-red-500 hover:text-white border border-border rounded-xl transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Side: Schedules & Cloud configurations */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          
          {/* Scheduling Prefs */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">Backup Schedule</h3>
            
            <div className="space-y-4 text-xs font-bold">
              <div className="flex justify-between items-center p-2 bg-secondary/40 border border-border rounded-xl">
                <span className="text-muted-foreground">Auto-Backup on Session Close</span>
                <input type="checkbox" checked={autoBackup} onChange={e=>setAutoBackup(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-muted-foreground">Archive Retention Count</label>
                <input 
                  type="number"
                  value={retentionCount}
                  onChange={e=>setRetentionCount(parseInt(e.target.value) || 30)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border px-2 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Cloud Storage Mirror */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">Cloud Backups</h3>
            
            <div className="space-y-3 text-xs font-bold text-muted-foreground">
              <div className="flex justify-between items-center p-2 bg-secondary/40 border border-border rounded-xl">
                <span>Google Cloud Storage Mirror</span>
                <span className="text-emerald-500 text-[10px] uppercase">Active</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-secondary/40 border border-border rounded-xl">
                <span>Amazon AWS S3 Glacier</span>
                <span className="text-zinc-400 text-[10px] uppercase">Disabled</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Restore loading overlay */}
      <AnimatePresence>
        {isRestoring && (
          <div className="fixed inset-0 z-[300] bg-background/90 backdrop-blur-md flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-xl font-black text-foreground">Restoring Database Snapshot...</h3>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs">
              Overwriting current transactions table and clearing object cache. Verifying index constraints. Do not turn off POS terminal.
            </p>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
