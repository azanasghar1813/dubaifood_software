import React, { useState, useEffect, useMemo } from 'react'
import { useKdsStore, type KitchenTicket } from '../store/kdsStore'
import { usePrinterStore } from '../store/printerStore'
import { 
  Search, Printer, CheckCircle2, AlertCircle, RefreshCw, Clock, Usb, Bluetooth, Network, Settings2, RefreshCcw
} from 'lucide-react'
import { configApi } from '../api/configApi'

export const KDS: React.FC = () => {
  const { tickets, updateTicketStatus, fetchTickets } = useKdsStore()
  
  const [activeTab, setActiveTab] = useState<"Active" | "Sent" | "Failed" | "Completed">("Active")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"Oldest" | "Newest">("Newest")
  
  const [tick, setTick] = useState(0)
  
  // Printer Hub State
  const [discoveredHardware, setDiscoveredHardware] = useState<any[]>([])
  const [systemPrinters, setSystemPrinters] = useState<any[]>([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [showPrinterHub, setShowPrinterHub] = useState(false)
  const [isRetryingAll, setIsRetryingAll] = useState(false)
  const [previewTicket, setPreviewTicket] = useState<KitchenTicket | null>(null)

  // Polling & setup
  useEffect(() => {
    fetchTickets()
    fetchPrinters()
    const interval = setInterval(fetchTickets, 10000)
    const tickTimer = setInterval(() => setTick(t => t + 1), 10000)
    return () => {
      clearInterval(interval)
      clearInterval(tickTimer)
    }
  }, [fetchTickets])

  const fetchPrinters = async () => {
    try {
      const res = await configApi.getAllConfig()
      if (res.data?.data?.printers) {
        setSystemPrinters(res.data.data.printers)
      }
    } catch (e) { console.error(e) }
  }

  const discoverHardware = async () => {
    setIsDiscovering(true)
    try {
      const res = await configApi.discoverPrinters()
      setDiscoveredHardware(res.data?.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setIsDiscovering(false)
    }
  }

  const togglePrinterHub = () => {
    if (!showPrinterHub) {
      discoverHardware()
    }
    setShowPrinterHub(!showPrinterHub)
  }

  const assignPrinter = async (hw: any, targetType: 'KITCHEN' | 'RECEIPT') => {
    try {
      // Find if this printer already exists in system by port/connection_string
      const existing = systemPrinters.find(p => 
        (p.connection_string === hw.port) || 
        (p.ipAddress === hw.port) ||
        (p.name === hw.name)
      )

      if (existing) {
        await configApi.updatePrinter(existing.id, {
          name: existing.name,
          type: targetType,
          driver_type: hw.type,
          connection_string: hw.port,
          paperWidth: existing.paperWidth || 80,
          isActive: true
        })
      } else {
        await configApi.createPrinter({
          name: hw.name,
          type: targetType,
          driver_type: hw.type,
          connection_string: hw.port,
          paperWidth: 80,
          isActive: true
        })
      }
      // Refresh system printers
      fetchPrinters()
      alert(`Printer successfully assigned as ${targetType}!`)
    } catch (e) {
      console.error(e)
      alert("Failed to assign printer")
    }
  }

  const handleRefresh = () => {
    fetchTickets()
  }


  // Derived state mapping
  // "Waiting" -> PRINT_FAILED (Or waiting for printer)
  // "Accepted", "Preparing", "Ready" -> SENT
  // "Served" -> COMPLETED
  const mappedTickets = useMemo(() => {
    return tickets.map(t => {
       let displayStatus: "SENT" | "PRINT_FAILED" | "COMPLETED" = "SENT"
       if (t.status === "Waiting") displayStatus = "PRINT_FAILED"
       else if (t.status === "Served") displayStatus = "COMPLETED"
       else displayStatus = "SENT"

       return { ...t, displayStatus }
    })
  }, [tickets, tick])

  const filteredTickets = useMemo(() => {
     const result = mappedTickets.filter(t => {
        if (activeTab === "Active" && t.displayStatus === "COMPLETED") return false
        if (activeTab === "Sent" && t.displayStatus !== "SENT") return false
        if (activeTab === "Failed" && t.displayStatus !== "PRINT_FAILED") return false
        if (activeTab === "Completed" && t.displayStatus !== "COMPLETED") return false

        const q = searchQuery.toLowerCase()
        if (q && !(
           t.orderNumber.includes(q) ||
           t.table.toLowerCase().includes(q) ||
           t.customer.toLowerCase().includes(q) ||
           t.items.some(i => i.name.toLowerCase().includes(q))
        )) {
           return false
        }
        return true
     })
     
     result.sort((a, b) => {
        const timeA = new Date(a.orderTime).getTime()
        const timeB = new Date(b.orderTime).getTime()
        return sortOrder === "Newest" ? timeB - timeA : timeA - timeB
     })
     
     return result
  }, [mappedTickets, activeTab, searchQuery, sortOrder])

  // Actions
  const handleMarkDone = (id: string) => {
     updateTicketStatus(id, "Served")
  }

  const handleRetryPrint = async (id: string) => {
     try {
       await usePrinterStore.getState().printKitchen(id, 'cashier')
       // Optimistically move it back to SENT (Accepted)
       updateTicketStatus(id, "Accepted")
     } catch (e) {
       console.error(e)
     }
  }

  const handleRetryAllFailed = async () => {
    const failedTickets = mappedTickets.filter(t => t.displayStatus === "PRINT_FAILED")
    if (failedTickets.length === 0) return alert("No failed prints to retry!")
    
    setIsRetryingAll(true)
    try {
      for (const t of failedTickets) {
        try {
          await usePrinterStore.getState().printKitchen(t.id, 'cashier')
          updateTicketStatus(t.id, "Accepted")
        } catch(e) {
          console.error(`Failed to retry ticket ${t.id}`, e)
        }
      }
    } finally {
      setIsRetryingAll(false)
    }
  }

  return (
    <div className="h-[calc(100vh-8.5rem)] rounded-3xl border border-border bg-background flex flex-col font-sans overflow-hidden">
      
      {/* HEADER */}
      <div className="p-6 bg-card border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Printer className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              Kitchen Print Monitor
              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={togglePrinterHub}
            className={`p-2.5 rounded-xl border transition-colors flex items-center gap-2 ${
              showPrinterHub 
                ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20' 
                : 'bg-secondary hover:bg-border text-muted-foreground hover:text-foreground border-border'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span className="text-xs font-bold hidden sm:inline">Printer Hub</span>
          </button>

          <button 
            onClick={handleRetryAllFailed}
            disabled={isRetryingAll}
            className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 ${isRetryingAll ? 'animate-spin' : ''}`} />
            <span className="text-xs font-bold hidden sm:inline">Retry Failed</span>
          </button>
          
          <button 
            onClick={handleRefresh}
            className="p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-bold hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* PRINTER HUB PANEL */}
      {showPrinterHub && (
        <div className="bg-secondary/40 border-b border-border p-6 shrink-0 animate-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              Smart Printer Auto-Discovery
            </h2>
            <button 
              onClick={discoverHardware} 
              disabled={isDiscovering}
              className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isDiscovering ? 'animate-spin' : ''}`} />
              Rescan Hardware
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Detected Hardware */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Discovered Devices</h3>
              {discoveredHardware.length === 0 ? (
                <div className="text-sm font-bold text-muted-foreground text-center py-4 bg-secondary/30 rounded-xl border border-dashed border-border">
                  {isDiscovering ? 'Scanning for printers...' : 'No USB or Bluetooth printers found.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {discoveredHardware.map((hw, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-border group hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                          {hw.type === 'ESCPOS_USB' ? <Usb className="w-4 h-4 text-blue-500" /> : <Bluetooth className="w-4 h-4 text-blue-500" />}
                        </div>
                        <div>
                          <p className="text-sm font-black">{hw.name}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{hw.description} • {hw.port}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => assignPrinter(hw, 'KITCHEN')}
                          className="px-3 py-1.5 bg-background border border-border hover:border-primary hover:text-primary rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                        >
                          Set Kitchen
                        </button>
                        <button 
                          onClick={() => assignPrinter(hw, 'RECEIPT')}
                          className="px-3 py-1.5 bg-background border border-border hover:border-blue-500 hover:text-blue-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                        >
                          Set Main
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Assignments */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Active System Assignments</h3>
              <div className="space-y-2">
                {['KITCHEN', 'RECEIPT'].map(targetType => {
                  const activePrinter = systemPrinters.find(p => p.type === targetType && p.isActive !== false)
                  return (
                    <div key={targetType} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                          {targetType === 'KITCHEN' ? <Printer className="w-4 h-4 text-emerald-500" /> : <Printer className="w-4 h-4 text-primary" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{targetType === 'RECEIPT' ? 'Main Counter Printer' : 'Kitchen Printer'}</p>
                          {activePrinter ? (
                            <p className="text-sm font-black text-foreground">{activePrinter.name}</p>
                          ) : (
                            <p className="text-sm font-bold text-red-500">Not Configured</p>
                          )}
                        </div>
                      </div>
                      {activePrinter && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-md border border-emerald-500/20">
                          {activePrinter.driver_type === 'ESCPOS_LAN' ? 'LAN' : 
                           activePrinter.driver_type === 'ESCPOS_BT' ? 'BT' : 'USB'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABS & SEARCH */}
      <div className="px-6 py-4 bg-secondary/20 border-b border-border flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto custom-scrollbar">
           {[
             { id: "Active", label: "Active" },
             { id: "Sent", label: "Sent" },
             { id: "Completed", label: "Completed" },
             { id: "Failed", label: "Failed" }
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-colors ${
                 activeTab === tab.id
                   ? 'bg-primary text-white shadow-sm'
                   : 'bg-card border border-border text-muted-foreground hover:text-foreground'
               }`}
             >
               {tab.label}
             </button>
           ))}
        </div>

        <div className="relative w-full md:w-80 shrink-0 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search order #, table, items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border text-sm font-bold outline-none focus:border-primary transition-colors"
            />
          </div>
          <select
             value={sortOrder}
             onChange={(e) => setSortOrder(e.target.value as "Oldest" | "Newest")}
             className="h-10 px-3 rounded-xl bg-card border border-border text-sm font-bold outline-none focus:border-primary transition-colors cursor-pointer"
          >
             <option value="Newest">Newest First</option>
             <option value="Oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* LIST VIEW */}
      <div className="flex-1 overflow-y-auto p-6 bg-secondary/10">
         <div className="space-y-3 max-w-5xl mx-auto">
            {filteredTickets.length === 0 ? (
               <div className="text-center py-20 opacity-50">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-bold text-lg text-muted-foreground">No orders in this view.</p>
               </div>
            ) : (
               filteredTickets.map(ticket => {
                  const elapsedMs = Date.now() - new Date(ticket.orderTime).getTime()
                  const elapsedMins = Math.floor(elapsedMs / 60000)
                  const isDelayed = elapsedMins > 15

                  return (
                     <div 
                       key={ticket.id} 
                       className={`bg-card rounded-2xl border flex flex-col md:flex-row shadow-sm overflow-hidden transition-all ${
                          ticket.displayStatus === "PRINT_FAILED" ? "border-red-500/50 shadow-red-500/10" : "border-border hover:border-primary/50"
                       }`}
                     >
                        {/* Status Side Indicator */}
                        <div className={`w-2 shrink-0 ${
                           ticket.displayStatus === "PRINT_FAILED" ? "bg-red-500" :
                           ticket.displayStatus === "COMPLETED" ? "bg-emerald-500" :
                           "bg-blue-500"
                        }`} />

                        <div className="flex-1 p-4 md:p-5 flex flex-col justify-center">
                           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              
                              {/* Left: Identity */}
                              <div className="flex-1">
                                 <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-black tracking-tight">
                                       #{ticket.orderNumber}
                                       {ticket.isVip && (
                                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-black bg-yellow-400 text-yellow-950">
                                             VIP
                                          </span>
                                       )}
                                    </h3>
                                    <span className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                                       {ticket.orderType} • {ticket.orderType === 'Delivery' ? (ticket.riderName ? `Rider: ${ticket.riderName}` : 'Delivery') : (ticket.table !== 'N/A' ? `Table ${ticket.table}` : 'No Table')}
                                    </span>
                                 </div>
                                 <p className="text-xs text-muted-foreground font-semibold mt-1">
                                    {ticket.items.length} items • Cashier: {ticket.cashier} • Time: {new Date(ticket.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 </p>
                              </div>

                              {/* Middle: Badge & Elapsed */}
                              <div className="flex items-center gap-4 shrink-0">
                                 {ticket.displayStatus === "SENT" && (
                                    <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-black tracking-wider">
                                       <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> SENT
                                    </span>
                                 )}
                                 {ticket.displayStatus === "PRINT_FAILED" && (
                                    <span className="flex items-center gap-1.5 bg-red-500/10 text-red-600 border border-red-500/20 px-3 py-1 rounded-full text-xs font-black tracking-wider">
                                       <AlertCircle className="w-3.5 h-3.5" /> PRINT FAILED
                                    </span>
                                 )}
                                 {ticket.displayStatus === "COMPLETED" && (
                                    <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-black tracking-wider">
                                       <CheckCircle2 className="w-3.5 h-3.5" /> COMPLETED
                                    </span>
                                 )}

                                 <div className={`flex items-center gap-1.5 text-sm font-black tabular-nums ${
                                    isDelayed && ticket.displayStatus !== "COMPLETED" ? "text-red-500 animate-pulse" : "text-muted-foreground"
                                 }`}>
                                    <Clock className="w-4 h-4" />
                                    {elapsedMins}m elapsed
                                 </div>
                              </div>

                           </div>

                           {/* Always Visible Items */}
                           <div className="mt-4 border-t border-border/50 pt-3">
                              <div className="p-3 bg-secondary/50 rounded-xl space-y-2 font-mono text-xs">
                                 {ticket.items.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                       <span className="font-bold opacity-70">{item.quantity}x</span>
                                       <div>
                                          <span className="font-bold">{item.name}</span>
                                          {item.modifiers?.map((m, mIdx) => (
                                             <span key={mIdx} className="text-[10px] text-muted-foreground opacity-70 block pl-2">- {m.name}</span>
                                          ))}
                                       </div>
                                    </div>
                                 ))}
                                 {ticket.notes && (
                                    <div className="text-red-500 mt-2 font-bold border-t border-red-500/20 pt-2">Note: {ticket.notes}</div>
                                 )}
                              </div>
                           </div>

                           <div className="text-[10px] text-muted-foreground font-semibold mt-2">
                              {ticket.displayStatus === "PRINT_FAILED" ? "Printer offline — connection refused" : `Printed ${elapsedMins}m ago · Kitchen Printer`}
                           </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="p-4 bg-secondary/30 border-l border-border flex flex-col gap-2 items-center justify-center min-w-[140px] shrink-0">
                           <button 
                              onClick={() => setPreviewTicket(ticket)}
                              className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                           >
                              <Search className="w-3.5 h-3.5" /> Preview
                           </button>

                           {ticket.displayStatus === "SENT" && (
                              <button 
                                 onClick={() => handleMarkDone(ticket.id)}
                                 className="w-full py-3 bg-card hover:bg-emerald-50 text-emerald-600 border border-emerald-500/30 rounded-xl font-black text-xs uppercase tracking-wider transition-colors"
                              >
                                 Mark Done
                              </button>
                           )}
                           {ticket.displayStatus === "PRINT_FAILED" && (
                              <button 
                                 onClick={() => handleRetryPrint(ticket.id)}
                                 className="w-full py-3 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 rounded-xl font-black text-xs uppercase tracking-wider transition-colors"
                              >
                                 Retry Print
                              </button>
                           )}
                           {ticket.displayStatus === "COMPLETED" && (
                              <span className="text-xs font-bold text-muted-foreground flex flex-col items-center gap-1 py-2">
                                 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                 Done
                              </span>
                           )}
                        </div>

                     </div>
                  )
               })
            )}
         </div>
      </div>

      {/* PREVIEW MODAL */}
      {previewTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in" onClick={() => setPreviewTicket(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto text-black font-sans animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-black uppercase text-center w-full">Receipt Preview</h2>
              </div>
              
              {/* Receipt Content */}
              <div className="text-sm border-2 border-black p-4 space-y-1 bg-white relative" style={{ fontFamily: 'monospace' }}>
                <div className="text-2xl font-black mb-2 flex flex-col">
                  <span>Order ID:</span>
                  <span className="text-3xl mt-1">#{previewTicket.orderNumber}</span>
                </div>
                {previewTicket.isVip && (
                  <div className="font-black text-lg text-center border-y-2 border-black py-1 my-3 bg-black text-white uppercase">
                    *** VIP ORDER ***
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-black border-dashed pt-2">
                  <span className="font-bold">Table No:</span>
                  <span>{previewTicket.table}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">Order Type:</span>
                  <span>{previewTicket.orderType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">{previewTicket.orderType.toLowerCase().includes('delivery') ? 'Rider:' : 'Waiter:'}</span>
                  <span>{previewTicket.orderType.toLowerCase().includes('delivery') ? (previewTicket.riderName || 'Unassigned') : ((previewTicket as any).waiterName || 'Unassigned')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">Cashier:</span>
                  <span>{previewTicket.cashier}</span>
                </div>
                <div className="flex justify-between pb-2 border-b-2 border-black border-dashed">
                  <span className="font-bold">Time:</span>
                  <span>{new Date(previewTicket.orderTime).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).replace(',', '')}</span>
                </div>

                <div className="mt-4">
                  {Object.entries(
                    previewTicket.items.reduce((acc, item) => {
                      const k = item.kitchen || 'OTHER';
                      if (!acc[k]) acc[k] = [];
                      acc[k].push(item);
                      return acc;
                    }, {} as Record<string, typeof previewTicket.items>)
                  ).map(([kitchenName, items]) => (
                    <div key={kitchenName} className="mb-4 border-2 border-black">
                      <div className="text-center font-black uppercase py-1 border-b-2 border-black border-dashed">
                        {kitchenName}
                      </div>
                      <div className="flex justify-between font-bold border-b-2 border-black border-dashed px-1 py-1 bg-gray-100">
                        <span>Item</span>
                        <span>Qty</span>
                      </div>
                      <div className="px-1 py-1">
                        {items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start mb-2 border-b border-gray-300 border-dashed last:border-0 pb-1">
                            <div className="flex-1 pr-2">
                              <span className={`font-bold ${item.type === 'REMOVE' ? 'line-through' : ''}`}>
                                {item.name}
                              </span>
                              {item.modifiers?.length > 0 && (
                                <div className="text-xs text-gray-700 pl-2 mt-0.5">
                                  {item.modifiers.map((m: any, midx: number) => (
                                    <div key={midx}>- {m.name}</div>
                                  ))}
                                </div>
                              )}
                              {item.notes && (
                                <div className="text-xs italic font-bold pl-2 mt-0.5">Note: {item.notes}</div>
                              )}
                            </div>
                            <div className="font-black text-right min-w-[2ch]">
                              {item.quantity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setPreviewTicket(null)} className="flex-1 py-3 bg-secondary hover:bg-border text-foreground font-black rounded-xl transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
