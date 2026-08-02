import React, { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowRightLeft, DollarSign, Clock, 
  RefreshCw, Printer, 
  CheckCircle2, BarChart, Activity, 
  AlertCircle, Coins, Plus, ShieldAlert, Key, 
  X, Search
} from "lucide-react"

// Constants & Types

interface CashDrop {
  id: string
  time: string
  amount: number
  reason: string
  destination: string
  printed: boolean
}

interface PaidOut {
  id: string
  time: string
  purpose: string
  amount: number
  approvedBy: string
}

interface ShiftActivity {
  id: string
  time: string
  type: string
  description: string
  severity: "info" | "warning" | "error" | "success"
}

interface Transaction {
  time: string
  orderNo: string
  customer: string
  paymentMethod: string
  amount: number
  cashier: string
  status: "Completed" | "Refunded" | "Pending"
}

interface ShiftRecord {
  id: string
  date: string
  cashier: string
  till: string
  openingFloat: number
  expectedCash: number
  actualCash: number
  difference: number
  shiftTime: string
  status: "Balanced" | "Discrepancy"
}

export default function CashierManagement() {


  // --- CORE SHIFT ACTIVE STATE ---
  const [isShiftActive, setIsShiftActive] = useState(true)
  const [openingFloat, setOpeningFloat] = useState(10000)
  const [cashierName] = useState("Ahmed")
  const [employeeId] = useState("EMP-04")
  // const [role] = useState("Cashier")
  const [tillName] = useState("Main Till #1")
  // const [counterNumber] = useState("Register 01")
  // const [loginTime] = useState("2026-07-28T08:00:00")
  
  // Simulated Time states
  const [currentTime, setCurrentTime] = useState(new Date())
  const [shiftSeconds, setShiftSeconds] = useState(33840) // ~9.4 hours start
  
  // Data lists
  const [cashDrops, setCashDrops] = useState<CashDrop[]>([
    { id: "CD-1", time: "11:30 AM", amount: 15000, reason: "Mid-day excess safe drop", destination: "Safe Deposit", printed: true },
    { id: "CD-2", time: "03:15 PM", amount: 10000, reason: "Manager vault transfer", destination: "Manager Collection", printed: true }
  ])

  const [paidOuts, setPaidOuts] = useState<PaidOut[]>([
    { id: "PO-1", time: "09:45 AM", purpose: "Supplies (Milk & Sugar)", amount: 1200, approvedBy: "Ali Manager" },
    { id: "PO-2", time: "02:00 PM", purpose: "Cleaning (Floor Detergents)", amount: 800, approvedBy: "Ali Manager" }
  ])

  const [shiftActivities, setShiftActivities] = useState<ShiftActivity[]>([
    { id: "ACT-1", time: "08:00 AM", type: "Shift Started", description: "Shift opened with float Rs. 10,000", severity: "success" },
    { id: "ACT-2", time: "09:45 AM", type: "Paid Out", description: "Paid Rs. 1,200 for tea supply", severity: "info" },
    { id: "ACT-3", time: "11:30 AM", type: "Cash Drop", description: "Transferred Rs. 15,000 to safe box", severity: "warning" },
    { id: "ACT-4", time: "01:10 PM", type: "Refund Approved", description: "Order #8590 refunded Rs. 1,500 cash", severity: "error" },
    { id: "ACT-5", time: "02:00 PM", type: "Paid Out", description: "Paid Rs. 800 for cleaning supplies", severity: "info" },
    { id: "ACT-6", time: "03:15 PM", type: "Cash Drop", description: "Manager collected Rs. 10,000 cash", severity: "warning" }
  ])

  const [transactions] = useState<Transaction[]>([
    { time: "04:55 PM", orderNo: "ORD-9402", customer: "Muhammad Ali", paymentMethod: "Cash", amount: 2450, cashier: "Ahmed", status: "Completed" },
    { time: "04:42 PM", orderNo: "ORD-9398", customer: "Sara Khan", paymentMethod: "EasyPaisa", amount: 1850, cashier: "Ahmed", status: "Completed" },
    { time: "04:30 PM", orderNo: "ORD-9390", customer: "Zainab Malik", paymentMethod: "Card", amount: 3900, cashier: "Ahmed", status: "Completed" },
    { time: "04:15 PM", orderNo: "ORD-9381", customer: "Bilal Lodhi", paymentMethod: "JazzCash", amount: 1200, cashier: "Ahmed", status: "Completed" },
    { time: "03:50 PM", orderNo: "ORD-9377", customer: "Hamza Shah", paymentMethod: "Cash", amount: 4800, cashier: "Ahmed", status: "Completed" },
    { time: "03:10 PM", orderNo: "ORD-9365", customer: "Ayesha Bibi", paymentMethod: "Meezan Bank", amount: 6200, cashier: "Ahmed", status: "Completed" },
    { time: "02:45 PM", orderNo: "ORD-9359", customer: "Usman Ghani", paymentMethod: "Cash", amount: 1500, cashier: "Ahmed", status: "Refunded" }
  ])

  const [shiftHistory, setShiftHistory] = useState<ShiftRecord[]>([
    { id: "SH-90", date: "2026-07-27", cashier: "Umar", till: "Main Till #1", openingFloat: 10000, expectedCash: 38450, actualCash: 38450, difference: 0, shiftTime: "8 hrs 15 mins", status: "Balanced" },
    { id: "SH-89", date: "2026-07-26", cashier: "Ahmed", till: "Main Till #1", openingFloat: 10000, expectedCash: 42100, actualCash: 42050, difference: -50, shiftTime: "9 hrs 0 mins", status: "Discrepancy" },
    { id: "SH-88", date: "2026-07-25", cashier: "Ahmed", till: "Main Till #1", openingFloat: 10000, expectedCash: 31500, actualCash: 31620, difference: 120, shiftTime: "8 hrs 40 mins", status: "Discrepancy" },
    { id: "SH-87", date: "2026-07-24", cashier: "Umar", till: "Main Till #1", openingFloat: 10000, expectedCash: 29800, actualCash: 29800, difference: 0, shiftTime: "8 hrs 5 mins", status: "Balanced" }
  ])

  // UI Interactive States
  const [showCashDropModal, setShowCashDropModal] = useState(false)
  const [showPaidOutModal, setShowPaidOutModal] = useState(false)
  const [showClosingPanel, setShowClosingPanel] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Form States - Cash Drop
  const [dropAmount, setDropAmount] = useState("")
  const [dropReason, setDropReason] = useState("Safe Deposit")
  const [dropPrintReceipt, setDropPrintReceipt] = useState(true)

  // Form States - Paid Out
  const [poAmount, setPoAmount] = useState("")
  const [poPurpose, setPoPurpose] = useState("Petty Cash")
  const [poCustomReason, setPoCustomReason] = useState("")
  const [poManagerPin, setPoManagerPin] = useState("")



  // Discrepancy Matrix
  const [discrepancyReason, setDiscrepancyReason] = useState("Discrepancy under investigation")
  const [discrepancyNotes, setDiscrepancyNotes] = useState("")

  // Shift Close Wizard Steps
  const [closeStep, setCloseStep] = useState(1)
  const [countedCash, setCountedCash] = useState("")
  const [closeManagerPin, setCloseManagerPin] = useState("")
  const [closePrintReport, setClosePrintReport] = useState(true)

  // New Shift Initialization
  const [newOpeningFloat, setNewOpeningFloat] = useState("10000")

  // --- CALCULATE SHIFT METRICS ---
  const salesSummary = useMemo(() => {
    // Expected Sales numbers
    const cashSales = 45800
    const onlineSales = 32400
    const refunds = 1500
    const discounts = 2200
    const totalOrders = 42
    return { cashSales, onlineSales, refunds, discounts, totalOrders }
  }, [])

  const totalCashDrops = useMemo(() => {
    return cashDrops.reduce((acc, drop) => acc + drop.amount, 0)
  }, [cashDrops])

  const totalPaidOuts = useMemo(() => {
    return paidOuts.reduce((acc, po) => acc + po.amount, 0)
  }, [paidOuts])

  const expectedDrawerBalance = useMemo(() => {
    // opening + cash sales - refunds - cash drops - paidouts
    return openingFloat + salesSummary.cashSales - salesSummary.refunds - totalCashDrops - totalPaidOuts
  }, [openingFloat, salesSummary, totalCashDrops, totalPaidOuts])



  // Live Timer ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
      if (isShiftActive) {
        setShiftSeconds(prev => prev + 1)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [isShiftActive])

  // Shift Duration Formatter
  const formattedShiftDuration = useMemo(() => {
    const hrs = Math.floor(shiftSeconds / 3600)
    const mins = Math.floor((shiftSeconds % 3600) / 60)
    const secs = shiftSeconds % 60
    return `${hrs}h ${mins}m ${secs}s`
  }, [shiftSeconds])

  // --- KEYBOARD SHORTCUTS LISTENERS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA"
      
      // ESC - Cancel modals
      if (e.key === "Escape") {
        setShowCashDropModal(false)
        setShowPaidOutModal(false)
        setShowClosingPanel(false)
      }

      if (isInput) return

      // F2 - Search focus
      if (e.key === "F2") {
        e.preventDefault()
        document.getElementById("txSearch")?.focus()
      }
      // F4 - Cash Drop
      if (e.key === "F4") {
        e.preventDefault()
        setShowCashDropModal(true)
      }
      // F5 - Refresh
      if (e.key === "F5") {
        e.preventDefault()
        handleRefresh()
      }
      // F6 - Print Shift Report
      if (e.key === "F6") {
        e.preventDefault()
        handlePrintReport()
      }
      // F8 - Close Shift Panel
      if (e.key === "F8") {
        e.preventDefault()
        setShowClosingPanel(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // --- ACTION HANDLERS ---
  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      // Play brief sound or show alert
    }, 800)
  }

  const handlePrintReport = () => {
    alert(`----------------------------------------\n         SHIFT REPORT SUMMARY\n----------------------------------------\nCashier: ${cashierName} [${employeeId}]\nTill: ${tillName}\nExpected Cash: Rs. ${expectedDrawerBalance.toLocaleString()}\nCash Drops: Rs. ${totalCashDrops.toLocaleString()}\nPaid Outs: Rs. ${totalPaidOuts.toLocaleString()}\nTotal Orders: ${salesSummary.totalOrders}\n----------------------------------------\nStatus: UNCLOSED ACCRUALS PREVIEW`)
  }

  const handleCashDropSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(dropAmount)
    if (!amt || isNaN(amt) || amt <= 0) {
      alert("Please enter a valid cash drop amount.")
      return
    }
    if (amt > expectedDrawerBalance) {
      if (!confirm("Warning: Drop amount exceeds expected register cash. Proceed?")) return
    }

    const newDrop: CashDrop = {
      id: `CD-${cashDrops.length + 1}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amount: amt,
      reason: dropReason,
      destination: dropReason === "Safe Deposit" ? "Safe Deposit" : "Manager Collection",
      printed: dropPrintReceipt
    }

    setCashDrops([newDrop, ...cashDrops])
    setShiftActivities([
      { 
        id: `ACT-${Date.now()}`, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        type: "Cash Drop", 
        description: `Transferred Rs. ${amt.toLocaleString()} (${dropReason})`, 
        severity: "warning" 
      },
      ...shiftActivities
    ])

    setDropAmount("")
    setShowCashDropModal(false)
    alert(`Cash Drop of Rs. ${amt.toLocaleString()} completed successfully.`)
  }

  const handlePaidOutSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(poAmount)
    if (!amt || isNaN(amt) || amt <= 0) {
      alert("Please enter a valid payout amount.")
      return
    }
    if (poManagerPin !== "1234") {
      alert("Invalid Manager Authorization PIN.")
      return
    }

    const purpose = poPurpose === "Custom Reason" ? poCustomReason : poPurpose
    const newPo: PaidOut = {
      id: `PO-${paidOuts.length + 1}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      purpose,
      amount: amt,
      approvedBy: "Ali Manager"
    }

    setPaidOuts([newPo, ...paidOuts])
    setShiftActivities([
      {
        id: `ACT-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: "Paid Out",
        description: `Paid out Rs. ${amt.toLocaleString()} for ${purpose}`,
        severity: "info"
      },
      ...shiftActivities
    ])

    setPoAmount("")
    setPoCustomReason("")
    setPoManagerPin("")
    setShowPaidOutModal(false)
    alert(`Payout of Rs. ${amt.toLocaleString()} approved and recorded.`)
  }

  // Shift Close Submission
  const executeCloseShift = () => {
    if (closeManagerPin !== "1234") {
      alert("Invalid Manager Authorization PIN.")
      return
    }

    const actual = parseFloat(countedCash) || 0
    const diff = actual - expectedDrawerBalance
    
    // Save to history
    const record: ShiftRecord = {
      id: `SH-${shiftHistory.length + 91}`,
      date: new Date().toISOString().split("T")[0],
      cashier: cashierName,
      till: tillName,
      openingFloat,
      expectedCash: expectedDrawerBalance,
      actualCash: actual,
      difference: diff,
      shiftTime: formattedShiftDuration,
      status: diff === 0 ? "Balanced" : "Discrepancy"
    }

    setShiftHistory([record, ...shiftHistory])
    setIsShiftActive(false)
    setShowClosingPanel(false)
    setCloseStep(1)
    setCountedCash("")
    setCloseManagerPin("")
    alert("Shift closed successfully. Current register cleared.")
  }

  const executeOpenShift = () => {
    const floatVal = parseFloat(newOpeningFloat) || 0
    if (floatVal <= 0) {
      alert("Please enter a valid starting float.")
      return
    }
    setOpeningFloat(floatVal)
    setShiftSeconds(0)
    setCashDrops([])
    setPaidOuts([])
    setShiftActivities([
      { id: `ACT-${Date.now()}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: "Shift Started", description: `Shift opened with float Rs. ${floatVal.toLocaleString()}`, severity: "success" }
    ])
    setIsShiftActive(true)
    alert(`Register opened successfully with float Rs. ${floatVal.toLocaleString()}.`)
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">
      
      {/* ====================================================
          HEADER & METADATA BAR
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm relative overflow-hidden">
        {/* Glow indicator */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-primary to-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 font-black text-2xl tracking-tighter">
            TS
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              Cashier & Shift Management
              <span className={`text-[10px] border px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                isShiftActive 
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-500 border-red-500/20'
              }`}>
                {isShiftActive ? "Shift Open" : "Register Closed"}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground font-bold mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Business Day: 6AM–6AM</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>Today: {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              {isShiftActive && (
                <>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span className="tabular-nums font-black text-foreground">Active: {formattedShiftDuration}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button 
            onClick={handleRefresh}
            className={`p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border relative transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh shift counters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isShiftActive ? (
            <>
              <button 
                onClick={() => setShowCashDropModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4 text-orange-500" /> Cash Drop [F4]
              </button>

              <button 
                onClick={() => setShowPaidOutModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
              >
                <DollarSign className="w-4 h-4 text-sky-500" /> Paid Out
              </button>

              <button 
                onClick={handlePrintReport}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
              >
                <Printer className="w-4 h-4" /> Print Preview [F6]
              </button>

              <button 
                onClick={() => setShowClosingPanel(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-black hover:bg-red-600 shadow-md shadow-red-500/10 transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" /> Close Shift [F8]
              </button>
            </>
          ) : (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground font-black mr-2">New Shift Opening Float:</span>
              <div className="relative w-32">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-black">Rs</span>
                <input 
                  type="number" 
                  value={newOpeningFloat} 
                  onChange={(e) => setNewOpeningFloat(e.target.value)} 
                  className="w-full h-8 pl-7 pr-2 rounded-lg bg-secondary border border-border text-xs font-black outline-none"
                />
              </div>
              <button 
                onClick={executeOpenShift}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Open Active Shift
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================
          TOP SUMMARY CARDS (KPI BLOCK)
          ==================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI 1: Today's Accrual Sales */}
        <div className="p-6 bg-card border border-border rounded-3xl shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center border border-border shrink-0 text-emerald-500">
            <BarChart className="w-6 h-6" />
          </div>
          <div className="space-y-1 w-full min-w-0">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Today's Sales</span>
            <h3 className="text-xl font-black text-foreground">Rs. {isShiftActive ? (salesSummary.cashSales + salesSummary.onlineSales).toLocaleString() : 0}</h3>
            <p className="text-[10px] text-muted-foreground font-bold">Total revenue accrued during this shift</p>
          </div>
        </div>

        {/* KPI 2: Orders Count */}
        <div className="p-6 bg-card border border-border rounded-3xl shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center border border-border shrink-0 text-primary">
            <Activity className="w-6 h-6" />
          </div>
          <div className="space-y-1 w-full min-w-0">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Orders Count</span>
            <h3 className="text-xl font-black text-foreground">{isShiftActive ? salesSummary.totalOrders : 0}</h3>
            <p className="text-[10px] text-muted-foreground font-bold">Total transactions processed</p>
          </div>
        </div>

        {/* KPI 3: Drawer Cash Balance */}
        <div className="p-6 bg-card border border-border rounded-3xl shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center border border-border shrink-0 text-orange-500">
            <Coins className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Expected Cash in Till</span>
            <h3 className="text-xl font-black text-primary">Rs. {isShiftActive ? expectedDrawerBalance.toLocaleString() : 0}</h3>
            <p className="text-[10px] text-muted-foreground font-semibold leading-tight">
              Opening Float: <span className="text-foreground font-bold">Rs. {isShiftActive ? openingFloat.toLocaleString() : 0}</span>
            </p>
          </div>
        </div>

      </div>



      {/* Section: Recent Shift Transactions table */}
      <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Recent Shift Transactions</h3>
            <p className="text-[10px] text-muted-foreground font-bold mt-0.5">Logs of orders processed in this counter till register.</p>
          </div>
          <div className="relative w-48 shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-3.5 h-3.5" /></span>
            <input 
              id="txSearch"
              type="text" 
              placeholder="Search transaction [F2]..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-2 rounded-lg bg-secondary border border-border text-xs outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-[10px] uppercase font-black tracking-wider">
                <th className="py-2.5">Time</th>
                <th className="py-2.5">Order ID</th>
                <th className="py-2.5">Customer</th>
                <th className="py-2.5">Payment</th>
                <th className="py-2.5">Amount</th>
                <th className="py-2.5">Cashier</th>
                <th className="py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {transactions.filter(t => !searchTerm || t.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) || t.customer.toLowerCase().includes(searchTerm.toLowerCase())).map((tx, idx) => (
                <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-2.5 text-muted-foreground">{tx.time}</td>
                  <td className="py-2.5 text-foreground">{tx.orderNo}</td>
                  <td className="py-2.5 text-foreground">{tx.customer}</td>
                  <td className="py-2.5">
                    <span className="text-[9px] bg-secondary border border-border px-2 py-0.5 rounded font-black text-foreground">{tx.paymentMethod}</span>
                  </td>
                  <td className="py-2.5 text-foreground">Rs. {tx.amount.toLocaleString()}</td>
                  <td className="py-2.5 text-muted-foreground">{tx.cashier}</td>
                  <td className="py-2.5 text-right">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                      tx.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      tx.status === 'Refunded' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>




      {/* ====================================================
          MODAL: CASH DROP
          ==================================================== */}
      <AnimatePresence>
        {showCashDropModal && (
          <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative overflow-hidden"
            >
              <button 
                onClick={() => setShowCashDropModal(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-base font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-orange-500" /> Perform Safe Cash Drop
              </h3>
              <p className="text-xs text-muted-foreground font-bold">Transfer excess register notes to safe storage vault or manager cash box.</p>

              <form onSubmit={handleCashDropSubmit} className="space-y-4 text-xs font-bold">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Amount (Rs)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs</span>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={dropAmount}
                      onChange={(e) => setDropAmount(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-xl bg-secondary border border-border text-xs font-black outline-none"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 pt-1.5">
                    {[500, 1000, 2000, 5000, 10000].map(val => (
                      <button 
                        type="button" 
                        key={val} 
                        onClick={() => setDropAmount(val.toString())}
                        className="py-1 bg-secondary hover:bg-border rounded text-[10px] font-black border border-border/50 text-foreground"
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Drop Destination / Purpose</label>
                  <select 
                    value={dropReason}
                    onChange={(e) => setDropReason(e.target.value)}
                    className="w-full h-10 px-2 rounded-xl bg-secondary border border-border text-xs font-bold outline-none"
                  >
                    <option value="Safe Deposit">Safe Deposit Vault</option>
                    <option value="Manager Collection">Manager Collection</option>
                    <option value="Main Till Drop">Transfer to Main Counter</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 bg-secondary/40 border border-border rounded-xl">
                  <span className="text-muted-foreground">Print Thermal receipt immediately</span>
                  <input 
                    type="checkbox" 
                    checked={dropPrintReceipt}
                    onChange={(e) => setDropPrintReceipt(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowCashDropModal(false)}
                    className="h-10 bg-secondary border border-border hover:bg-border rounded-xl font-black text-xs uppercase"
                  >
                    Cancel [Esc]
                  </button>
                  <button 
                    type="submit"
                    className="h-10 bg-primary text-white rounded-xl font-black text-xs uppercase hover:bg-primary/95 shadow-md shadow-primary/10"
                  >
                    Confirm Drop
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================
          MODAL: PAID OUT EXPENSE
          ==================================================== */}
      <AnimatePresence>
        {showPaidOutModal && (
          <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative overflow-hidden"
            >
              <button 
                onClick={() => setShowPaidOutModal(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-base font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-sky-500" /> Record Paid Out Expense
              </h3>
              <p className="text-xs text-muted-foreground font-bold">Withdraw cash from the active till drawer for petty expenses (requires approval).</p>

              <form onSubmit={handlePaidOutSubmit} className="space-y-4 text-xs font-bold">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Amount (Rs)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs</span>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={poAmount}
                      onChange={(e) => setPoAmount(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-xl bg-secondary border border-border text-xs font-black outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Withdrawal Purpose</label>
                  <select 
                    value={poPurpose}
                    onChange={(e) => setPoPurpose(e.target.value)}
                    className="w-full h-10 px-2 rounded-xl bg-secondary border border-border text-xs font-bold outline-none"
                  >
                    <option value="Cleaning Supplies">Cleaning Supplies</option>
                    <option value="Maintenance / Repairs">Maintenance / Repairs</option>
                    <option value="Kitchen raw supplies emergency">Kitchen Raw Supplies Emergency</option>
                    <option value="Petty Cash Refill">Petty Cash Refill</option>
                    <option value="Custom Reason">Custom Reason (Specify Below)</option>
                  </select>
                </div>

                {poPurpose === "Custom Reason" && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black text-muted-foreground">Specify Custom Purpose</label>
                    <input 
                      type="text"
                      placeholder="Enter specific purpose..."
                      value={poCustomReason}
                      onChange={(e) => setPoCustomReason(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-xs font-black outline-none"
                      required
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-muted-foreground">Manager Auth PIN (Demo: 1234)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Key className="w-3.5 h-3.5" /></span>
                    <input 
                      type="password"
                      placeholder="••••"
                      maxLength={4}
                      value={poManagerPin}
                      onChange={(e) => setPoManagerPin(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-xl bg-secondary border border-border text-xs font-black outline-none tracking-widest text-center"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowPaidOutModal(false)}
                    className="h-10 bg-secondary border border-border hover:bg-border rounded-xl font-black text-xs uppercase"
                  >
                    Cancel [Esc]
                  </button>
                  <button 
                    type="submit"
                    className="h-10 bg-primary text-white rounded-xl font-black text-xs uppercase hover:bg-primary/95 shadow-md shadow-primary/10"
                  >
                    Approve & Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================
          DRAWER: SHIFT CLOSING PANEL
          ==================================================== */}
      <AnimatePresence>
        {showClosingPanel && (
          <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex justify-end">
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-card border-l border-border w-full max-w-xl h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto custom-scrollbar"
            >
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <h3 className="text-base font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" /> Shift Closing Protocol
                  </h3>
                  <button 
                    onClick={() => {
                      setShowClosingPanel(false)
                      setCloseStep(1)
                    }}
                    className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Steps indicator */}
                <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground uppercase border-b border-border/50 pb-2">
                  <span className={closeStep >= 1 ? "text-primary" : ""}>1. Count</span>
                  <span>&rarr;</span>
                  <span className={closeStep >= 2 ? "text-primary" : ""}>2. Payments</span>
                  <span>&rarr;</span>
                  <span className={closeStep >= 3 ? "text-primary" : ""}>3. Drops</span>
                  <span>&rarr;</span>
                  <span className={closeStep >= 4 ? "text-primary" : ""}>4. Audit</span>
                  <span>&rarr;</span>
                  <span className={closeStep >= 5 ? "text-primary" : ""}>5. PIN Auth</span>
                </div>

                {/* STEP 1: COUNT CASH */}
                {closeStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-black text-sm text-foreground">Step 1: Count physical register cash</h4>
                      <p className="text-xs text-muted-foreground font-bold mt-1">
                        Use the Denominations counts in the page calculator to assist, then input the total actual cash counted in the drawer.
                      </p>
                    </div>

                    <div className="space-y-2 text-xs font-bold">
                      <label className="text-muted-foreground uppercase text-[10px] block">Actual Counted Cash (Rs)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs</span>
                        <input 
                          type="number"
                          placeholder="0.00"
                          value={countedCash}
                          onChange={(e) => setCountedCash(e.target.value)}
                          className="w-full h-11 pl-8 pr-3 rounded-xl bg-secondary border border-border text-sm font-black outline-none"
                        />
                      </div>
                    </div>

                    <div className="bg-secondary/40 border border-border p-3 rounded-2xl flex justify-between items-center text-xs font-bold text-muted-foreground">
                      <span>Expected Accrual Balance:</span>
                      <span className="text-foreground font-black">Rs. {expectedDrawerBalance.toLocaleString()}</span>
                    </div>

                    <button 
                      onClick={() => {
                        const amt = parseFloat(countedCash)
                        if (isNaN(amt) || amt < 0) {
                          alert("Please enter a valid count number.")
                          return
                        }
                        setCloseStep(2)
                      }}
                      className="h-10 w-full bg-primary text-white font-black text-xs uppercase rounded-xl hover:bg-primary/95 shadow-md shadow-primary/10"
                    >
                      Verify Payments &rarr;
                    </button>
                  </div>
                )}

                {/* STEP 2: VERIFY PAYMENTS */}
                {closeStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-black text-sm text-foreground">Step 2: Verify channel sales allocations</h4>
                      <p className="text-xs text-muted-foreground font-bold mt-1">
                        Confirm card reader batch closures matches credit card records.
                      </p>
                    </div>

                    <div className="space-y-2 text-xs font-bold border border-border rounded-2xl p-4 bg-secondary/20">
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Credit Card Sales:</span>
                        <span className="text-foreground">Rs. 8,500</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Meezan Bank Transfers:</span>
                        <span className="text-foreground">Rs. 12,400</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">EasyPaisa + JazzCash Wallet:</span>
                        <span className="text-foreground">Rs. 9,000</span>
                      </div>
                      <div className="flex justify-between py-1 font-black">
                        <span className="text-muted-foreground">Total Online Payments Expected:</span>
                        <span className="text-primary">Rs. 29,900</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setCloseStep(1)}
                        className="h-10 bg-secondary border border-border hover:bg-border rounded-xl font-black text-xs uppercase"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => setCloseStep(3)}
                        className="h-10 bg-primary text-white font-black text-xs uppercase rounded-xl hover:bg-primary/95 shadow-md shadow-primary/10"
                      >
                        Verify Cash Drops &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: VERIFY CASH DROP */}
                {closeStep === 3 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-black text-sm text-foreground">Step 3: Confirm Drop submissions</h4>
                      <p className="text-xs text-muted-foreground font-bold mt-1">
                        Verify that the physical cash drop receipts correspond to safe drops in this shift.
                      </p>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {cashDrops.map(drop => (
                        <div key={drop.id} className="p-3 bg-secondary/40 border border-border rounded-2xl flex justify-between items-center text-xs font-bold">
                          <div>
                            <span className="text-foreground block font-black">Rs. {drop.amount.toLocaleString()}</span>
                            <span className="text-[9px] text-muted-foreground mt-0.5 block">{drop.reason} • {drop.time}</span>
                          </div>
                          <span className="text-[9px] bg-secondary border border-border px-2 py-0.5 rounded font-black text-foreground">{drop.destination}</span>
                        </div>
                      ))}
                      <div className="p-3 bg-secondary/60 border border-border rounded-2xl flex justify-between text-xs font-black">
                        <span>Total Registered Drops:</span>
                        <span className="text-orange-500">Rs. {totalCashDrops.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setCloseStep(2)}
                        className="h-10 bg-secondary border border-border hover:bg-border rounded-xl font-black text-xs uppercase"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => setCloseStep(4)}
                        className="h-10 bg-primary text-white font-black text-xs uppercase rounded-xl hover:bg-primary/95 shadow-md shadow-primary/10"
                      >
                        Review Audit Difference &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: AUDIT DIFFERENCE */}
                {closeStep === 4 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-black text-sm text-foreground">Step 4: Shift accounting audit preview</h4>
                      <p className="text-xs text-muted-foreground font-bold mt-1">
                        Check for any shortage or overage before finalize closure.
                      </p>
                    </div>

                    <div className="space-y-3 text-xs font-bold border border-border rounded-2xl p-4 bg-secondary/20">
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Expected Drawer Balance:</span>
                        <span className="text-foreground font-black">Rs. {expectedDrawerBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Actual Counted cash:</span>
                        <span className="text-foreground font-black">Rs. {parseFloat(countedCash || "0").toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between py-1 font-black">
                        <span className="text-muted-foreground">Calculated Difference:</span>
                        <span className={`text-sm ${
                          (parseFloat(countedCash || "0") - expectedDrawerBalance) === 0 ? "text-emerald-500" :
                          (parseFloat(countedCash || "0") - expectedDrawerBalance) > 0 ? "text-emerald-500" : "text-red-500"
                        }`}>
                          {(parseFloat(countedCash || "0") - expectedDrawerBalance) === 0 ? "Rs. 0 (Balanced)" :
                           (parseFloat(countedCash || "0") - expectedDrawerBalance) > 0 ? `+Rs. ${(parseFloat(countedCash || "0") - expectedDrawerBalance).toLocaleString()} (OVERAGE)` :
                           `-Rs. ${Math.abs(parseFloat(countedCash || "0") - expectedDrawerBalance).toLocaleString()} (SHORTAGE)`
                          }
                        </span>
                      </div>
                    </div>

                    {(parseFloat(countedCash || "0") - expectedDrawerBalance) !== 0 && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-3">
                        <h4 className="text-[10px] uppercase font-black text-red-500 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" /> Discrepancy Action Required
                        </h4>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-black text-muted-foreground">Reason for Discrepancy</label>
                          <select 
                            value={discrepancyReason}
                            onChange={(e) => setDiscrepancyReason(e.target.value)}
                            className="w-full h-8 px-2 rounded-lg bg-card border border-border text-xs font-bold outline-none"
                          >
                            <option>Discrepancy under investigation</option>
                            <option>Cashier counted incorrectly</option>
                            <option>Unrecorded petty cash payout</option>
                            <option>Incorrect change given to customer</option>
                            <option>System technical error</option>
                            <option>Suspected theft</option>
                          </select>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-black text-muted-foreground">Manager Notes</label>
                          <textarea 
                            value={discrepancyNotes}
                            onChange={(e) => setDiscrepancyNotes(e.target.value)}
                            placeholder="Add explanatory notes..."
                            className="w-full h-16 p-2 rounded-lg bg-card border border-border text-xs resize-none outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setCloseStep(3)}
                        className="h-10 bg-secondary border border-border hover:bg-border rounded-xl font-black text-xs uppercase"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => setCloseStep(5)}
                        className="h-10 bg-primary text-white font-black text-xs uppercase rounded-xl hover:bg-primary/95 shadow-md shadow-primary/10"
                      >
                        Enter PIN Auth &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5: PIN AUTH & SUBMIT */}
                {closeStep === 5 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-black text-sm text-foreground">Step 5: Manager override PIN authorization</h4>
                      <p className="text-xs text-muted-foreground font-bold mt-1">
                        Requires a valid Manager Override PIN signature to finalize register session closing (PIN: 1234).
                      </p>
                    </div>

                    <div className="space-y-2 text-xs font-bold">
                      <label className="text-muted-foreground uppercase text-[10px] block">Manager Override PIN</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Key className="w-3.5 h-3.5" /></span>
                        <input 
                          type="password"
                          placeholder="••••"
                          maxLength={4}
                          value={closeManagerPin}
                          onChange={(e) => setCloseManagerPin(e.target.value)}
                          className="w-full h-11 pl-8 pr-3 rounded-xl bg-secondary border border-border text-sm font-black outline-none tracking-widest text-center"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-secondary/40 border border-border rounded-xl text-xs font-bold">
                      <span className="text-muted-foreground">Print shift report dynamically</span>
                      <input 
                        type="checkbox" 
                        checked={closePrintReport}
                        onChange={(e) => setClosePrintReport(e.target.checked)}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setCloseStep(4)}
                        className="h-10 bg-secondary border border-border hover:bg-border rounded-xl font-black text-xs uppercase"
                      >
                        Back
                      </button>
                      <button 
                        onClick={executeCloseShift}
                        className="h-10 bg-red-500 text-white font-black text-xs uppercase rounded-xl hover:bg-red-600 shadow-md shadow-red-500/10"
                      >
                        Close Register Session
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Accruals Report Preview at bottom */}
              <div className="mt-6 pt-6 border-t border-border space-y-3">
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Accrual Report Summary</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-bold">
                  <div className="p-3 bg-secondary/30 border border-border rounded-2xl">
                    <span className="text-muted-foreground block text-[9px] uppercase">Orders Count</span>
                    <span className="text-foreground">{salesSummary.totalOrders}</span>
                  </div>
                  <div className="p-3 bg-secondary/30 border border-border rounded-2xl">
                    <span className="text-muted-foreground block text-[9px] uppercase">Total Rev</span>
                    <span className="text-foreground">Rs. {(salesSummary.cashSales + salesSummary.onlineSales).toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-secondary/30 border border-border rounded-2xl">
                    <span className="text-muted-foreground block text-[9px] uppercase">Total Cash</span>
                    <span className="text-foreground">Rs. {salesSummary.cashSales.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-secondary/30 border border-border rounded-2xl">
                    <span className="text-muted-foreground block text-[9px] uppercase">Discounts</span>
                    <span className="text-foreground">Rs. {salesSummary.discounts.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
