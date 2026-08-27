import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Printer as PrinterIcon, Building2, Save, Trash2, Plus, Server, Edit2, X, RefreshCw, Shield, Download, ArrowDownCircle, CheckCircle, AlertCircle, Loader2
} from "lucide-react"
import { useAuthStore, hasPermission } from "../store/authStore"
import { configApi } from "../api/configApi"
import { wipeOutHistory } from "../api/historyApi"
import type { BusinessProfile, FinanceConfig, Printer, OrderConfig } from "../api/configApi"


export default function Settings() {
  const { user: currentUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState("Printers")
  
  // States
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  // Update State
  const [appVersion, setAppVersion] = useState("")
  const [updateStatus, setUpdateStatus] = useState("idle")
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [downloadProgress, setDownloadProgress] = useState<any>(null)
  const [updateError, setUpdateError] = useState("")

  // Form Data
  const [orderConfig, setOrderConfig] = useState<OrderConfig>({
    order_number_reset_daily: "true"
  })

  // Printers Data
  const [printers, setPrinters] = useState<Printer[]>([])
  const [discoveredPrinters, setDiscoveredPrinters] = useState<any[]>([])
  
  // Printer Drawer State
  const [isPrinterDrawerOpen, setIsPrinterDrawerOpen] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null)
  const [printerFormData, setPrinterFormData] = useState<Omit<Printer, 'id'>>({
    name: "",
    type: "RECEIPT",
    driver_type: "ESCPOS_LAN",
    connection_string: "",
    ipAddress: "",
    port: 9100,
    paperWidth: 80,
    isActive: true
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setIsLoading(true)
    try {
      const res = await configApi.getAllConfig()
      if (!res?.data?.data) return
      const data = res.data.data
      
      if (data?.business?.order) setOrderConfig(data.business.order)
      if (data?.printers) setPrinters(data.printers)
    } catch (e) {
      console.error("Failed to load config", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const w = window as any;
    if (w.require) {
      const { ipcRenderer } = w.require('electron');
      ipcRenderer.invoke('get-app-version').then(setAppVersion);

      const handleAvailable = (_: any, info: any) => { setUpdateStatus("available"); setUpdateInfo(info); };
      const handleNotAvailable = () => setUpdateStatus("idle");
      const handleError = (_: any, err: any) => { setUpdateStatus("error"); setUpdateError(err); };
      const handleProgress = (_: any, progressObj: any) => { setUpdateStatus("downloading"); setDownloadProgress(progressObj); };
      const handleDownloaded = () => setUpdateStatus("downloaded");

      ipcRenderer.on('update-available', handleAvailable);
      ipcRenderer.on('update-not-available', handleNotAvailable);
      ipcRenderer.on('update-error', handleError);
      ipcRenderer.on('download-progress', handleProgress);
      ipcRenderer.on('update-downloaded', handleDownloaded);

      return () => {
        ipcRenderer.removeListener('update-available', handleAvailable);
        ipcRenderer.removeListener('update-not-available', handleNotAvailable);
        ipcRenderer.removeListener('update-error', handleError);
        ipcRenderer.removeListener('download-progress', handleProgress);
        ipcRenderer.removeListener('update-downloaded', handleDownloaded);
      };
    }
  }, []);

  const checkForUpdates = async () => {
    const w = window as any;
    if (w.require) {
      setUpdateStatus("checking");
      setUpdateError("");
      const res = await w.require('electron').ipcRenderer.invoke('check-for-updates');
      if (res?.error) {
        setUpdateStatus("error");
        setUpdateError(res.error);
      }
    }
  };

  const startDownload = async () => {
    const w = window as any;
    if (w.require) {
      setUpdateStatus("downloading");
      setUpdateError("");
      const res = await w.require('electron').ipcRenderer.invoke('download-update');
      if (res?.error) {
        setUpdateStatus("error");
        setUpdateError(res.error);
      }
    }
  };

  const cancelDownload = async () => {
    const w = window as any;
    if (w.require) {
      await w.require('electron').ipcRenderer.invoke('cancel-update');
      setUpdateStatus("idle");
      setDownloadProgress(null);
    }
  };

  const installUpdate = async () => {
    const w = window as any;
    if (w.require) {
      await w.require('electron').ipcRenderer.invoke('install-update');
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      if (activeTab === "Data Management") {
        await configApi.updateOrderConfig(orderConfig)
      }
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (e) {
      console.error("Failed to save", e)
      alert("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrinterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      if (editingPrinter) {
        await configApi.updatePrinter(editingPrinter.id, printerFormData)
      } else {
        await configApi.createPrinter(printerFormData)
      }
      setIsPrinterDrawerOpen(false)
      fetchConfig() // Reload printers
    } catch (e) {
      console.error("Failed to save printer", e)
      alert("Failed to save printer")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePrinter = async (id: string) => {
    if (!confirm("Are you sure you want to delete this printer?")) return
    try {
      await configApi.deletePrinter(id)
      fetchConfig()
    } catch (e) {
      console.error("Failed to delete printer", e)
      alert("Failed to delete printer")
    }
  }

  const openAddPrinter = async () => {
    setEditingPrinter(null)
    setPrinterFormData({
      name: "",
      type: "RECEIPT",
      driver_type: "ESCPOS_LAN",
      connection_string: "",
      ipAddress: "",
      port: 9100,
      paperWidth: 80,
      isActive: true
    })
    setIsPrinterDrawerOpen(true)
    try {
      const res = await configApi.discoverPrinters()
      setDiscoveredPrinters(res.data?.data || [])
    } catch (e) { console.error(e) }
  }

  const openEditPrinter = async (p: Printer) => {
    setEditingPrinter(p)
    setPrinterFormData({
      name: p.name,
      type: p.type,
      driver_type: p.driver_type || "ESCPOS_LAN",
      connection_string: p.connection_string || "",
      ipAddress: p.ipAddress || "",
      port: p.port || 9100,
      paperWidth: p.paperWidth || 80,
      isActive: p.isActive !== false
    })
    setIsPrinterDrawerOpen(true)
    try {
      const res = await configApi.discoverPrinters()
      setDiscoveredPrinters(res.data?.data || [])
    } catch (e) { console.error(e) }
  }

  const tabsList = [
    { name: "Printers", icon: PrinterIcon },
    { name: "Data Management", icon: Trash2 },
    { name: "Software Update", icon: Download }
  ]

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[calc(100vh-100px)]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!hasPermission('VIEW_SETTINGS') && currentUser?.role !== 'Admin' && currentUser?.role !== 'Super Admin') {
    return (
      <div className="h-full flex items-center justify-center min-h-[calc(100vh-100px)]">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-slate-500">You do not have permission to view Settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            System Settings
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Configuration</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Manage your business profile, service charges, and printer configurations.
          </p>
        </div>

        {activeTab !== "Printers" && (
          <button 
            onClick={handleSaveBusiness}
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all shadow-md shadow-primary/20 active:scale-[0.98] ${
              isSaved ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-primary text-primary-foreground hover:bg-primary/95'
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaved ? "Saved Successfully" : isSaving ? "Saving..." : "Save Settings"}
          </button>
        )}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Sidebar Nav */}
        <div className="md:col-span-3 space-y-2">
          {tabsList.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                activeTab === tab.name
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.name ? 'text-primary-foreground' : 'text-primary'}`} />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-9">
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
            <h2 className="text-xl font-black mb-6">{activeTab}</h2>

            <form onSubmit={handleSaveBusiness} className="space-y-6">
              <AnimatePresence mode="wait">
                
                {/* DATA MANAGEMENT */}
                {activeTab === "Data Management" && (
                  <motion.div
                    key="data-management"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div className="bg-secondary/30 p-6 rounded-2xl border border-border space-y-4">
                      <div>
                        <h3 className="text-base font-black">Order Number Management</h3>
                        <p className="text-sm text-muted-foreground mt-1">Configure how order numbers are generated and reset.</p>
                      </div>
                      
                      <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
                        <input 
                          type="checkbox" 
                          id="resetDaily"
                          checked={String(orderConfig.order_number_reset_daily).toLowerCase() === 'true' || String(orderConfig.order_number_reset_daily) === '1'}
                          onChange={(e) => setOrderConfig({...orderConfig, order_number_reset_daily: e.target.checked ? "true" : "false"})}
                          className="w-5 h-5 rounded border-border text-primary focus:ring-primary bg-background cursor-pointer"
                        />
                        <div>
                          <label htmlFor="resetDaily" className="text-sm font-bold cursor-pointer">Reset Order Number Daily</label>
                          <p className="text-xs text-muted-foreground">If enabled, order numbers will restart from 1 at the beginning of each business day (6 AM).</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-500/10 p-6 rounded-2xl border border-red-500/20 space-y-4">
                      <div>
                        <h3 className="text-base font-black text-red-500 flex items-center gap-2"><Trash2 className="w-5 h-5"/> Wipe Out History</h3>
                        <p className="text-sm text-red-500/80 mt-1">Permanently delete all order history and related data. This action is irreversible.</p>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input 
                          type="password"
                          id="wipePin"
                          placeholder="Enter Owner PIN to authorize"
                          className="w-full sm:w-64 h-11 px-4 bg-background border border-red-500/20 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 transition-colors placeholder:text-red-500/40"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const pinInput = document.getElementById('wipePin') as HTMLInputElement
                            const pin = pinInput.value
                            if (!pin) {
                              alert("Please enter the Owner PIN.")
                              return
                            }
                            if (!confirm("Are you ABSOLUTELY SURE you want to wipe out all order history? This cannot be undone.")) return
                            try {
                              setIsSaving(true)
                              const res = await wipeOutHistory(pin)
                              alert(res.message || "History wiped out successfully.")
                              pinInput.value = ""
                            } catch (e: any) {
                              alert(e.response?.data?.message || "Failed to wipe history.")
                            } finally {
                              setIsSaving(false)
                            }
                          }}
                          className="w-full sm:w-auto h-11 px-6 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all shadow-md shadow-red-500/20"
                        >
                          Wipe Out History
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* PRINTERS */}
                {activeTab === "Printers" && (
                  <motion.div
                    key="printers"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="flex justify-end mb-4">
                      <button 
                        type="button"
                        onClick={openAddPrinter}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-black shadow-md shadow-primary/20 hover:bg-primary/95 transition-all"
                      >
                        <Plus className="w-4 h-4" /> Add Printer
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border bg-card">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase font-bold">
                          <tr>
                            <th className="px-6 py-3">Printer Name</th>
                            <th className="px-6 py-3">Type</th>
                            <th className="px-6 py-3">Connection</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {printers.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground font-bold">
                                No printers configured.
                              </td>
                            </tr>
                          ) : printers.map(p => (
                            <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                              <td className="px-6 py-4 font-black">{p.name}</td>
                              <td className="px-6 py-4 font-semibold text-muted-foreground">{p.type}</td>
                              <td className="px-6 py-4 font-mono text-muted-foreground text-xs">
                                <div className="flex flex-col">
                                  <span className="font-bold text-foreground">
                                    {p.driver_type === 'ESCPOS_LAN' ? 'LAN / Wi-Fi' :
                                     p.driver_type === 'ESCPOS_BT' ? 'Bluetooth' :
                                     p.driver_type === 'ESCPOS_USB' ? 'USB' : 'Virtual'}
                                  </span>
                                  <span>{p.connection_string || p.ipAddress || 'N/A'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  p.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                }`}>
                                  {p.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button type="button" onClick={() => openEditPrinter(p)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => handleDeletePrinter(p.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* SOFTWARE UPDATE */}
                {activeTab === "Software Update" && (
                  <motion.div
                    key="software-update"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div className="bg-secondary/30 p-6 rounded-2xl border border-border space-y-4">
                      <div>
                        <h3 className="text-base font-black flex items-center gap-2">
                          <Download className="w-5 h-5 text-primary" /> Application Update
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Current Version: <span className="font-bold font-mono bg-background px-2 py-1 rounded-md border border-border ml-1">{appVersion || "Unknown"}</span>
                        </p>
                      </div>

                      {updateStatus === "idle" && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={checkForUpdates}
                            className="px-6 py-2.5 bg-primary text-primary-foreground font-black rounded-xl hover:bg-primary/95 transition-all shadow-md shadow-primary/20"
                          >
                            Check for Updates
                          </button>
                        </div>
                      )}

                      {updateStatus === "checking" && (
                        <div className="flex items-center gap-3 pt-2 text-primary font-bold">
                          <Loader2 className="w-5 h-5 animate-spin" /> Checking for updates...
                        </div>
                      )}

                      {updateStatus === "error" && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
                          <div className="flex items-center gap-2 text-red-500 font-bold">
                            <AlertCircle className="w-5 h-5" /> Update Error
                          </div>
                          <p className="text-sm text-red-500/80">{updateError}</p>
                          <button
                            type="button"
                            onClick={checkForUpdates}
                            className="px-4 py-2 bg-background border border-border text-foreground font-bold rounded-xl hover:bg-secondary transition-all text-sm"
                          >
                            Try Again
                          </button>
                        </div>
                      )}

                      {updateStatus === "available" && updateInfo && (
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-3">
                          <div className="flex items-center gap-2 text-blue-500 font-bold">
                            <ArrowDownCircle className="w-5 h-5" /> New Update Available!
                          </div>
                          <p className="text-sm text-blue-500/80">Version {updateInfo.version} is ready to be downloaded.</p>
                          <button
                            type="button"
                            onClick={startDownload}
                            className="px-6 py-2.5 bg-blue-500 text-white font-black rounded-xl hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20"
                          >
                            Update Now
                          </button>
                        </div>
                      )}

                      {updateStatus === "downloading" && downloadProgress && (
                        <div className="p-4 bg-secondary/50 border border-border rounded-xl space-y-4">
                          <div className="flex justify-between items-center text-sm font-bold">
                            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /> Downloading Update...</span>
                            <span>{Math.round(downloadProgress.percent || 0)}%</span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full bg-background rounded-full h-2.5 border border-border overflow-hidden">
                            <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${downloadProgress.percent}%` }}></div>
                          </div>
                          
                          <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
                            <span>
                              {((downloadProgress.transferred || 0) / 1048576).toFixed(2)} MB of {((downloadProgress.total || 0) / 1048576).toFixed(2)} MB
                            </span>
                            <span>{((downloadProgress.bytesPerSecond || 0) / 1048576).toFixed(2)} MB/s</span>
                          </div>

                          <button
                            type="button"
                            onClick={cancelDownload}
                            className="mt-2 px-4 py-2 bg-background border border-border text-foreground font-bold rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all text-sm"
                          >
                            Cancel Download
                          </button>
                        </div>
                      )}

                      {updateStatus === "downloaded" && (
                        <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-4">
                          <div className="flex items-center gap-2 text-emerald-500 font-bold text-lg">
                            <CheckCircle className="w-6 h-6" /> Update downloaded successfully.
                          </div>
                          <p className="text-sm text-emerald-500/80">
                            The software must be restarted to apply the update. Your current order and sync queue will be safely saved.
                          </p>
                          <button
                            type="button"
                            onClick={installUpdate}
                            className="px-6 py-3 bg-emerald-500 text-white font-black rounded-xl hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
                          >
                            <RefreshCw className="w-5 h-5" /> Restart & Install
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>
        </div>
      </div>

      {/* Printer Drawer */}
      <AnimatePresence>
        {isPrinterDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPrinterDrawerOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-secondary/30">
                <h2 className="text-lg font-black">{editingPrinter ? 'Edit Printer' : 'Add New Printer'}</h2>
                <button onClick={() => setIsPrinterDrawerOpen(false)} className="p-2 rounded-full hover:bg-secondary text-muted-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <form id="printerForm" onSubmit={handlePrinterSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Printer Name</label>
                    <input 
                      required
                      type="text" 
                      value={printerFormData.name}
                      onChange={(e) => setPrinterFormData({...printerFormData, name: e.target.value})}
                      className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                      placeholder="e.g. Main Kitchen Printer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Printer Type</label>
                    <select 
                      value={printerFormData.type}
                      onChange={(e) => setPrinterFormData({...printerFormData, type: e.target.value})}
                      className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors appearance-none"
                    >
                      <option value="RECEIPT">Receipt Printer</option>
                      <option value="KITCHEN">Kitchen Printer</option>
                      <option value="BAR">Bar Printer</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Connection Type</label>
                    <select 
                      value={printerFormData.driver_type || 'ESCPOS_LAN'}
                      onChange={(e) => setPrinterFormData({...printerFormData, driver_type: e.target.value as any})}
                      className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors appearance-none"
                    >
                      <option value="ESCPOS_LAN">LAN / Wi-Fi</option>
                      <option value="ESCPOS_BT">Bluetooth / Serial</option>
                      <option value="ESCPOS_USB">USB / Windows Spooler</option>
                      <option value="VIRTUAL">Virtual (Testing)</option>
                    </select>
                  </div>

                  {printerFormData.driver_type !== 'VIRTUAL' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                        {printerFormData.driver_type === 'ESCPOS_LAN' && 'IP Address'}
                        {printerFormData.driver_type === 'ESCPOS_BT' && 'Bluetooth / COM Port'}
                        {printerFormData.driver_type === 'ESCPOS_USB' && 'Windows Printer'}
                      </label>
                      {printerFormData.driver_type === 'ESCPOS_LAN' ? (
                        <input 
                          type="text" 
                          value={printerFormData.connection_string || printerFormData.ipAddress || ""}
                          onChange={(e) => setPrinterFormData({...printerFormData, connection_string: e.target.value, ipAddress: e.target.value})}
                          className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors font-mono"
                          placeholder="192.168.1.100"
                        />
                      ) : (
                        <select
                          value={printerFormData.connection_string || ""}
                          onChange={(e) => setPrinterFormData({...printerFormData, connection_string: e.target.value})}
                          className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors appearance-none font-mono"
                        >
                          <option value="">-- Select Detected Printer --</option>
                          {discoveredPrinters.filter(dp => dp.type === printerFormData.driver_type).map(dp => (
                            <option key={dp.port} value={dp.port}>
                              {dp.name} ({dp.description})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {printerFormData.driver_type === 'ESCPOS_LAN' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Port</label>
                        <input 
                          type="number" 
                          value={printerFormData.port || 9100}
                          onChange={(e) => setPrinterFormData({...printerFormData, port: Number(e.target.value)})}
                          className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Paper Width</label>
                      <select 
                        value={printerFormData.paperWidth || 80}
                        onChange={(e) => setPrinterFormData({...printerFormData, paperWidth: Number(e.target.value)})}
                        className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors appearance-none"
                      >
                        <option value={80}>80mm</option>
                        <option value={58}>58mm</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl border border-border">
                    <input 
                      type="checkbox" 
                      id="isActive"
                      checked={printerFormData.isActive}
                      onChange={(e) => setPrinterFormData({...printerFormData, isActive: e.target.checked})}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background"
                    />
                    <label htmlFor="isActive" className="text-sm font-bold cursor-pointer">Printer is Active</label>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-border bg-secondary/10 flex gap-3">
                <button 
                  onClick={() => setIsPrinterDrawerOpen(false)}
                  className="flex-1 h-12 bg-secondary text-foreground font-bold rounded-xl hover:bg-border transition-colors border border-border"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="printerForm"
                  disabled={isSaving}
                  className="flex-1 h-12 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition-all shadow-md shadow-primary/20 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Printer'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
