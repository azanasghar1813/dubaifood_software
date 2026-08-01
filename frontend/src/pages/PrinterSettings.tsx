import { useState, useEffect, useMemo } from "react"
import { RefreshCw } from 'lucide-react'
import { usePrinterStore } from '../store/printerStore'

export default function PrinterSettings() {
  const printerStore = usePrinterStore()
  
  // Local States
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>("p-1")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [previewWidth, setPreviewWidth] = useState<"58mm" | "80mm">("80mm")

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F5 Refresh
      if (e.key === "F5") {
        e.preventDefault()
        handleAutoDetect()
      }

      // Ctrl + T: Test print selected
      if (e.ctrlKey && e.key === "t") {
        e.preventDefault()
        handleTestPrint("Receipt Test")
      }

      // Ctrl + P: Focus Settings (simulate by selecting main printer)
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault()
        setSelectedPrinterId("p-1")
        alert("Main Cashier Printer configuration selected.")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedPrinterId])

  const handleAutoDetect = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }

  const handleTestPrint = (type: string) => {
    const activePr = printerStore.printers.find(p => p.id === selectedPrinterId)
    if (!activePr) return

    printerStore.enqueuePrintJob({
      type: "Receipt",
      printerType: activePr.type,
      content: `TEST ${type.toUpperCase()}`
    })

    alert(`Sent test instruction "${type}" to ${activePr.name}.`)
  }

  const selectedPrinter = useMemo(() => {
    return printerStore.printers.find(p => p.id === selectedPrinterId) || printerStore.printers[0]
  }, [printerStore.printers, selectedPrinterId])

  const handleUpdatePrinterField = (field: string, val: any) => {
    printerStore.updateSettings({ [field]: val })
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">
      
      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Printer & Hardware Management
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Hardware Center</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Configure thermal receipt outputs, routing rules, scanners, and cash registers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleAutoDetect}
            className={`flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-4 h-4" /> Auto-Detect Hardware [F5]
          </button>
        </div>
      </div>


      {/* ====================================================
          MAIN ROUTING & CONFIGURATION split
          ==================================================== */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Side: Printer List & testing controls */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          
          {/* Printers List */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">Detected Printers</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {printerStore.printers.map((pr) => {
                const isSelected = selectedPrinterId === pr.id
                return (
                  <div 
                    key={pr.id}
                    onClick={() => setSelectedPrinterId(pr.id)}
                    className={`p-4 bg-card border rounded-2xl cursor-pointer hover:border-primary/50 transition-all flex flex-col justify-between h-32 ${
                      isSelected ? 'border-primary shadow shadow-primary/10' : 'border-border/60'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-black text-foreground block">{pr.name}</span>
                      <span className="text-[9px] text-muted-foreground mt-1 block">Connection: {pr.connectionType}</span>
                    </div>

                    <div className="flex justify-between items-center mt-3">
                      <span className="text-[9px] bg-secondary border border-border px-2 py-0.5 rounded-full font-bold">
                        {pr.type}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${pr.status === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Printer Config settings */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-6">
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">Printer Configurations</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-muted-foreground">Rename Printer</label>
                <input 
                  type="text" 
                  value={selectedPrinter.name}
                  onChange={() => {
                    printerStore.updatePrinterStatus(selectedPrinter.id, selectedPrinter.status)
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border border-border outline-none text-xs font-black text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-muted-foreground">Paper Width Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {["58mm", "80mm"].map(sz => (
                    <button
                      key={sz}
                      onClick={() => handleUpdatePrinterField("receiptWidth", sz)}
                      className={`h-10 rounded-xl border text-xs font-black ${printerStore.settings.receiptWidth === sz ? 'bg-primary text-white border-primary' : 'bg-secondary text-muted-foreground border-border'}`}
                    >
                      {sz} Layout
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl col-span-2">
                <span className="text-muted-foreground">Auto-Print Kitchen tickets automatically</span>
                <input type="checkbox" checked={printerStore.settings.autoPrintKitchen} onChange={(e) => handleUpdatePrinterField("autoPrintKitchen", e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
              </div>

              <div className="flex justify-between items-center p-3 bg-secondary/40 border border-border rounded-xl col-span-2">
                <span className="text-muted-foreground">Open Cash Drawer immediately on payment completion</span>
                <input type="checkbox" checked={printerStore.settings.cutPaper} onChange={(e) => handleUpdatePrinterField("cutPaper", e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
              </div>
            </div>
          </div>


        </div>

        {/* Right Side: Live Thermal Receipt Preview & logs */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          
          {/* Live Thermal Receipt Preview */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm flex flex-col items-center">
            <div className="flex justify-between items-center w-full mb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Live Receipt Preview</h3>
              <div className="flex bg-secondary/50 p-0.5 rounded-lg border border-border">
                {["58mm", "80mm"].map(sz => (
                  <button 
                    key={sz}
                    onClick={() => setPreviewWidth(sz as any)}
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase ${previewWidth === sz ? 'bg-primary text-white' : 'text-muted-foreground'}`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Receipt container */}
            <div className="bg-white text-black p-4 font-mono text-[10px] shadow-lg border border-zinc-200 rounded-lg w-full max-w-[280px]">
              <div className="text-center space-y-0.5 border-b border-dashed border-zinc-400 pb-2">
                <p className="font-bold text-sm">DUBAI FOODS</p>
                <p>Sheikh Zayed Road, UAE</p>
                <p>Tel: +971 4 123 4567</p>
              </div>

              <div className="py-2 border-b border-dashed border-zinc-400 space-y-0.5">
                <p>Order ID: ORD-8012 (Dine-In)</p>
                <p>Cashier: Ahmed</p>
                <p>Date: {new Date().toLocaleDateString()} 12:45 PM</p>
              </div>

              <div className="py-2 border-b border-dashed border-zinc-400 space-y-1">
                <div className="flex justify-between">
                  <span>2x Zinger Burger</span>
                  <span>Rs. 1,600</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Achari Pizza (Medium)</span>
                  <span>Rs. 1,050</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Mint Margarita</span>
                  <span>Rs. 150</span>
                </div>
              </div>

              <div className="py-2 space-y-0.5">
                <div className="flex justify-between font-bold">
                  <span>Subtotal</span>
                  <span>Rs. 2,800</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (16%)</span>
                  <span>Rs. 448</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed border-zinc-400">
                  <span>NET TOTAL</span>
                  <span>Rs. 3,248</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed border-zinc-400 mt-2">
                <p className="font-bold">Thank you for dining with us!</p>
                <p className="text-[8px] opacity-75 mt-1">Order #ORD-8012</p>
              </div>
            </div>
          </div>

          {/* Test Action Panel */}
          <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Hardware Diagnostics</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button onClick={() => handleTestPrint("Receipt Test")} className="p-2.5 bg-secondary hover:bg-border border border-border rounded-xl text-center">Receipt Test</button>
              <button onClick={() => handleTestPrint("Kitchen Test Ticket")} className="p-2.5 bg-secondary hover:bg-border border border-border rounded-xl text-center">Kitchen Test Ticket</button>
            </div>
          </div>


        </div>

      </div>

    </div>
  )
}
