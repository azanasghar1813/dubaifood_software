import { useState, useEffect } from "react"
import { Server, Save, MonitorSmartphone, WifiOff, AlertTriangle } from "lucide-react"
import { configApi, type SyncConfig } from "../api/configApi"
import { lanApi, type LanStatus } from "../api/lanApi"
import { toast } from "../store/toastStore"

export default function LanSync() {
  const [status, setStatus] = useState<LanStatus | null>(null)
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    device_role: "HUB",
    hub_ip: "",
    hub_port: 5000,
    hub_timeout_ms: 400,
    lease_block_size: 500,
    lease_low_water_mark: 20,
    lease_refill_batch: 200
  })
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [networkError, setNetworkError] = useState(false)

  const fetchSettingsConfig = async () => {
    try {
      const res: any = await configApi.getAllConfig()
      const data = res?.data?.data || res?.data || res
      if (data?.application?.sync) setSyncConfig(data.application.sync)
    } catch (e) {
      console.error("Failed to load sync config", e)
    }
  }

  const handleSaveSyncConfig = async () => {
    setIsSavingConfig(true)
    try {
      await configApi.updateSyncConfig(syncConfig)
      toast.success("LAN Sync settings saved successfully")
    } catch (e) {
      toast.error("Failed to save LAN Sync settings")
    } finally {
      setIsSavingConfig(false)
    }
  }

  const fetchStatus = async () => {
    try {
      const st = await lanApi.getStatus()
      setStatus(st)
      setNetworkError(false)
    } catch (e) {
      setNetworkError(true)
    }
  }

  useEffect(() => {
    fetchSettingsConfig()
    fetchStatus()
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12 animate-in fade-in zoom-in-95 duration-500">
      
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            LAN Sync Management
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Local Network</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Manage multi-terminal LAN database mesh and offline caching queue for the local hub.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Settings Panel */}
        <div className="xl:col-span-8 bg-card border border-border rounded-3xl shadow-sm p-6 space-y-6 flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" /> LAN Connection
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Configure this device's role on the local network.</p>
            </div>
            <button 
              onClick={handleSaveSyncConfig}
              disabled={isSavingConfig}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-black shadow-md shadow-primary/20 hover:bg-primary/95 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSavingConfig ? "Saving..." : "Save Settings"}
            </button>
          </div>

          <div className="bg-secondary/30 p-6 rounded-2xl border border-border flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Device Role</label>
                <select 
                  value={syncConfig.device_role || "HUB"}
                  onChange={(e) => setSyncConfig({...syncConfig, device_role: e.target.value})}
                  className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  <option value="HUB">HUB (Main Server)</option>
                  <option value="TERMINAL">TERMINAL (Client Device)</option>
                </select>
              </div>
              
              {syncConfig.device_role === "TERMINAL" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Hub IP Address</label>
                    <input 
                      type="text"
                      value={syncConfig.hub_ip || ""}
                      onChange={(e) => setSyncConfig({...syncConfig, hub_ip: e.target.value})}
                      className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors font-mono"
                      placeholder="e.g. 192.168.1.100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Hub Port</label>
                    <input 
                      type="number"
                      value={syncConfig.hub_port || 5000}
                      onChange={(e) => setSyncConfig({...syncConfig, hub_port: Number(e.target.value)})}
                      className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                    <div className="pt-6">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(`http://${syncConfig.hub_ip}:${syncConfig.hub_port || 5000}/api/v1/health`);
                            if (res.ok) toast.success("Connection to Hub successful!");
                            else toast.error("Connected to Hub, but received error: " + res.status);
                          } catch (e: any) {
                            toast.error("Failed to connect to Hub: " + e.message);
                          }
                        }}
                        className="h-11 px-6 bg-primary text-primary-foreground font-black rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
                      >
                        Test Connection
                      </button>
                    </div>
                  </div>
                </>
              )}
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Hub Timeout (ms)</label>
                <input 
                  type="number"
                  value={syncConfig.hub_timeout_ms || 400}
                  onChange={(e) => setSyncConfig({...syncConfig, hub_timeout_ms: Number(e.target.value)})}
                  className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                  placeholder="400"
                />
              </div>
            </div>
            
            {syncConfig.device_role === "TERMINAL" && (
              <div className="pt-6 mt-6 border-t border-border">
                <h4 className="text-sm font-bold mb-4">Lease Settings</h4>
                
                {(syncConfig.lease_low_water_mark || 20) >= (syncConfig.lease_block_size || 500) && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-bold">
                    Warning: Low Water Mark should be less than Block Size.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Block Size</label>
                    <input 
                      type="number"
                      value={syncConfig.lease_block_size || 500}
                      onChange={(e) => setSyncConfig({...syncConfig, lease_block_size: Number(e.target.value)})}
                      className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                    <p className="text-xs text-muted-foreground ml-1">Tickets per lease</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Low Water Mark</label>
                    <input 
                      type="number"
                      value={syncConfig.lease_low_water_mark || 20}
                      onChange={(e) => setSyncConfig({...syncConfig, lease_low_water_mark: Number(e.target.value)})}
                      className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                    <p className="text-xs text-muted-foreground ml-1">Trigger refill when below</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Refill Batch</label>
                    <input 
                      type="number"
                      value={syncConfig.lease_refill_batch || 200}
                      onChange={(e) => setSyncConfig({...syncConfig, lease_refill_batch: Number(e.target.value)})}
                      className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                    <p className="text-xs text-muted-foreground ml-1">Amount to refill</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Diagnostics & Feed */}
        <div className="xl:col-span-4 space-y-6">
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black uppercase tracking-wider text-foreground">Queue Diagnostics</h3>
              <button
                onClick={async () => {
                  try {
                    await lanApi.syncMasterData();
                    toast.success("Master Data Sync triggered");
                  } catch (e: any) {
                    toast.error("Failed to trigger sync: " + e.message);
                  }
                }}
                className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-xs font-black hover:bg-primary/30 transition-colors"
              >
                Sync Now
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/40 border border-border rounded-xl text-center">
                <span className="text-[9px] text-muted-foreground uppercase font-black">Pending Orders</span>
                <p className={`text-3xl font-black mt-2 ${status?.pendingOrders ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {status?.pendingOrders || 0}
                </p>
              </div>
              <div className="p-4 bg-secondary/40 border border-border rounded-xl text-center">
                <span className="text-[9px] text-muted-foreground uppercase font-black">Pending Prints</span>
                <p className={`text-3xl font-black mt-2 ${status?.pendingPrints ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {status?.pendingPrints || 0}
                </p>
              </div>
            </div>
            {networkError && (
              <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-3 rounded-xl text-xs font-bold">
                <WifiOff className="w-4 h-4" /> Cannot connect to local backend API.
              </div>
            )}
            {status?.isRetrying && (
              <div className="flex items-center gap-2 text-blue-500 bg-blue-500/10 p-3 rounded-xl text-xs font-bold">
                <MonitorSmartphone className="w-4 h-4 animate-pulse" /> Background retry worker is active...
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Full width Live Activity Feed */}
      <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
        <h3 className="text-base font-black uppercase tracking-wider text-foreground flex items-center gap-2">
          Live LAN Activity Feed
          <span className="flex h-3 w-3 relative ml-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
        </h3>
        <div className="bg-[#1e1e1e] border border-border/10 rounded-xl p-4 font-mono text-[11px] h-[300px] overflow-y-auto flex flex-col gap-1 custom-scrollbar shadow-inner">
          {status?.logs && status.logs.length > 0 ? (
            status.logs.map((log, idx) => {
              const dateObj = new Date(log.timestamp);
              const timeStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleTimeString();
              return (
                <div key={idx} className={`flex gap-3 py-1 border-b border-white/5 last:border-0 ${idx === 0 ? 'opacity-100 font-bold' : 'opacity-80'}`}>
                  <span className="text-[#858585] shrink-0">{timeStr}</span>
                  <span className={`break-all ${log.level === 'error' ? 'text-[#f14c4c]' : log.level === 'warn' ? 'text-[#cca700]' : 'text-[#cccccc]'}`}>
                    {log.message}
                  </span>
                </div>
              )
            })
          ) : (
            <div className="text-[#858585] flex items-center justify-center h-full">Waiting for LAN network activity...</div>
          )}
        </div>
      </div>

    </div>
  )
}
