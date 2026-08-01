import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Building2, Receipt, Palette, Cloud, Printer, Keyboard, Save, 
  CheckCircle2, Server,
  Clock, DollarSign, Table, Plus, Trash2,
  Settings as SettingsIcon, AlertTriangle, Key,
  Calendar, Layers, Moon, Sun, Smartphone, Wifi, Bell, CreditCard
} from "lucide-react"
import { useSettingsStore } from "../store/settingsStore"

export default function Settings() {
  const settingsStore = useSettingsStore()
  
  const [activeTab, setActiveTab] = useState("Business Information")
  const [isSaved, setIsSaved] = useState(false)
  // Core configuration states
  const [formData, setFormData] = useState({
    restaurantName: settingsStore.restaurantName,
    branchName: "Dubai Main Branch",
    phoneNumber: settingsStore.phoneNumber,
    whatsappNumber: "0300-1234567",
    email: "info@dubaifoods.com",
    website: "www.dubaifoods.com",
    address: settingsStore.address,
    mapsLocation: "https://maps.google.com/?q=Sheikh+Zayed+Road+Dubai",
    registrationNo: "REG-992104-B",
    trn: settingsStore.trn,
    receiptFooter: settingsStore.receiptFooter,
    businessDayStart: "06:00 AM",
    businessDayEnd: "06:00 AM",
    openingTime: "08:00 AM",
    closingTime: "02:00 AM",
    receiptWidth: "80mm",
    autoPrintReceipt: true,
    printDuplicateLabel: true,
    deliveryChargeRate: settingsStore.deliveryChargeRate || 50,
    serviceChargeRate: settingsStore.serviceChargeRate || 5,
    taxInclusive: true,
    roundOff: true,
    percentageDiscount: 10,
    fixedDiscount: 500,
    maxDiscount: 2000,
    managerPinForDiscount: true,
    autoOrderNo: true,
    autoKdsPrint: true,
    requireCustomerPhone: false,
    enableTableSelection: true,
    allowEditAfterPayment: false,
    defaultPaymentMethod: "Cash",
    keyboardMode: true,
    compactMode: false,
    soundEffects: true,
    accentColor: "Orange",
    fontSize: "Medium",
    timezone: "PKT (UTC+5)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12 Hour",
    pinTimeout: 15,
    sessionLogout: 60
  })

  // Table Management State
  const [tables, setTables] = useState([
    ...Array.from({ length: 12 }, (_, i) => ({ id: `G-${i + 1}`, zone: "Ground", capacity: 4 })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `F-${i + 1}`, zone: "Family Hall", capacity: 4 })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: `T-${i + 1}`, zone: "Rooftop", capacity: 4 }))
  ])
  const [newTableId, setNewTableId] = useState("")
  const [newTableZone, setNewTableZone] = useState("Ground")
  const [newTableCapacity, setNewTableCapacity] = useState(4)

  // Keyboard Shortcuts Config State
  const [shortcuts, setShortcuts] = useState([
    { action: "Focus Search", key: "F3" },
    { action: "Select Customer", key: "F2" },
    { action: "Checkout Order", key: "F6" },
    { action: "Recent Orders Map", key: "F4" },
    { action: "Dine In Mode", key: "F7" },
    { action: "Takeaway Mode", key: "F8" },
    { action: "Delivery Mode", key: "F9" },
    { action: "Clear Ticket Roster", key: "F1" },
    { action: "Duplicate Selected Order", key: "Ctrl + D" }
  ])

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    settingsStore.updateSettings({
      restaurantName: formData.restaurantName,
      phoneNumber: formData.phoneNumber,
      address: formData.address,
      trn: formData.trn,
      serviceChargeRate: formData.serviceChargeRate,
      deliveryChargeRate: formData.deliveryChargeRate,
      receiptFooter: formData.receiptFooter
    })
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  // Table add/delete
  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTableId) return
    if (tables.some(t => t.id.toLowerCase() === newTableId.toLowerCase())) {
      alert("Table ID already exists.")
      return
    }
    setTables([...tables, { id: newTableId, zone: newTableZone, capacity: newTableCapacity }])
    setNewTableId("")
  }

  const handleDeleteTable = (id: string) => {
    setTables(tables.filter(t => t.id !== id))
  }

  // Shortcut key change helper
  const handleShortcutChange = (action: string, newKey: string) => {
    // Validate duplicate keys
    if (shortcuts.some(s => s.key.toLowerCase() === newKey.toLowerCase() && s.action !== action)) {
      alert(`Duplicate key warning: "${newKey}" is already assigned.`)
      return
    }
    setShortcuts(shortcuts.map(s => s.action === action ? { ...s, key: newKey } : s))
  }

  const resetShortcuts = () => {
    setShortcuts([
      { action: "Focus Search", key: "F3" },
      { action: "Select Customer", key: "F2" },
      { action: "Checkout Order", key: "F6" },
      { action: "Recent Orders Map", key: "F4" },
      { action: "Dine In Mode", key: "F7" },
      { action: "Takeaway Mode", key: "F8" },
      { action: "Delivery Mode", key: "F9" },
      { action: "Clear Ticket Roster", key: "F1" },
      { action: "Duplicate Selected Order", key: "Ctrl + D" }
    ])
  }

  const tabsList = [
    { name: "Business Information", icon: Building2 },
    { name: "Business Hours", icon: Clock },
    { name: "Receipt Settings", icon: Receipt },
    { name: "Service & Delivery Charges", icon: DollarSign },
    { name: "Discount Rules", icon: SettingsIcon },
    { name: "Table Management", icon: Table },
    { name: "Payment Methods", icon: CreditCard },
    { name: "Keyboard Shortcuts", icon: Keyboard },
    { name: "Appearance", icon: Palette },
    { name: "Security Keys", icon: Key },
    { name: "System Status", icon: Server }
  ]

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">
      
      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Restaurant Configuration Center
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Enterprise Admin</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Business Day: 6AM–6AM
          </p>
        </div>

        <button 
          onClick={() => handleSave()}
          className="bg-primary text-white px-6 py-2 rounded-xl font-black text-xs uppercase hover:bg-primary/95 flex items-center gap-2 shadow-lg shadow-primary/25 transition-all active:scale-95 shrink-0"
        >
          {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {isSaved ? "Saved Successfully" : "Save Changes"}
        </button>
      </div>

      {/* ====================================================
          LAYOUT - LEFT TAB BAR, RIGHT FORM AREA
          ==================================================== */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Tab navigation */}
        <div className="col-span-12 lg:col-span-3 space-y-1 bg-card border border-border rounded-3xl p-4 shadow-sm h-fit max-h-[70vh] overflow-y-auto custom-scrollbar">
          <span className="text-[9px] uppercase font-black text-muted-foreground tracking-wider mb-3 block pl-2">System Configs</span>
          {tabsList.map(tab => {
            const isActive = activeTab === tab.name
            return (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  isActive 
                    ? 'bg-primary text-white shadow shadow-primary/15' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </div>

        {/* Right Settings Form Area */}
        <div className="col-span-12 lg:col-span-9 bg-card border border-border rounded-3xl p-6 shadow-sm min-h-[450px]">
          
          <AnimatePresence mode="wait">
            
            {/* BUSINESS INFORMATION */}
            {activeTab === "Business Information" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="border-b border-border pb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h3 className="font-black text-base uppercase text-foreground">Business Details</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Restaurant Name</label>
                    <input 
                      type="text"
                      value={formData.restaurantName}
                      onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Branch Name</label>
                    <input 
                      type="text"
                      value={formData.branchName}
                      onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Phone Number</label>
                    <input 
                      type="text"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">WhatsApp Channel</label>
                    <input 
                      type="text"
                      value={formData.whatsappNumber}
                      onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Tax Registration TRN</label>
                    <input 
                      type="text"
                      value={formData.trn}
                      onChange={(e) => setFormData({ ...formData, trn: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Business License No</label>
                    <input 
                      type="text"
                      value={formData.registrationNo}
                      onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Restaurant Street Address</label>
                    <input 
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Receipt Footer message</label>
                    <input 
                      type="text"
                      value={formData.receiptFooter}
                      onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* BUSINESS HOURS */}
            {activeTab === "Business Hours" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="border-b border-border pb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-black text-base uppercase text-foreground">Operational Hours</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Business Day Hours (Start / End)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select className="h-10 px-3 rounded-xl bg-secondary border border-border text-xs font-bold focus:outline-none">
                        <option>6:00 AM</option>
                        <option>7:00 AM</option>
                      </select>
                      <select className="h-10 px-3 rounded-xl bg-secondary border border-border text-xs font-bold focus:outline-none">
                        <option>6:00 AM</option>
                        <option>5:59 AM</option>
                      </select>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-semibold">Dubai Food uses a standard 6AM to 6AM business calendar day.</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Store Opening Hours</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={formData.openingTime} onChange={e=>setFormData({...formData, openingTime: e.target.value})} className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-xs font-black text-foreground" />
                      <input type="text" value={formData.closingTime} onChange={e=>setFormData({...formData, closingTime: e.target.value})} className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-xs font-black text-foreground" />
                    </div>
                  </div>
                </div>

                {/* Ramadan Placeholder note */}
                <div className="p-4 bg-orange-500/10 border border-orange-500/25 rounded-2xl flex items-center gap-3 text-orange-500 text-xs font-bold">
                  <AlertTriangle className="w-5 h-5" />
                  <div>
                    <p className="font-black">Special Holiday & Ramadan Schedules</p>
                    <p className="text-[10px] opacity-75">Configuring temporary operating times will automatically apply shift hour overrides to KDS timers and cashier login PIN validations.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* RECEIPT SETTINGS */}
            {activeTab === "Receipt Settings" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="border-b border-border pb-3 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  <h3 className="font-black text-base uppercase text-foreground">Receipt Printer Layout</h3>
                </div>

                <div className="space-y-4 text-xs font-bold">
                  <div>
                    <label className="text-xs uppercase font-black text-muted-foreground">Receipt Paper Width</label>
                    <div className="flex gap-2 mt-1">
                      {["58mm", "80mm"].map(width => (
                        <button 
                          type="button"
                          key={width} 
                          onClick={() => setFormData({ ...formData, receiptWidth: width })}
                          className={`px-4 py-2 border rounded-xl font-black ${formData.receiptWidth === width ? 'bg-primary text-white border-primary shadow' : 'bg-secondary border-border text-muted-foreground'}`}
                        >
                          {width} Standard Thermal
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
                    <div className="flex justify-between items-center p-2 bg-secondary/40 border border-border rounded-xl">
                      <span className="text-muted-foreground">Auto print receipts on order payment</span>
                      <input type="checkbox" checked={formData.autoPrintReceipt} onChange={(e) => setFormData({ ...formData, autoPrintReceipt: e.target.checked })} className="w-4 h-4 rounded cursor-pointer" />
                    </div>

                    <div className="flex justify-between items-center p-2 bg-secondary/40 border border-border rounded-xl">
                      <span className="text-muted-foreground">Print Duplicate Label for kitchens</span>
                      <input type="checkbox" checked={formData.printDuplicateLabel} onChange={(e) => setFormData({ ...formData, printDuplicateLabel: e.target.checked })} className="w-4 h-4 rounded cursor-pointer" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAX & CHARGES */}
            {activeTab === "Service & Delivery Charges" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="border-b border-border pb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <h3 className="font-black text-base uppercase text-foreground">Service & Delivery Charges</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Delivery Charges (Amount)</label>
                    <input 
                      type="number"
                      value={formData.deliveryChargeRate}
                      onChange={(e) => setFormData({ ...formData, deliveryChargeRate: parseFloat(e.target.value) || 0 })}
                      className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-black text-muted-foreground">Service Charge rate (%)</label>
                    <input 
                      type="number"
                      value={formData.serviceChargeRate}
                      onChange={(e) => setFormData({ ...formData, serviceChargeRate: parseFloat(e.target.value) || 0 })}
                      className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground"
                    />
                  </div>
                  <div className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl col-span-2 text-xs font-bold">
                    <span className="text-muted-foreground">Tax inclusive menu pricing (default is Tax Exclusive)</span>
                    <input type="checkbox" checked={formData.taxInclusive} onChange={e=>setFormData({...formData, taxInclusive: e.target.checked})} className="w-4 h-4 rounded cursor-pointer" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* TABLE MANAGEMENT */}
            {activeTab === "Table Management" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="border-b border-border pb-3 flex items-center gap-2">
                  <Table className="w-5 h-5 text-primary" />
                  <h3 className="font-black text-base uppercase text-foreground">Tables Configuration</h3>
                </div>

                {/* Add Table form */}
                <form onSubmit={handleAddTable} className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-secondary/35 p-4 border border-border rounded-2xl">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">Table ID</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. G-10" 
                      value={newTableId}
                      onChange={(e) => setNewTableId(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-card border border-border text-xs font-black placeholder:font-normal outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">Zone</label>
                    <select 
                      value={newTableZone}
                      onChange={(e) => setNewTableZone(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-card border border-border text-xs font-bold outline-none"
                    >
                      <option value="Ground">Ground Floor</option>
                      <option value="Family Hall">Family Hall</option>
                      <option value="Rooftop">Rooftop Area</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">Capacity (Seats)</label>
                    <input 
                      type="number"
                      value={newTableCapacity}
                      onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 4)}
                      className="w-full h-9 px-2.5 rounded-lg bg-card border border-border text-xs font-black outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <button 
                      type="submit"
                      className="w-full h-9 bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Table
                    </button>
                  </div>
                </form>

                {/* Table list */}
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {tables.map(table => (
                    <div key={table.id} className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl">
                      <div>
                        <span className="font-black text-foreground">Table {table.id}</span>
                        <span className="text-[10px] bg-secondary border border-border text-muted-foreground px-2 py-0.5 rounded-full ml-3 font-bold">
                          Zone: {table.zone}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-bold">{table.capacity} Seats</span>
                        <button 
                          type="button"
                          onClick={() => handleDeleteTable(table.id)}
                          className="p-1.5 hover:bg-red-500/10 text-red-500 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* KEYBOARD SHORTCUTS */}
            {activeTab === "Keyboard Shortcuts" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="border-b border-border pb-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-5 h-5 text-primary" />
                    <h3 className="font-black text-base uppercase text-foreground">Keyboard Bindings</h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={resetShortcuts}
                    className="text-[10px] text-primary hover:underline font-black"
                  >
                    Reset Defaults
                  </button>
                </div>

                <div className="space-y-2">
                  {shortcuts.map(item => (
                    <div key={item.action} className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl">
                      <span className="text-xs font-bold text-muted-foreground">{item.action}</span>
                      <input 
                        type="text" 
                        value={item.key}
                        onChange={(e) => handleShortcutChange(item.action, e.target.value)}
                        className="w-32 h-8 text-center bg-card border border-border rounded-lg text-xs font-black text-foreground focus:border-orange-500 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* SYSTEM STATUS & ADVANCED */}
            {activeTab === "System Status" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="border-b border-border pb-3 flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  <h3 className="font-black text-base uppercase text-foreground">System Health & Diagnostics</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-secondary/40 border border-border rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <Wifi className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground">Internet Connection</p>
                      <p className="text-[10px] font-bold text-emerald-500">Online & Stable</p>
                    </div>
                  </div>

                  <div className="p-4 bg-secondary/40 border border-border rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground">Cloud Sync</p>
                      <p className="text-[10px] font-bold text-emerald-500">Last synced 2 mins ago</p>
                    </div>
                  </div>

                  <div className="p-4 bg-secondary/40 border border-border rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground">Main Printer</p>
                      <p className="text-[10px] font-bold text-emerald-500">Connected</p>
                    </div>
                  </div>

                  <div className="p-4 bg-secondary/40 border border-border rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground">Local DB Size</p>
                      <p className="text-[10px] font-bold text-muted-foreground">12.4 MB</p>
                    </div>
                  </div>
                  
                  <div className="col-span-1 md:col-span-2 p-4 bg-secondary/40 border border-border rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Save className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground">Automated Backups</p>
                      <p className="text-[10px] font-bold text-muted-foreground">Last cloud backup: Today at 5:00 AM</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-secondary/40 border border-border rounded-2xl space-y-3 text-xs mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-bold">Software Build Version:</span>
                    <span className="font-black text-foreground">v2.4.1-prod</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-bold">Local SQLite DB status:</span>
                    <span className="text-emerald-500 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Healthy
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-bold">Cached Assets size:</span>
                    <span className="font-black text-foreground">1.8 MB</span>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="text-xs uppercase font-black tracking-wider text-muted-foreground mb-3">Settings Reset Actions</h4>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (confirm("Resetting preferences will clear all local tax, TRN, and printer settings. Proceed?")) {
                        alert("Settings reset to defaults.")
                      }
                    }}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-black uppercase transition-all"
                  >
                    Reset System Configuration
                  </button>
                </div>
              </motion.div>
            )}

            {/* Default fallback tabs */}
            {activeTab !== "Business Information" && activeTab !== "Business Hours" && activeTab !== "Receipt Settings" && activeTab !== "Service & Delivery Charges" && activeTab !== "Table Management" && activeTab !== "Keyboard Shortcuts" && activeTab !== "System Status" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-12 text-center text-muted-foreground bg-background/20 border border-border border-dashed rounded-3xl">
                <SettingsIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <h4 className="text-base font-black text-foreground uppercase tracking-wide">Preference Section Loaded</h4>
                <p className="text-xs font-bold text-muted-foreground mt-2 max-w-sm mx-auto">
                  Configuring {activeTab} changes the terminal properties. Click "Save Changes" at the top to commit settings values.
                </p>
              </motion.div>
            )}

          </AnimatePresence>

        </div>

      </div>

    </div>
  )
}
