import { useState, useEffect, useRef } from "react"
import { 
  RefreshCw, AlertTriangle, History, Trash2, Plus, MonitorSmartphone, Wifi, Database
} from "lucide-react"
import { syncApi, type SyncStatus, type ActiveDevice, type SyncQueueItem } from "../api/syncApi"
import toast from "react-hot-toast"
import { AnimatePresence, motion } from "framer-motion"

export default function Synchronization() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [autoSync, setAutoSync] = useState(true)
  const [syncInterval, setSyncInterval] = useState("30 Seconds")
  const [isLoading, setIsLoading] = useState(true)
  
  const searchInputRef = useRef<HTMLInputElement>(null)

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    let t = timeStr.trim();
    if (!t.endsWith('Z') && !t.includes('+')) {
       // Replace space with T just in case, then append Z
       t = t.replace(' ', 'T') + 'Z';
    }
    return new Date(t).toLocaleString();
  }

  const [networkQuality, setNetworkQuality] = useState<"Excellent" | "Good" | "Poor" | "Offline" | "N/A">("N/A")
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    const updateOnlineStatus = () => {
      if (navigator.onLine) {
        const connection = (navigator as any).connection;
        if (connection && connection.downlink) {
          setLatency(connection.rtt || null);
          if (connection.downlink >= 10) setNetworkQuality("Excellent");
          else if (connection.downlink >= 2) setNetworkQuality("Good");
          else setNetworkQuality("Poor");
        } else {
          setNetworkQuality("Excellent");
        }
      } else {
        setNetworkQuality("Offline");
      }
    }
    
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    }
  }, [])

  const [status, setStatus] = useState<SyncStatus>({ pending: 0, failed: 0, synced: 0, isRunning: false, currentPhase: 'IDLE', logs: [], nextRunDelay: 0 })
  const [devices, setDevices] = useState<ActiveDevice[]>([])
  const [lastError, setLastError] = useState<string | null>(null)

  const [syncHistory, setSyncHistory] = useState([])

  const [conflicts, setConflicts] = useState<any[]>([])
  const [failedQueue, setFailedQueue] = useState<SyncQueueItem[]>([])
  const [syncedQueue, setSyncedQueue] = useState<SyncQueueItem[]>([])

  const fetchSyncData = async () => {
    try {
      setIsLoading(true);
      const [statusData, devicesData, failedData, syncedData] = await Promise.all([
        syncApi.getStatus(),
        syncApi.getActiveDevices(),
        syncApi.getQueue('FAILED', 10000), // Show virtually all failed items
        syncApi.getQueue('SYNCED', 10)
      ]);
      setStatus(statusData);
      setDevices(devicesData);
      setFailedQueue(failedData);
      setSyncedQueue(syncedData);
    } catch (err) {
      toast.error("Failed to fetch sync status");
    } finally {
      setIsLoading(false);
    }
  }

  const fetchStatusOnly = async () => {
    try {
      const statusData = await syncApi.getStatus();
      setStatus(statusData);
    } catch (err) {
      // Ignore
    }
  }

  useEffect(() => {
    fetchSyncData();
    // Poll fast for live sequence
    const fastInterval = setInterval(fetchStatusOnly, 1500);
    // Poll queues and devices every 5 seconds
    const interval = setInterval(fetchSyncData, 5000);
    return () => {
      clearInterval(interval);
      clearInterval(fastInterval);
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault()
        handleAutoDetect()
      }
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault()
        triggerSync()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleAutoDetect = () => {
    fetchSyncData();
    toast.success("Refreshing device mesh...");
  }

  const triggerSync = async () => {
    if (isSyncing || networkQuality === "Offline") return
    setIsSyncing(true)
    const tId = toast.loading("Pushing offline data to cloud...")
    try {
      const res = await syncApi.triggerSync();
      setLastError(null);
      toast.success(`Sync successful: Pushed ${res.pushed || 0}, Pulled ${res.pulled || 0}`, { id: tId });
      fetchSyncData();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || "Cloud sync failed";
      setLastError(errMsg);
      toast.error(`Sync failed: ${errMsg}`, { id: tId });
    } finally {
      setIsSyncing(false)
    }
  }

  const handleResolveConflict = (conflictId: string, resolution: "local" | "cloud" | "merge") => {
    setConflicts(conflicts.filter(c => c.id !== conflictId))
    toast.success(`Conflict resolved using "${resolution}" strategy.`);
  }

  const handleRetryEvent = async (id: string) => {
    try {
      await syncApi.retryEvent(id);
      toast.success("Event queued for retry!");
      fetchSyncData();
    } catch (err: any) {
      toast.error("Failed to retry event");
    }
  }

  const handleRetryAll = async () => {
    try {
      await syncApi.retryAll();
      toast.success("All failed events queued for retry!");
      fetchSyncData();
    } catch (err: any) {
      toast.error("Failed to retry all events");
    }
  }

  const handleClearQueue = async () => {
    if (window.confirm("Are you ABSOLUTELY SURE you want to completely wipe the sync history? This will delete ALL PENDING, FAILED, and SYNCED uploads. Use this to completely reset the sync state for a fresh start!")) {
      try {
        await syncApi.clearQueue();
        toast.success("Sync history cleared completely!");
        fetchSyncData();
      } catch (err: any) {
        toast.error("Failed to clear sync history");
      }
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12 animate-in fade-in zoom-in-95 duration-500">
      
      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Synchronization Command Center
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Offline-First</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Manage multi-terminal LAN database mesh, offline caching queue, and secure Cloud backup syncing.
          </p>
          {status.deviceId && (
            <p className="text-[10px] text-zinc-500 font-mono mt-2">
              Terminal ID: {status.deviceId}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap relative z-10">
          <button 
            onClick={handleClearQueue}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-black hover:bg-red-600 shadow-md shadow-red-500/20 transition-all active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            Wipe Sync Queue
          </button>
          <button 
            onClick={triggerSync}
            disabled={isSyncing || networkQuality === "Offline"}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/20 disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? "Syncing data..." : "Sync Now [Ctrl+S]"}
          </button>
        </div>
      </div>



      {/* ====================================================
          LIVE ACTIVITY FEED
          ==================================================== */}
      <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wider text-foreground flex items-center gap-2">
            Live Sync Activity
            {status.currentPhase !== 'IDLE' && status.currentPhase !== 'ERROR' && (
              <span className="flex h-3 w-3 relative ml-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
            )}
          </h3>
          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${
            status.currentPhase === 'PUSHING' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
            status.currentPhase === 'PULLING' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
            status.currentPhase === 'ERROR' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
            'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
          }`}>
            {status.currentPhase}
          </span>
        </div>
        
        <div className="bg-secondary/30 border border-border rounded-xl p-4 font-mono text-[11px] h-[200px] overflow-y-auto flex flex-col gap-1 custom-scrollbar">
          {status.logs && status.logs.length > 0 ? (
            status.logs.map((log, idx) => (
              <div key={idx} className={`flex gap-3 py-1 border-b border-border/40 last:border-0 ${idx === 0 ? 'opacity-100 font-bold' : 'opacity-60'}`}>
                <span className="text-muted-foreground shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`break-all ${log.level === 'error' ? 'text-red-500' : 'text-foreground'}`}>
                  {log.message}
                </span>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground opacity-50 flex items-center justify-center h-full">Waiting for background worker...</div>
          )}
        </div>
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
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Internet", val: networkQuality, sub: latency ? `Latency: ${latency} ms` : "Status: Active", color: networkQuality === "Offline" ? "text-red-500" : (networkQuality === "N/A" ? "text-zinc-500" : "text-emerald-500"), icon: Wifi },
                { label: "Cloud Sync Gateway", val: status.isRunning ? "Syncing..." : "Idle", sub: "Cloud DB Mirror Active", color: "text-emerald-500", icon: Database },
                { label: "Pending Upload Queue", val: `${status.pending} Items`, sub: `${status.failed} failed items`, color: status.pending > 0 ? "text-amber-500" : "text-emerald-500", icon: History },
                { label: "Auto Sync Status", val: autoSync ? `Every ${syncInterval}` : "Disabled", sub: "Periodic sync task", color: autoSync ? "text-emerald-500" : "text-zinc-500", icon: RefreshCw }
              ].map((card, i) => (
                <div key={i} className="p-4 bg-card border border-border/50 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group">
                  <div className="absolute right-[-15px] top-[-15px] opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <card.icon className="w-20 h-20" />
                  </div>
                  <div className="relative z-10">
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{card.label}</span>
                    <h4 className="text-base font-black mt-2 text-foreground">{card.val}</h4>
                    <span className={`text-[8px] font-bold mt-2 block ${card.color}`}>{card.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Pending Uploads", val: status.pending, color: "text-orange-500" },
                { label: "Failed Uploads", val: status.failed, color: "text-red-500" },
                { label: "Successfully Synced", val: status.synced, color: "text-emerald-500" },
                { label: "Next Retry Delay", val: `${status.nextRunDelay / 1000}s`, color: "text-blue-500" }
              ].map((item, idx) => (
                <div key={idx} className="p-4 bg-secondary/40 border border-border rounded-xl text-center">
                  <span className="text-[9px] text-muted-foreground uppercase font-black">{item.label}</span>
                  <p className={`text-2xl font-black mt-2 ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>

            {lastError && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in fade-in zoom-in-95">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-black text-red-500">Last Sync Error</h4>
                  <p className="text-xs font-semibold text-red-500/80 mt-1">{lastError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Conflict Resolution Block */}
          <AnimatePresence>
            {conflicts.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-6 bg-amber-500/10 border border-amber-500/25 rounded-[2.5rem] shadow-sm space-y-4"
              >
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
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Right Side: Connected Devices list & sync controls */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          
          {/* Sync actions & Interval configs */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">Sync Preferences</h3>
            
            <div className="space-y-4 text-xs font-bold">
              <div className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl">
                <span className="text-muted-foreground">Enable Periodic Auto-Sync</span>
                <input type="checkbox" checked={autoSync} onChange={e=>setAutoSync(e.target.checked)} className="w-4 h-4 rounded cursor-pointer accent-primary" />
              </div>

              {autoSync && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Sync Interval</label>
                  <select 
                    value={syncInterval}
                    onChange={e=>setSyncInterval(e.target.value)}
                    className="w-full h-10 rounded-xl bg-secondary/50 border border-border px-3 focus:outline-none focus:border-primary transition-colors font-black"
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
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black uppercase tracking-wider text-foreground">Live Active Devices</h3>
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-1 bg-primary/10 text-primary rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> {devices.length} Online
              </span>
            </div>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {devices.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs font-bold">
                  <MonitorSmartphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No devices connected right now.
                </div>
              ) : (
                devices.map(dev => {
                  const isOnline = (Date.now() - dev.lastSeen) < 10000; // 10 seconds ago = online
                  return (
                  <div key={dev.id} className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl hover:border-primary/50 transition-colors">
                    <div>
                      <span className="font-black text-xs text-foreground flex items-center gap-1.5">
                        <MonitorSmartphone className="w-3.5 h-3.5 text-muted-foreground" /> {dev.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground block mt-1 font-semibold">IP: {dev.ip} • ID: {dev.id}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isOnline
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                          : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      }`}>
                        {isOnline ? 'Online' : 'Away'}
                      </span>
                    </div>
                  </div>
                  )
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ====================================================
          SYNC QUEUE VISUALIZATION
          ==================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Failed Uploads */}
        <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4 flex flex-col">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-black uppercase tracking-wider text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Failed Uploads
            </h3>
            {failedQueue.length > 0 && (
              <button 
                onClick={handleRetryAll}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] uppercase font-black rounded-lg transition-colors border border-red-500/20 shadow-sm flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Retry All
              </button>
            )}
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {failedQueue.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs font-bold">
                No failed uploads.
              </div>
            ) : (
              failedQueue.map(item => (
                <div key={item.id} className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="font-black text-xs text-red-500 uppercase">{item.entity_type} • {item.action}</span>
                    <button 
                      onClick={() => handleRetryEvent(item.id)}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-[10px] uppercase font-black rounded-lg transition-colors shadow-sm"
                    >
                      Retry Now
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground break-all">ID: {item.entity_id}</p>
                  <p className="text-[11px] font-semibold text-red-500/80 mt-1">{item.error_details || "Unknown error"}</p>
                  <p className="text-[9px] text-zinc-500 mt-1">Failed on {formatTime(item.updated_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Synced Uploads */}
        <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4 flex flex-col">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-black uppercase tracking-wider text-emerald-500 flex items-center gap-2">
              <History className="w-5 h-5" /> Recent Synced Uploads
            </h3>

          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {syncedQueue.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs font-bold">
                No recent sync history.
              </div>
            ) : (
              syncedQueue.map(item => (
                <div key={item.id} className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <span className="font-black text-xs text-emerald-500 uppercase">{item.entity_type} • {item.action}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground break-all">ID: {item.entity_id}</p>
                  <p className="text-[9px] text-zinc-500 mt-1">Synced on {formatTime(item.updated_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
