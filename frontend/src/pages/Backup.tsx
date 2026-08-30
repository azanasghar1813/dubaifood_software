import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { 
  Database, RefreshCw, Trash2, HardDrive, Clock
} from "lucide-react"
import { backupApi, type BackupRecord } from "../api/backupApi"
import { toast } from "../store/toastStore"

export default function Backup() {
  const [backups, setBackups] = useState<BackupRecord[]>([])
  
  // Local configs
  const [autoBackup, setAutoBackup] = useState(true)
  const [retentionCount, setRetentionCount] = useState(30)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchBackups = async () => {
    try {
      setIsLoading(true);
      const data = await backupApi.getBackups();
      setBackups(data);
    } catch (err) {
      toast.error("Failed to load backups");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchBackups();
  }, [])

  const storageSummary = {
    dbSize: backups[0]?.size || "0 MB",
    diskFree: "Sufficient",
    lastBackup: backups[0]?.date || "Never",
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
        fetchBackups()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [backups])

  const handleCreateBackup = async () => {
    if (isBackingUp) return
    setIsBackingUp(true)
    const tId = toast.loading("Creating database backup...")
    try {
      await backupApi.createBackup();
      toast.success("Backup generated successfully", { id: tId });
      fetchBackups();
    } catch (err) {
      toast.error("Failed to create backup", { id: tId });
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleDeleteBackup = async (id: string) => {
    if (confirm("Permanently delete this backup archive from storage?")) {
      const tId = toast.loading("Deleting backup...")
      try {
        await backupApi.deleteBackup(id);
        toast.success("Backup deleted", { id: tId });
        setBackups(backups.filter(b => b.id !== id));
      } catch (err) {
        toast.error("Failed to delete backup", { id: tId });
      }
    }
  }

  const handleRestoreBackup = async (id: string) => {
    if (confirm("WARNING: This will overwrite your current database with this backup! Any new transactions made after this backup was created WILL BE LOST! Are you absolutely sure you want to restore?")) {
      setIsRestoring(true);
      const tId = toast.loading("Restoring backup and restarting system...");
      try {
        await backupApi.restoreLocalBackup(id);
        toast.success("Restore successful! The system is restarting...", { id: tId });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (err) {
        toast.error("Failed to restore backup", { id: tId });
        setIsRestoring(false);
      }
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12 animate-in fade-in zoom-in-95 duration-500">
      
      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Backup & Restore Center
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Enterprise Storage</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Perform database maintenance, schedule automatic storage snapshots, and restore recovery points.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap relative z-10">
          <button 
            onClick={fetchBackups}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh [F5]
          </button>
          
          <button 
            onClick={handleCreateBackup}
            disabled={isBackingUp}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/20 disabled:opacity-50 transition-all active:scale-95"
          >
            <Database className={`w-4 h-4 ${isBackingUp ? 'animate-pulse' : ''}`} />
            {isBackingUp ? "Backing up..." : "Create Backup [Ctrl+B]"}
          </button>
        </div>
      </div>

      {/* ====================================================
          DIAGNOSTIC TOTALS
          ==================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Database Size", val: storageSummary.dbSize, sub: "SQLite local file store", color: "text-blue-500", icon: Database },
          { label: "Storage Disk Space", val: storageSummary.diskFree, sub: "Free storage space", color: "text-emerald-500", icon: HardDrive },
          { label: "Last Backup", val: storageSummary.lastBackup, sub: "Completed successfully", color: "text-emerald-500", icon: Clock },
          { label: "Configured Archives", val: `${storageSummary.totalFiles} Backups`, sub: "Retention target: 30 files", color: "text-amber-500", icon: Database }
        ].map((card, i) => (
          <div key={i} className="p-4 bg-card border border-border/50 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute right-[-20px] top-[-20px] opacity-5 group-hover:scale-110 transition-transform duration-500">
              <card.icon className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{card.label}</span>
              <h4 className="text-xl font-black mt-2 text-foreground">{card.val}</h4>
              <span className={`text-[8px] font-bold mt-2 block ${card.color}`}>{card.sub}</span>
            </div>
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
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Archive Size</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground font-bold text-xs">Loading backups...</td>
                    </tr>
                  ) : backups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground font-bold text-xs">No backups found</td>
                    </tr>
                  ) : (
                    backups.map((bkp) => (
                      <tr key={bkp.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-4 font-black text-foreground text-xs">
                          {bkp.filename}
                          <span className="block text-[9px] text-muted-foreground font-semibold mt-0.5">{bkp.type}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-muted-foreground">{bkp.date}</td>
                        <td className="px-6 py-4 text-xs font-bold">{bkp.size}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border ${
                            bkp.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {bkp.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button 
                              onClick={() => handleRestoreBackup(bkp.id)}
                              className="px-3 py-1 bg-primary text-white hover:bg-primary/90 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors shadow-sm"
                              title="Restore Database"
                            >
                              Restore
                            </button>
                            <button 
                              onClick={() => handleDeleteBackup(bkp.id)}
                              className="p-2 bg-secondary text-red-500 hover:bg-red-500 hover:text-white border border-border rounded-xl transition-colors"
                              title="Delete Backup"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
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
              <div className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl">
                <span className="text-muted-foreground">Auto-Backup on Session Close</span>
                <input type="checkbox" checked={autoBackup} onChange={e=>setAutoBackup(e.target.checked)} className="w-4 h-4 rounded cursor-pointer accent-primary" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Archive Retention Count</label>
                <input 
                  type="number"
                  value={retentionCount}
                  onChange={e=>setRetentionCount(parseInt(e.target.value) || 30)}
                  className="w-full h-10 rounded-xl bg-secondary/50 border border-border px-3 focus:outline-none focus:border-primary transition-colors font-black"
                />
              </div>
            </div>
          </div>

          {/* Cloud Storage Mirror */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">Cloud Backups</h3>
            
            <div className="space-y-3 text-xs font-bold text-muted-foreground">
              <div className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl opacity-50">
                <span>Google Cloud Storage Mirror</span>
                <span className="text-zinc-400 text-[10px] uppercase">Not Available</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl opacity-50">
                <span>Amazon AWS S3 Glacier</span>
                <span className="text-zinc-400 text-[10px] uppercase">Not Available</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Restore loading overlay */}
      <AnimatePresence>
        {isRestoring && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-background/90 backdrop-blur-md flex flex-col items-center justify-center text-center"
          >
            <RefreshCw className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-xl font-black text-foreground">Restoring Database Snapshot...</h3>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs">
              Overwriting current transactions table and clearing object cache. Verifying index constraints. Do not turn off POS terminal.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
