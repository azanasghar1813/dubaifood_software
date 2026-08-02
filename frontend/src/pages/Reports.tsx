import { useState, useEffect, useMemo, useRef } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts'
import {
  Download, Calendar, Search, RefreshCw, Printer,
  ChevronRight
} from "lucide-react"
import { useOrderStore } from "../store/orderStore"
import { formatCurrency } from "../utils/currency"
import { motion } from "framer-motion"

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e']

export default function Reports() {
  const { orders } = useOrderStore()

  // State Management
  const [activeTab, setActiveTab] = useState<string>("Dashboard Summary")
  const [timeRange, setTimeRange] = useState<string>("Today")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCashier, setFilterCashier] = useState("All")
  const [filterPayment, setFilterPayment] = useState("All")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Product Sales State
  const [productSortBy, setProductSortBy] = useState<"qty" | "rev">("qty")
  const [productCategoryFilter, setProductCategoryFilter] = useState("All")
  const [productCurrentPage, setProductCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  // Orders Report State
  const [orderChartTimeView, setOrderChartTimeView] = useState<"Hour" | "Day" | "Week" | "Month">("Hour")

  const searchRef = useRef<HTMLInputElement>(null)

  // Reset page when filters change
  useEffect(() => {
    setProductCurrentPage(1)
  }, [productCategoryFilter, searchQuery, productSortBy])

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "SELECT"

      // F2 Focus Search
      if (e.key === "F2") {
        e.preventDefault()
        searchRef.current?.focus()
      }

      // Ctrl + E: Export
      if (e.ctrlKey && e.key === "e") {
        e.preventDefault()
        handleExportData()
      }

      // Ctrl + P: Print Report
      if (e.ctrlKey && e.key === "p" && !isInput) {
        e.preventDefault()
        window.print()
      }

      // Ctrl + R: Refresh
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault()
        handleRefresh()
      }

      // Esc: Reset filters
      if (e.key === "Escape" && !isInput) {
        e.preventDefault()
        setSearchQuery("")
        setFilterCashier("All")
        setFilterPayment("All")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const handleExportData = () => {
    alert(`Exporting "${activeTab}" as CSV spreadsheet report.`)
  }

  // Dynamic calculations based on live orders store
  const hasData = timeRange === "Today"

  const reportStats = useMemo(() => {
    if (!hasData) {
      return {
        totalOrdersCount: 0, grossSales: 0, netSales: 0, totalTax: 0, totalService: 0,
        totalDiscount: 0, totalDelivery: 0, paidCount: 0, unpaidCount: 0, refundsCount: 0, cashSales: 0,
        digitalSales: 0, avgBill: 0, netEstimatedProfit: 0
      }
    }

    const totalOrdersCount = orders.length
    const grossSales = orders.reduce((sum, o) => sum + o.total, 0)
    const netSales = orders.reduce((sum, o) => sum + o.subtotal, 0)
    const totalTax = orders.reduce((sum, o) => sum + o.tax, 0)
    const totalService = orders.reduce((sum, o) => sum + o.serviceCharge, 0)
    const totalDiscount = orders.reduce((sum, o) => sum + o.discount, 0)
    const totalDelivery = orders.reduce((sum, o) => {
      const grandTotal = o.total - (o.roundOffAdjustment || 0)
      const delivery = grandTotal - Math.max(0, o.subtotal - o.discount) - o.tax - o.serviceCharge
      return sum + Math.max(0, Math.round(delivery))
    }, 0)

    const paidCount = orders.filter(o => o.paymentStatus === "Paid").length
    const unpaidCount = orders.filter(o => o.paymentStatus === "Unpaid").length
    const refundsCount = orders.filter(o => o.paymentStatus === "Refunded").length

    const cashSales = orders.filter(o => (o.payments?.[0]?.method || "Cash") === "Cash").reduce((s, o) => s + o.total, 0)
    const digitalSales = grossSales - cashSales
    const avgBill = totalOrdersCount > 0 ? Math.round(grossSales / totalOrdersCount) : 0
    const netEstimatedProfit = Math.round(netSales * 0.45)

    return {
      totalOrdersCount, grossSales, netSales, totalTax, totalService,
      totalDiscount, totalDelivery, paidCount, unpaidCount, refundsCount, cashSales,
      digitalSales, avgBill, netEstimatedProfit
    }
  }, [orders, hasData])


  // Product Sales Real Data
  const productSalesData = useMemo(() => {
    if (!hasData) return []

    const itemMap = new Map<string, { name: string, cat: string, sold: number, rev: number }>()

    orders.forEach(order => {
      if (order.status === 'Cancelled') return
      order.items.forEach(item => {
        const existing = itemMap.get(item.id)
        if (existing) {
          existing.sold += item.quantity
          existing.rev += item.price * item.quantity
        } else {
          itemMap.set(item.id, {
            name: item.name,
            cat: item.category || 'Other',
            sold: item.quantity,
            rev: item.price * item.quantity
          })
        }
      })
    })

    let data = Array.from(itemMap.values())

    // Category mapping for standard pills if needed
    const mapCategory = (cat: string) => {
      const lower = cat.toLowerCase()
      if (lower.includes("burger") || lower.includes("pizza") || lower.includes("sandwich") || lower.includes("broast") || lower.includes("appetizer") || lower.includes("fast food")) return "Fast Food"
      if (lower.includes("chicken") || lower.includes("bbq") || lower.includes("karahi") || lower.includes("restaurant")) return "Restaurant"
      if (lower.includes("deal") || lower.includes("combo")) return "Deals"
      if (lower.includes("drink") || lower.includes("beverage") || lower.includes("shake")) return "Drinks"
      return "Other"
    }

    if (productCategoryFilter !== "All") {
      data = data.filter(d => mapCategory(d.cat) === productCategoryFilter || d.cat === productCategoryFilter)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      data = data.filter(d => d.name.toLowerCase().includes(q) || d.cat.toLowerCase().includes(q))
    }

    data.sort((a, b) => productSortBy === "qty" ? b.sold - a.sold : b.rev - a.rev)
    const totalRev = data.reduce((sum, item) => sum + item.rev, 0)
    return data.map(d => ({ ...d, share: totalRev ? Math.round((d.rev / totalRev) * 100) : 0 }))
  }, [orders, productSortBy, searchQuery, productCategoryFilter, hasData])

  void filterPayment
  void currentTime

  // Category Sales Data
  const categorySalesData = useMemo(() => {
    const map = new Map<string, { cat: string, sold: number, rev: number }>()
    productSalesData.forEach(p => {
      const cName = p.cat
      const existing = map.get(cName)
      if (existing) {
        existing.sold += p.sold
        existing.rev += p.rev
      } else {
        map.set(cName, { cat: cName, sold: p.sold, rev: p.rev })
      }
    })
    const data = Array.from(map.values()).sort((a, b) => b.rev - a.rev)
    const totalRev = data.reduce((s, d) => s + d.rev, 0)
    return data.map(d => ({ ...d, share: totalRev ? Math.round((d.rev / totalRev) * 100) : 0 }))
  }, [productSalesData])

  // Deal Sales Data
  const dealSalesData = useMemo(() => {
    return productSalesData
      .filter(p => p.cat === 'Deals' || p.name.toLowerCase().includes('combo') || p.name.toLowerCase().includes('deal'))
      .map(d => {
        const discountCost = Math.round(d.rev * 0.2) // Mock 20% average discount given on deals vs à la carte
        return { ...d, discountCost, netContribution: d.rev - discountCost }
      })
  }, [productSalesData])

  // Orders Report Specific Data
  const orderReportStats = useMemo(() => {
    let completed = 0, preparing = 0, ready = 0, cancelled = 0, edited = 0
    orders.forEach(o => {
      if (o.status === 'Completed') completed++
      if (o.kitchenStatus === 'Preparing') preparing++
      if (o.kitchenStatus === 'Ready') ready++
      if (o.status === 'Cancelled') cancelled++
      if (o.timeline && o.timeline.some(t => t.event === 'Order Edited')) edited++
    })
    return {
      total: orders.length,
      completed, preparing, ready, cancelled, edited
    }
  }, [orders])

  const orderVolumeChartData = useMemo(() => {
    const map = new Map<string, number>()
    orders.forEach(o => {
      const date = new Date(o.timestamp)
      let key = ""
      if (orderChartTimeView === 'Hour') {
        key = `${date.getHours().toString().padStart(2, '0')}:00`
      } else if (orderChartTimeView === 'Day') {
        key = date.toLocaleDateString(undefined, { weekday: 'short' })
      } else if (orderChartTimeView === 'Week') {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
        const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
        key = `Week ${week}`
      } else {
        key = date.toLocaleDateString(undefined, { month: 'short' })
      }
      map.set(key, (map.get(key) || 0) + 1)
    })
    
    let data = Array.from(map.entries()).map(([time, count]) => ({ time, count }))
    if (orderChartTimeView === 'Hour') {
      data.sort((a, b) => parseInt(a.time) - parseInt(b.time))
    }
    return data.length > 0 ? data : [{ time: 'No Data', count: 0 }]
  }, [orders, orderChartTimeView])

  // Order Types Data
  const orderTypeData = useMemo(() => {
    let dineIn = 0, takeaway = 0, delivery = 0
    orders.forEach(o => {
      if (o.orderType === 'Dine In') dineIn++
      else if (o.orderType === 'Takeaway') takeaway++
      else if (o.orderType === 'Delivery') delivery++
    })
    return [
      { name: 'Dine In', value: dineIn, color: '#f97316' },
      { name: 'Takeaway', value: takeaway, color: '#3b82f6' },
      { name: 'Delivery', value: delivery, color: '#10b981' }
    ]
  }, [orders])

  // Sidebar navigation links
  const sidebarLinks = [
    "Dashboard Summary", "Orders Report",
    "Product Sales", "Category Sales", "Deal Sales"
  ]

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">

      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Business Intelligence Center
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Reports</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Business Day: 6AM–6AM
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefresh}
            className={`p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border relative transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh analytics data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportData}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" /> Print PDF Report
          </button>
        </div>
      </div>

      {/* ====================================================
          TOP FILTER BAR
          ==================================================== */}
      <div className="flex flex-col md:flex-row gap-4 p-4 bg-card border border-border rounded-3xl shadow-sm items-center justify-between">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">Time:</span>
            <div className="flex bg-secondary/50 p-1 rounded-lg border border-border/50">
              {["Today", "Yesterday", "This Week"].map(opt => (
                <button
                  key={opt}
                  onClick={() => setTimeRange(opt)}
                  className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${timeRange === opt ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="h-6 w-px bg-border hidden md:block"></div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">Cashier:</span>
            <select
              value={filterCashier}
              onChange={(e) => setFilterCashier(e.target.value)}
              className="h-8 rounded-lg bg-secondary border border-border text-[10px] font-bold px-3 focus:outline-none cursor-pointer"
            >
              <option value="All">All Cashiers</option>
              <option value="Ahmed">Ahmed</option>
              <option value="Umar">Umar</option>
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-3.5 h-3.5" /></span>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search report data... (F2)"
            className="w-full h-8 pl-9 pr-3 rounded-lg bg-secondary border border-border outline-none text-[10px] font-bold focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* ====================================================
          REPORT LAYOUT (LEFT SIDEBAR NAVIGATION, RIGHT MAIN PANEL)
          ==================================================== */}
      <div className="grid grid-cols-12 gap-6">

        {/* Navigation Sidebar */}
        <div className="col-span-12 lg:col-span-3 space-y-2">
          <div className="p-4 bg-card border border-border rounded-3xl shadow-sm">
            <span className="text-[9px] uppercase font-black text-muted-foreground tracking-wider mb-3 block pl-2">Report Navigation</span>
            <nav className="space-y-1">
              {sidebarLinks.map(link => {
                const isActive = activeTab === link
                return (
                  <button
                    key={link}
                    onClick={() => setActiveTab(link)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${isActive
                      ? 'bg-primary text-white shadow shadow-primary/15'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                  >
                    <span>{link}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Main Analytics Panel */}
        <div className="col-span-12 lg:col-span-9 space-y-6">

          {/* Active Tab View: Dashboard Summary */}
          {activeTab === "Dashboard Summary" && (
            !hasData ? (
              <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col items-center justify-center min-h-[400px]">
                <Calendar className="w-12 h-12 mb-4 opacity-20" />
                <h4 className="text-xl font-black text-foreground uppercase tracking-wide">No sales in this period</h4>
                <p className="text-sm font-bold text-muted-foreground mt-2 max-w-sm mx-auto">
                  There is no data available for {timeRange}.
                </p>
              </div>
            ) : (
              <>
                {/* Dynamic summary totals cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Today's Gross Sales", val: `Rs. ${formatCurrency(reportStats.grossSales)}`, sub: "Total Sale", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25" },
                    { label: "Today's Net Sales", val: `Rs. ${formatCurrency(reportStats.netSales)}`, sub: "Excludes service & delivery charges", color: "text-blue-500 bg-blue-500/10 border-blue-500/25" },
                    { label: "Today's Service Charges", val: `Rs. ${formatCurrency(reportStats.totalService)}`, sub: "Dine-in services", color: "text-amber-500 bg-amber-500/10 border-amber-500/25" },
                    { label: "Today's Delivery Charges", val: `Rs. ${formatCurrency(reportStats.totalDelivery)}`, sub: "Delivery fees", color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/25" }
                  ].map((card, i) => (
                    <div key={i} className="p-5 bg-card border border-border rounded-[2rem] shadow-sm flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{card.label}</span>
                        <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight mt-3">{card.val}</h3>
                      </div>
                      <span className={`text-[9px] font-bold mt-3 px-2 py-0.5 rounded border w-fit ${card.color}`}>{card.sub}</span>
                    </div>
                  ))}
                </div>

                {/* Item Velocity Leaderboard */}
                <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Item Velocity Leaderboard</h3>
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    {(() => {
                      const topItems = [...productSalesData].sort((a, b) => b.sold - a.sold).slice(0, 7)
                      const maxSold = topItems.length > 0 ? topItems[0].sold : 1

                      return (
                        <div className="relative w-full h-[320px]">
                          {topItems.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-bold">
                              No items sold yet.
                            </div>
                          ) : (
                            topItems.map((item, idx) => {
                              const barColor = COLORS[idx % COLORS.length]
                              const widthPercent = Math.max((item.sold / maxSold) * 100, 2)

                              return (
                                <motion.div
                                  key={item.name}
                                  layout
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0, y: idx * 44 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                                  className="absolute left-0 right-0 flex items-center h-10 w-full"
                                >
                                  <div className="w-6 flex-shrink-0 text-center font-black text-muted-foreground text-xs">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 ml-2 relative h-full flex items-center">
                                    <motion.div
                                      className="absolute left-0 h-full rounded-r-xl rounded-l-md opacity-20"
                                      style={{ backgroundColor: barColor }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${widthPercent}%` }}
                                      transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                    />
                                    <motion.div
                                      className="absolute left-0 h-full border-l-4 rounded-l-md"
                                      style={{ borderColor: barColor, backgroundColor: "transparent" }}
                                    />
                                    <div className="relative z-10 flex justify-between w-full px-3 items-center">
                                      <span className="text-sm font-black text-foreground truncate max-w-[200px]">{item.name}</span>
                                      <span className="text-xs font-bold whitespace-nowrap ml-4" style={{ color: barColor }}>
                                        {item.sold} <span className="opacity-75">sold</span>
                                      </span>
                                    </div>
                                  </div>
                                </motion.div>
                              )
                            })
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Fast Food vs Restaurant Sales Split */}
                  <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-4">Sales Split</h3>
                    <div className="space-y-4 my-auto">
                      <div className="p-4 bg-orange-500/10 border border-orange-500/25 rounded-2xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-orange-500 font-bold uppercase">Fast Food</span>
                          <p className="text-xl md:text-2xl font-black text-foreground mt-1">Rs. {formatCurrency(reportStats.grossSales * 0.65)}</p>
                        </div>
                        <span className="text-sm font-bold text-orange-500 bg-orange-500/20 px-3 py-1.5 rounded-lg">65%</span>
                      </div>
                      <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-2xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-blue-500 font-bold uppercase">Restaurant</span>
                          <p className="text-xl md:text-2xl font-black text-foreground mt-1">Rs. {formatCurrency(reportStats.grossSales * 0.35)}</p>
                        </div>
                        <span className="text-sm font-bold text-blue-500 bg-blue-500/20 px-3 py-1.5 rounded-lg">35%</span>
                      </div>
                    </div>
                  </div>

                  {/* Category Split Pie Chart */}
                  <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col justify-center">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-4">Category Breakdown</h3>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categorySalesData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="rev"
                            nameKey="cat"
                          >
                            {categorySalesData.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => `Rs. ${formatCurrency(value as number)}`}
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold' }}
                          />
                          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: 'hsl(var(--foreground))' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Recently Sold Items List */}
                <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm mt-6">
                  <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-4">Recently Sold Items</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-secondary/50 border-b border-border">
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Item Name</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Category</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Qty</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Amount (Rs)</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {(() => {
                          const recentItems = []
                          for (const o of orders) {
                            for (const item of o.items) {
                              recentItems.push({
                                name: item.name,
                                cat: item.category || 'Other',
                                qty: item.quantity,
                                price: item.price * item.quantity,
                                time: o.timestamp
                              })
                            }
                          }
                          const topRecent = recentItems.reverse().slice(0, 10)

                          if (topRecent.length === 0) {
                            return <tr><td colSpan={5} className="p-8 text-center text-muted-foreground font-bold">No recent items.</td></tr>
                          }

                          return topRecent.map((item, idx) => (
                            <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                              <td className="p-4 text-sm font-black text-foreground">{item.name}</td>
                              <td className="p-4 text-xs font-bold text-muted-foreground">{item.cat}</td>
                              <td className="p-4 text-sm font-black text-foreground text-right">{item.qty}</td>
                              <td className="p-4 text-sm font-black text-primary text-right">{formatCurrency(item.price)}</td>
                              <td className="p-4 text-xs font-bold text-muted-foreground text-right">{item.time}</td>
                            </tr>
                          ))
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )
          )}

          {/* Active Tab View: Sales & Tax Report */}
          {activeTab === "Sales Report" && (
            !hasData ? (
              <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col items-center justify-center min-h-[400px]">
                <Calendar className="w-12 h-12 mb-4 opacity-20" />
                <h4 className="text-xl font-black text-foreground uppercase tracking-wide">No sales in this period</h4>
              </div>
            ) : (
              <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm space-y-6">
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Sales & Tax breakdown</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between p-3 bg-secondary/40 border border-border rounded-xl font-bold text-xs">
                      <span className="text-muted-foreground">Gross Sales Today:</span>
                      <span className="text-foreground">Rs. {formatCurrency(reportStats.grossSales)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-secondary/40 border border-border rounded-xl font-bold text-xs">
                      <span className="text-muted-foreground">Net Sales (Excl Tax):</span>
                      <span className="text-foreground">Rs. {formatCurrency(reportStats.netSales)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-secondary/40 border border-border rounded-xl font-bold text-xs">
                      <span className="text-muted-foreground">GST Tax Collected (16%):</span>
                      <span className="text-foreground">Rs. {formatCurrency(reportStats.totalTax)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between p-3 bg-secondary/40 border border-border rounded-xl font-bold text-xs">
                      <span className="text-muted-foreground">Discounts Given:</span>
                      <span className="text-red-500">Rs. {formatCurrency(reportStats.totalDiscount)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-secondary/40 border border-border rounded-xl font-bold text-xs">
                      <span className="text-muted-foreground">Refund Claims Processed:</span>
                      <span className="text-red-500">Rs. {formatCurrency(reportStats.refundsCount * 1200)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl font-bold text-xs">
                      <span className="text-emerald-500">Net Estimated Profit:</span>
                      <span className="text-emerald-500">Rs. {formatCurrency(Math.round(reportStats.netSales * 0.45))}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Active Tab View: Product Sales */}
          {activeTab === "Product Sales" && (
            !hasData ? (
              <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col items-center justify-center min-h-[400px]">
                <Calendar className="w-12 h-12 mb-4 opacity-20" />
                <h4 className="text-xl font-black text-foreground uppercase tracking-wide">No sales in this period</h4>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-border p-4 rounded-3xl shadow-sm mb-6">
                  <div className="flex flex-wrap gap-2">
                    {["All", "Fast Food", "Restaurant", "Deals", "Drinks"].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setProductCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${productCategoryFilter === cat ? 'bg-primary text-white shadow-sm' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 bg-secondary p-1 rounded-xl">
                    <button
                      onClick={() => setProductSortBy("qty")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${productSortBy === "qty" ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
                    >
                      Sort by Qty
                    </button>
                    <button
                      onClick={() => setProductSortBy("rev")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${productSortBy === "rev" ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
                    >
                      Sort by Revenue
                    </button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-secondary/50 border-b border-border">
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Product Name</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Category</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Qty Sold</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Revenue (Rs)</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Revenue share (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {productSalesData.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-muted-foreground font-bold">No products match this filter.</td>
                          </tr>
                        ) : (
                          productSalesData.slice((productCurrentPage - 1) * itemsPerPage, productCurrentPage * itemsPerPage).map((item, idx) => (
                            <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                              <td className="p-4 text-sm font-black text-foreground">{item.name}</td>
                              <td className="p-4 text-xs font-bold text-muted-foreground">{item.cat}</td>
                              <td className="p-4 text-sm font-black text-foreground text-right">{item.sold}</td>
                              <td className="p-4 text-sm font-black text-primary text-right">{formatCurrency(item.rev)}</td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-xs font-bold w-8 text-right">{item.share}%</span>
                                  <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${item.share}%` }}></div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {productSalesData.length > 0 && (
                    <div className="p-4 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 bg-secondary/10 rounded-b-[2.5rem]">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-muted-foreground">
                          Showing {(productCurrentPage - 1) * itemsPerPage + 1}–{Math.min(productCurrentPage * itemsPerPage, productSalesData.length)} of {productSalesData.length} products
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">Per page:</span>
                          <select
                            value={itemsPerPage}
                            onChange={(e) => {
                              setItemsPerPage(Number(e.target.value))
                              setProductCurrentPage(1)
                            }}
                            className="bg-card border border-border rounded-lg text-xs font-bold px-2 py-1 focus:outline-none cursor-pointer"
                          >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={productCurrentPage === 1}
                          onClick={() => setProductCurrentPage(p => Math.max(1, p - 1))}
                          className="px-4 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground disabled:opacity-40 hover:bg-secondary transition-colors"
                        >
                          Previous
                        </button>
                        <button
                          disabled={productCurrentPage === Math.ceil(productSalesData.length / itemsPerPage)}
                          onClick={() => setProductCurrentPage(p => Math.min(Math.ceil(productSalesData.length / itemsPerPage), p + 1))}
                          className="px-4 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground disabled:opacity-40 hover:bg-secondary transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )
          )}

          {/* 1. Orders Report */}
          {activeTab === "Orders Report" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[
                  { label: "Total Orders", val: orderReportStats.total, color: "text-blue-500" },
                  { label: "Completed", val: orderReportStats.completed, color: "text-emerald-500" },
                  { label: "Preparing", val: orderReportStats.preparing, color: "text-orange-500" },
                  { label: "Ready", val: orderReportStats.ready, color: "text-amber-500" },
                  { label: "Cancelled", val: orderReportStats.cancelled, color: "text-red-500" },
                  { label: "Edited", val: orderReportStats.edited, color: "text-indigo-500" },
                ].map((stat, i) => (
                  <div key={i} className="p-4 bg-card border border-border rounded-3xl shadow-sm flex flex-col justify-center text-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                    <p className={`text-3xl font-black mt-2 ${stat.color}`}>{stat.val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-1 md:col-span-2 p-6 bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Order Volume Analytics</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">View by:</span>
                      <select 
                        value={orderChartTimeView}
                        onChange={(e) => setOrderChartTimeView(e.target.value as "Hour"|"Day"|"Week"|"Month")}
                        className="bg-secondary border border-border rounded-lg text-xs font-bold px-3 py-1.5 focus:outline-none cursor-pointer"
                      >
                        <option value="Hour">Hour</option>
                        <option value="Day">Day</option>
                        <option value="Week">Week</option>
                        <option value="Month">Month</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={orderVolumeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="count" name="Orders" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" activeDot={{ r: 6 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="col-span-1 p-6 bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col">
                  <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-4">Order Type Distribution</h3>
                  <div className="flex-1 flex items-center justify-center min-h-[250px] w-full">
                    {orderTypeData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={orderTypeData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                          <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={70} />
                          <Tooltip cursor={{fill: 'hsl(var(--secondary))'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold' }} />
                          <Bar dataKey="value" name="Orders" radius={[0, 4, 4, 0]}>
                            {orderTypeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center text-muted-foreground font-bold text-sm">No order types data available.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Category Sales */}
          {activeTab === "Category Sales" && (
            <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Category Sales</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border">
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Category</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Qty Sold</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Revenue (Rs)</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Revenue share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {categorySalesData.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-4 text-sm font-black text-foreground">{cat.cat}</td>
                        <td className="p-4 text-sm font-black text-foreground text-right">{cat.sold}</td>
                        <td className="p-4 text-sm font-black text-primary text-right">{formatCurrency(cat.rev)}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs font-bold w-8 text-right">{cat.share}%</span>
                            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${cat.share}%` }}></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Deal Sales */}
          {activeTab === "Deal Sales" && (
            <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Active Deals & Combos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border">
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Deal Name</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Times Redeemed</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Revenue (Rs)</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Discount Cost</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Net Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {dealSalesData.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground font-bold">No deals sold in this period.</td></tr>
                    ) : dealSalesData.map((deal, idx) => (
                      <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-4 text-sm font-black text-foreground">{deal.name}</td>
                        <td className="p-4 text-sm font-black text-foreground text-right">{deal.sold}</td>
                        <td className="p-4 text-sm font-black text-primary text-right">{formatCurrency(deal.rev)}</td>
                        <td className="p-4 text-sm font-black text-red-500 text-right">- Rs. {formatCurrency(deal.discountCost)}</td>
                        <td className="p-4 text-sm font-black text-emerald-500 text-right">Rs. {formatCurrency(deal.netContribution)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
