import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Printer as PrinterIcon, Building2, Save, Trash2, Plus, Server, Edit2, X, RefreshCw, Shield
} from "lucide-react"
import { useAuthStore, hasPermission } from "../store/authStore"
import { configApi } from "../api/configApi"
import { wipeOutHistory } from "../api/historyApi"
import type { BusinessProfile, FinanceConfig, Printer, OrderConfig } from "../api/configApi"


export default function Settings() {
  const { user: currentUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState("Business Profile")
  
  // States
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  // Form Data
  const [profileData, setProfileData] = useState<BusinessProfile>({
    restaurant_name: "",
    phone_number: "",
    address: "",
    trn: ""
  })

  const [financeData, setFinanceData] = useState<FinanceConfig>({
    service_charge_rate: "0",
    delivery_charge_rate: "0",
    tax_inclusive: "true",
    round_off: "true"
  })

  const [orderConfig, setOrderConfig] = useState<OrderConfig>({
    order_number_reset_daily: "true"
  })

  // Printers Data
  const [printers, setPrinters] = useState<Printer[]>([])
  
  // Printer Drawer State
  const [isPrinterDrawerOpen, setIsPrinterDrawerOpen] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null)
  const [printerFormData, setPrinterFormData] = useState<Omit<Printer, 'id'>>({
    name: "",
    type: "RECEIPT",
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
      
      if (data?.business?.profile) setProfileData(data.business.profile)
      if (data?.business?.finance) setFinanceData(data.business.finance)
      if (data?.business?.order) setOrderConfig(data.business.order)
      if (data?.printers) setPrinters(data.printers)
    } catch (e) {
      console.error("Failed to load config", e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      if (activeTab === "Business Profile") {
        await configApi.updateBusinessProfile(profileData)
      } else if (activeTab === "Finance & Charges") {
        await configApi.updateFinanceConfig(financeData)
      } else if (activeTab === "Data Management") {
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

  const openAddPrinter = () => {
    setEditingPrinter(null)
    setPrinterFormData({
      name: "",
      type: "RECEIPT",
      ipAddress: "",
      port: 9100,
      paperWidth: 80,
      isActive: true
    })
    setIsPrinterDrawerOpen(true)
  }

  const openEditPrinter = (p: Printer) => {
    setEditingPrinter(p)
    setPrinterFormData({
      name: p.name,
      type: p.type,
      ipAddress: p.ipAddress || "",
      port: p.port || 9100,
      paperWidth: p.paperWidth || 80,
      isActive: p.isActive !== false
    })
    setIsPrinterDrawerOpen(true)
  }

  const tabsList = [
    { name: "Business Profile", icon: Building2 },
    { name: "Finance & Charges", icon: Server },
    { name: "Printers", icon: PrinterIcon },
    { name: "Data Management", icon: Trash2 }
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
                {/* BUSINESS PROFILE */}
                {activeTab === "Business Profile" && (
                  <motion.div
                    key="business"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Restaurant Name</label>
                      <input 
                        type="text" 
                        value={profileData.restaurant_name || ""}
                        onChange={(e) => setProfileData({...profileData, restaurant_name: e.target.value})}
                        className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">TRN (Tax Number)</label>
                      <input 
                        type="text" 
                        value={profileData.trn || ""}
                        onChange={(e) => setProfileData({...profileData, trn: e.target.value})}
                        className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Phone Number</label>
                      <input 
                        type="text" 
                        value={profileData.phone_number || ""}
                        onChange={(e) => setProfileData({...profileData, phone_number: e.target.value})}
                        className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Address</label>
                      <input 
                        type="text" 
                        value={profileData.address || ""}
                        onChange={(e) => setProfileData({...profileData, address: e.target.value})}
                        className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </motion.div>
                )}

                {/* FINANCE & CHARGES */}
                {activeTab === "Finance & Charges" && (
                  <motion.div
                    key="finance"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Service Charge (%)</label>
                      <input 
                        type="number" 
                        value={financeData.service_charge_rate || "0"}
                        onChange={(e) => setFinanceData({...financeData, service_charge_rate: e.target.value})}
                        className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Delivery Charge (Flat Amount)</label>
                      <input 
                        type="number" 
                        value={financeData.delivery_charge_rate || "0"}
                        onChange={(e) => setFinanceData({...financeData, delivery_charge_rate: e.target.value})}
                        className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </motion.div>
                )}

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
                            <th className="px-6 py-3">IP Address</th>
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
                              <td className="px-6 py-4 font-mono text-muted-foreground">{p.ipAddress || 'USB'}</td>
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
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">IP Address (Optional for USB)</label>
                    <input 
                      type="text" 
                      value={printerFormData.ipAddress || ""}
                      onChange={(e) => setPrinterFormData({...printerFormData, ipAddress: e.target.value})}
                      className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors font-mono"
                      placeholder="192.168.1.100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Port</label>
                      <input 
                        type="number" 
                        value={printerFormData.port || 9100}
                        onChange={(e) => setPrinterFormData({...printerFormData, port: Number(e.target.value)})}
                        className="w-full h-11 px-4 bg-secondary border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
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
