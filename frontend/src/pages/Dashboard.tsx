import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from "recharts"
import { 
  DollarSign, ShoppingBag, TrendingUp, Check, Search,
  RefreshCw, Wifi, Printer, AlertTriangle, Database,
  AlertCircle, ShoppingCart, Bell, User, Layers,
  Flame, CheckCircle, Settings, ChevronRight, FileText
} from "lucide-react"
import { useOrderStore } from "../store/orderStore"
import { usePosStore } from "../store/posStore"
import { useNavigate } from "react-router-dom"

// Status color definitions
const orderStatusColors: Record<string, string> = {
  Draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  Confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20"
}

const kitchenStatusColors: Record<string, string> = {
  Waiting: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Accepted: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Preparing: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Ready: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Served: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20"
}

const paymentStatusColors: Record<string, string> = {
  Unpaid: "bg-red-500/10 text-red-400 border-red-500/20",
  "Partial Paid": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Paid: "bg-green-500/10 text-green-400 border-green-500/20",
  Refunded: "bg-purple-500/10 text-purple-400 border-purple-500/20"
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { orders } = useOrderStore()
  const { loadOrderForEdit, clearCart } = usePosStore()

  // Interface states
  const [searchQuery, setSearchQuery] = useState("")

  // Hardware/System Simulation states
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Live Table states (Click to toggle occupied status!)
  const [groundFloorTables, setGroundFloorTables] = useState(
    Array.from({ length: 12 }, (_, i) => ({ id: `G-${i + 1}`, status: i === 0 || i === 3 ? "Occupied" : "Available" }))
  )
  const [familyTables, setFamilyTables] = useState(
    Array.from({ length: 6 }, (_, i) => ({ id: `F-${i + 1}`, status: i === 1 || i === 4 ? "Occupied" : "Available" }))
  )
  const [rooftopTables, setRooftopTables] = useState(
    Array.from({ length: 8 }, (_, i) => ({ id: `T-${i + 1}`, status: i === 0 ? "Occupied" : "Available" }))
  )

  // Notifications
  const [alerts, setAlerts] = useState([
    { id: 1, title: "Receipt Printer Low Paper", type: "warning", time: "2 mins ago" },
    { id: 2, title: "Internet Latency High (120ms)", type: "info", time: "5 mins ago" },
    { id: 3, title: "Unpaid Dine In Table F-2 (> 2 hrs)", type: "error", time: "12 mins ago" },
    { id: 4, title: "Shift Ending for Cashier Ahmed in 30 mins", type: "warning", time: "15 mins ago" }
  ])

  // Activity Timeline log (kept for reference, although commented out state could be here)



  // Auto Refresh system metrics simulation
  const handleManualSync = () => {
    // console.log("Cloud database synchronization completed")
  }



  // Dynamic calculated sales, customer counts, stats from useOrderStore
  const stats = useMemo(() => {
    const totalTodaySales = orders
      .filter(o => o.status === 'Completed' || o.status === 'Confirmed')
      .reduce((sum, o) => sum + o.total, 0)
    
    const countOrders = orders.length
    const prepOrders = orders.filter(o => o.kitchenStatus === 'Preparing').length
    const readyOrdersCount = orders.filter(o => o.kitchenStatus === 'Ready').length
    const servedOrders = orders.filter(o => o.kitchenStatus === 'Served').length
    const paidOrders = orders.filter(o => o.paymentStatus === 'Paid').length
    const unpaidOrders = orders.filter(o => o.paymentStatus === 'Unpaid').length
    const avgOrderValue = countOrders > 0 ? Math.round(totalTodaySales / countOrders) : 0
    const customersToday = new Set(orders.map(o => o.customerName || 'Walk-In')).size
    
    // Segment Sales
    const fastFoodSales = orders
      .filter(o => o.items.some(i => !i.name.toLowerCase().includes('karahi') && !i.name.toLowerCase().includes('handi') && !i.name.toLowerCase().includes('deal')))
      .reduce((sum, o) => sum + o.total, 0)
    
    const restaurantSales = orders
      .filter(o => o.items.some(i => i.name.toLowerCase().includes('karahi') || i.name.toLowerCase().includes('handi')))
      .reduce((sum, o) => sum + o.total, 0)
      
    const dealsSales = orders
      .filter(o => o.items.some(i => i.name.toLowerCase().includes('deal')))
      .reduce((sum, o) => sum + o.total, 0)

    return {
      todaySales: totalTodaySales,
      ordersCount: countOrders,
      preparing: prepOrders,
      ready: readyOrdersCount,
      served: servedOrders,
      paid: paidOrders,
      unpaid: unpaidOrders,
      aov: avgOrderValue,
      customers: customersToday,
      fastFood: fastFoodSales,
      restaurant: restaurantSales,
      deals: dealsSales,
      cashInDrawer: totalTodaySales * 0.72 // Simulation of Cash vs Card
    }
  }, [orders])

  // Chart data helpers
  const hourlySalesData = [
    { hour: "06:00 AM", sales: 2500 }, { hour: "08:00 AM", sales: 8500 },
    { hour: "10:00 AM", sales: 12000 }, { hour: "12:00 PM", sales: 34000 },
    { hour: "02:00 PM", sales: 28000 }, { hour: "04:00 PM", sales: 18500 },
    { hour: "06:00 PM", sales: 42000 }, { hour: "08:00 PM", sales: 78000 },
    { hour: "10:00 PM", sales: 94000 }, { hour: "12:00 AM", sales: 55000 },
    { hour: "02:00 AM", sales: 22000 }, { hour: "04:00 AM", sales: 6500 }
  ]







  // Filter orders based on query
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const q = searchQuery.toLowerCase()
      return o.orderNumber.includes(q) || 
             (o.customerName || '').toLowerCase().includes(q) ||
             (o.cashierName || '').toLowerCase().includes(q)
    })
  }, [orders, searchQuery])


  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground">
      

      {/* ==================================================
          OPERATIONS KPI CARDS BLOCK
          ================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Today's Sales", value: `Rs. ${stats.todaySales.toLocaleString()}`, desc: "Paid + Confirmed orders", trend: "+12.4% vs yesterday", color: "text-emerald-500", icon: DollarSign },
          { title: "Today's Orders", value: stats.ordersCount, desc: "Total transactions today", trend: "+8.2% vs yesterday", color: "text-blue-500", icon: ShoppingBag },
          { title: "Paid Orders", value: stats.paid, desc: "Completed transactions", trend: "Steady range (+1%)", color: "text-zinc-400", icon: CheckCircle },
          { title: "Unpaid Orders", value: stats.unpaid, desc: "Open credit bills", trend: "Requires payout processing", color: "text-red-500", icon: AlertCircle }
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-5 bg-card/60 backdrop-blur-md rounded-[2rem] border ${card.title === "Unpaid Orders" ? 'border-red-500/40 shadow-sm shadow-red-500/10' : 'border-border/50'} flex flex-col justify-between hover:shadow-md transition-all group`}
          >
            <div>
              <div className="flex justify-between items-start pb-3">
                <span className={`text-[10px] uppercase font-black tracking-widest ${card.title === "Unpaid Orders" ? 'text-red-500' : 'text-muted-foreground'}`}>{card.title}</span>
                <div className={`p-2 bg-secondary rounded-xl border border-border group-hover:border-primary/50 group-hover:text-primary transition-colors ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
              </div>
              <h3 className={`text-2xl font-black tracking-tight ${card.title === "Unpaid Orders" ? 'text-red-500' : 'text-foreground'}`}>{card.value}</h3>
            </div>
            <div className="mt-4 pt-3 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground font-semibold leading-tight">{card.desc}</p>
              <p className={`text-[9px] font-bold mt-1 flex items-center gap-1 ${card.title === "Unpaid Orders" ? 'text-red-400' : 'text-emerald-500'}`}>
                {card.title !== "Unpaid Orders" && <TrendingUp className="w-3 h-3" />}
                {card.trend}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ==================================================
          LIVE ORDER FLOW WIDGET
          ================================================== */}
      <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
        <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-4">Live Order Flow</h3>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-500 flex items-center justify-center">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-sky-500">Preparing</p>
                <p className="text-[10px] text-muted-foreground font-bold">Active in kitchens</p>
              </div>
            </div>
            <span className="text-2xl font-black text-sky-500">{stats.preparing}</span>
          </div>

          <ChevronRight className="hidden md:block w-6 h-6 text-muted-foreground shrink-0" />

          <div className="flex-1 w-full bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-orange-500">Ready</p>
                <p className="text-[10px] text-muted-foreground font-bold">Waiting for servers</p>
              </div>
            </div>
            <span className="text-2xl font-black text-orange-500">{stats.ready}</span>
          </div>

          <ChevronRight className="hidden md:block w-6 h-6 text-muted-foreground shrink-0" />

          <div className="flex-1 w-full bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-purple-500">Served</p>
                <p className="text-[10px] text-muted-foreground font-bold">Delivered to guests</p>
              </div>
            </div>
            <span className="text-2xl font-black text-purple-500">{stats.served}</span>
          </div>
        </div>
      </div>

      {/* ==================================================
          MAIN OPERATIONS CONTENT GRID (Recent Orders & Quick Actions)
          ================================================== */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Column (col-span-8) */}
        <div className="col-span-12 xl:col-span-8 flex flex-col">
          
          {/* Section: Recent Orders */}
          <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 mb-4 gap-2">
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Recent Active Orders</h3>
                <p className="text-xs text-muted-foreground font-bold mt-0.5">Showing live tickets. Orders with red outline are overdue (&gt;25 mins).</p>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-4 h-4" /></span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search orders, customers..." 
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredOrders.slice(0, 5).map(order => {
                const elapsedMin = Math.round((Date.now() - new Date(order.timestamp).getTime()) / 60000)
                const isOverdue = elapsedMin > 25 && order.kitchenStatus !== 'Served' && order.kitchenStatus !== 'Cancelled'
                
                return (
                  <div 
                    key={order.id} 
                    className={`p-4 rounded-2xl border bg-card transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-secondary/20 group ${
                      isOverdue ? 'border-red-500/40 shadow-lg shadow-red-500/5 animate-pulse' : 'border-border'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-foreground">Order #{order.orderNumber}</span>
                        <span className="text-[10px] bg-secondary border border-border text-muted-foreground px-1.5 py-0.5 rounded font-black">{order.orderType}</span>
                        {isOverdue && (
                          <span className="text-[9px] bg-red-500 text-white px-2 py-0.5 rounded font-black uppercase tracking-wider animate-bounce">OVERDUE</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-bold mt-1">
                        Table: {order.tableNumber || "N/A"} • Customer: {order.customerName || "Guest"} • Cashier: {order.cashierName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${orderStatusColors[order.status] || orderStatusColors.Draft}`}>
                        {order.status}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${kitchenStatusColors[order.kitchenStatus] || kitchenStatusColors.Waiting}`}>
                        Kit: {order.kitchenStatus}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${paymentStatusColors[order.paymentStatus] || paymentStatusColors.Unpaid}`}>
                        Pay: {order.paymentStatus}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 justify-between md:justify-end shrink-0">
                      <div className="text-right">
                        <p className="font-black text-primary">Rs. {order.total.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground font-bold">{elapsedMin} mins ago</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => {
                            clearCart()
                            loadOrderForEdit(order)
                            navigate("/pos")
                          }}
                          className="px-3 py-1.5 bg-secondary hover:bg-orange-500 hover:text-white rounded-lg border border-border text-[10px] font-black uppercase transition-all"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {filteredOrders.length === 0 && (
                <div className="text-center py-8 text-muted-foreground font-bold">No orders found matching search query.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (col-span-4) */}
        <div className="col-span-12 xl:col-span-4 space-y-6">
          {/* Section: Quick Actions */}
          <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
            <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => navigate("/pos")}
                className="p-4 bg-secondary hover:bg-primary hover:text-white border border-border text-xs font-black rounded-2xl transition-all text-center flex flex-col items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>New POS Order</span>
              </button>
              
              <button 
                onClick={() => navigate("/orders")}
                className="p-4 bg-secondary hover:bg-primary hover:text-white border border-border text-xs font-black rounded-2xl transition-all text-center flex flex-col items-center justify-center gap-2"
              >
                <Layers className="w-5 h-5" />
                <span>Order History</span>
              </button>

              <button 
                onClick={() => navigate("/reports")}
                className="p-4 bg-secondary hover:bg-primary hover:text-white border border-border text-xs font-black rounded-2xl transition-all text-center flex flex-col items-center justify-center gap-2"
              >
                <FileText className="w-5 h-5" />
                <span>Reports History</span>
              </button>

              <button 
                onClick={handleManualSync}
                className="p-4 bg-secondary hover:bg-primary hover:text-white border border-border text-xs font-black rounded-2xl transition-all text-center flex flex-col items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Sync Cloud DB</span>
              </button>
            </div>
          </div>
          
          {/* Section: Alert Center */}
          <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Alert Center</h3>
              {alerts.length > 0 && (
                <button 
                  onClick={() => setAlerts([])} 
                  className="text-[10px] text-primary hover:underline font-black"
                >
                  Clear All
                </button>
              )}
            </div>
            {alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded-2xl border transition-colors flex gap-2 items-start ${
                      alert.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                      alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                      'bg-blue-500/10 border-blue-500/20 text-blue-500'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold leading-normal">{alert.title}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[9px] font-semibold opacity-75">{alert.time}</span>
                        <button 
                          onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                          className="text-[9px] font-black uppercase tracking-wider hover:opacity-50"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-border rounded-2xl">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-muted-foreground">All systems operational.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================
          SECOND ROW (Floor Status)
          ================================================== */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-6">
          {/* Section: Floor / Table Status */}
          <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
            <div className="flex justify-between items-center border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Floor / Table Status</h3>
                <p className="text-xs text-muted-foreground font-bold mt-0.5">Interactive table mapping. Click to toggle state.</p>
              </div>
              <div className="flex gap-4 text-xs font-bold text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Occupied</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Ground Floor */}
              <div>
                <h4 className="font-black text-xs uppercase text-foreground mb-3 text-center">Ground Floor</h4>
                <div className="grid grid-cols-3 gap-2">
                  {groundFloorTables.map((t, idx) => (
                    <button 
                      key={t.id} 
                      onClick={() => {
                        const next = [...groundFloorTables]
                        next[idx].status = t.status === "Occupied" ? "Available" : "Occupied"
                        setGroundFloorTables(next)
                      }}
                      className={`p-3 rounded-xl border text-xs font-black text-center transition-all ${
                        t.status === "Occupied" 
                          ? 'bg-red-500/10 text-red-500 border-red-500/30' 
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:border-emerald-500'
                      }`}
                    >
                      {t.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Family Hall */}
              <div>
                <h4 className="font-black text-xs uppercase text-foreground mb-3 text-center">Family Hall</h4>
                <div className="grid grid-cols-2 gap-2">
                  {familyTables.map((t, idx) => (
                    <button 
                      key={t.id} 
                      onClick={() => {
                        const next = [...familyTables]
                        next[idx].status = t.status === "Occupied" ? "Available" : "Occupied"
                        setFamilyTables(next)
                      }}
                      className={`p-3 rounded-xl border text-xs font-black text-center transition-all ${
                        t.status === "Occupied" 
                          ? 'bg-red-500/10 text-red-500 border-red-500/30' 
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:border-emerald-500'
                      }`}
                    >
                      {t.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rooftop */}
              <div>
                <h4 className="font-black text-xs uppercase text-foreground mb-3 text-center">Rooftop</h4>
                <div className="grid grid-cols-3 gap-2">
                  {rooftopTables.map((t, idx) => (
                    <button 
                      key={t.id} 
                      onClick={() => {
                        const next = [...rooftopTables]
                        next[idx].status = t.status === "Occupied" ? "Available" : "Occupied"
                        setRooftopTables(next)
                      }}
                      className={`p-3 rounded-xl border text-xs font-black text-center transition-all ${
                        t.status === "Occupied" 
                          ? 'bg-red-500/10 text-red-500 border-red-500/30' 
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:border-emerald-500'
                      }`}
                    >
                      {t.id}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
        
      </div>

      {/* ==================================================
          Section: Hourly Sales Chart
          ================================================== */}
      <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
        <div className="flex justify-between items-center border-b border-border pb-4 mb-4">
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Hourly Sales Trend</h3>
            <p className="text-xs text-muted-foreground font-bold mt-0.5">Tracked over the active 24-hr business day (6 AM - 6 AM)</p>
          </div>
        </div>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlySalesData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="hour" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => `Rs ${val / 1000}k`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                formatter={(val) => [`Rs. ${Number(val).toLocaleString()}`, "Sales"]}
              />
              <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Drawer Simulation Modal */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-card border border-border shadow-2xl rounded-3xl p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-green-400 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-foreground">Cash Drawer Opened</h2>
              <p className="text-xs text-muted-foreground font-semibold mt-2">
                Manager override key applied. Cashier Ali is authorized to process transactions. Logged in audit history.
              </p>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="w-full mt-6 py-3 bg-secondary hover:bg-border rounded-xl font-bold text-xs uppercase transition-colors"
              >
                Close Indicator
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
