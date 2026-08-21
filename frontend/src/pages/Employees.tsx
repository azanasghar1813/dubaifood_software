import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, Filter, Plus, Edit2, 
  Trash2, Download, RefreshCw, Key, Smartphone, 
  Eye, 
  X, Power, Award, List, Loader2
} from "lucide-react"
import { employeeService } from "../services/employeeService"

export default function Employees() {
  const [employees, setEmployees] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "table">("table")
  const [search, setSearch] = useState("")
  
  // Filter States
  const [selectedRole, setSelectedRole] = useState("All")
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [selectedShift, setSelectedShift] = useState("All")
  const [sortBy, setSortBy] = useState("Newest")
  const [showFilters, setShowFilters] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null)
  const [drawerMode, setDrawerMode] = useState<"view" | "edit" | "add">("view")

  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchEmployees = async () => {
    try {
      setIsRefreshing(true)
      const response = await employeeService.getEmployees()
      const data = response.data || response;
      
      const mapped = data.map((u: any) => ({
        id: u.id,
        name: u.first_name + (u.last_name ? ' ' + u.last_name : ''),
        role: u.role_name || u.role || 'Unknown',
        roleId: u.role_id,
        phone: u.phone || '',
        email: u.email || '',
        shift: "Morning",
        status: u.is_active ? "Active" : "Inactive",
        pinStatus: "Configured",
        joinedDate: u.joining_date || u.created_at?.split(" ")[0] || new Date().toISOString().split("T")[0],
        isOnDuty: false,
        performance: { orders: 0, revenue: 0, avgBill: 0, refunds: 0, cancelled: 0, serviceTime: "—" },
      }));
      setEmployees(mapped)
    } catch (err) {
      console.error(err)
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "SELECT"

      // F2 Focus Search
      if (e.key === "F2") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // Ctrl + N: Add employee
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault()
        handleOpenAdd()
      }

      // Esc: Close Drawer
      if (e.key === "Escape" && isDrawerOpen) {
        e.preventDefault()
        setIsDrawerOpen(false)
      }

      // Ctrl + Shift + P: Reset PIN on selected employee
      if (e.ctrlKey && e.shiftKey && e.key === "P" && selectedEmp) {
        e.preventDefault()
        handleResetPIN(selectedEmp)
      }

      // Ctrl + P: Print roster
      if (e.ctrlKey && e.key === "p" && !isInput) {
        e.preventDefault()
        window.print()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isDrawerOpen, selectedEmp])

  // Derived Values
  const roles = ["All", ...Array.from(new Set(employees.map(e => e.role?.name || e.role)))]
  const stats = useMemo(() => {
    const total = employees.length
    const cashiers = employees.filter(e => e.role === "Cashier").length
    const managers = employees.filter(e => e.role === "Manager").length
    const kitchen = employees.filter(e => e.role === "Kitchen Staff").length
    const waiters = employees.filter(e => e.role === "Waiter").length
    
    const onDuty = employees.filter(e => e.isOnDuty).length
    const offDuty = total - onDuty
    const lateToday = employees.filter(e => e.attendance?.isLate).length
    
    return { total, cashiers, managers, kitchen, waiters, onDuty, offDuty, lateToday }
  }, [employees])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[calc(100vh-100px)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Reset PIN
  const handleResetPIN = (emp: any) => {
    const newPin = prompt(`Enter new 4-digit PIN for ${emp.name}:`)
    if (!newPin) return
    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      alert("PIN must be exactly 4 numerical digits.")
      return
    }
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, pin: newPin, pinStatus: "Configured" } : e))
    setSelectedEmp((prev: any) => prev ? { ...prev, pin: newPin, pinStatus: "Configured" } : null)
    alert(`PIN for ${emp.name} updated successfully to: ${newPin}`)
  }

  // Add / Edit handlers
  const handleOpenAdd = () => {
    setSelectedEmp({
      id: `EMP-0${employees.length + 1}`,
      name: "",
      role: "Cashier",
      phone: "",
      email: "",
      shift: "Morning",
      status: "Active",
      pin: "0000",
      pinStatus: "Configured",
      lastLogin: "Never",
      cnic: "42101-XXXXXXX-X",
      address: "Dubai main avenue, UAE",
      emergencyContact: "",
      joinedDate: new Date().toISOString().split("T")[0],
      assignedCounter: "Counter #1",
      assignedKitchen: "Fast Food Kitchen",
      isOnDuty: false,
      performance: { orders: 0, revenue: 0, avgBill: 0, refunds: 0, cancelled: 0, serviceTime: "—" },
      permissions: { editOrders: true, cancelOrders: false, refund: false, openDrawer: true, viewReports: false, manageProducts: false, manageUsers: false, changeSettings: false, accessKDS: false, printReports: true },
      attendance: { clockIn: "—", clockOut: "—", workingHours: "—", breakTime: "—", isLate: false }
    })
    setDrawerMode("add")
    setIsDrawerOpen(true)
  }

  const handleOpenView = (emp: any) => {
    setSelectedEmp({ ...emp })
    setDrawerMode("view")
    setIsDrawerOpen(true)
  }

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const rolesRes = await employeeService.getRoles();
      const roles = rolesRes.data || rolesRes;
      const roleObj = roles.find((r: any) => r.name === selectedEmp.role);
      const roleId = roleObj ? roleObj.id : "b62206fb-c641-40c7-bfe3-70bbf4c049fa"; // Waiter fallback

      const payload = {
        username: selectedEmp.name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000),
        roleId: roleId,
        pinCode: selectedEmp.pin || "1234",
        firstName: selectedEmp.name,
        phone: selectedEmp.phone,
        email: selectedEmp.email
      };

      if (drawerMode === "add") {
        await employeeService.createEmployee(payload);
      } else if (drawerMode === "edit") {
        await employeeService.updateEmployee(selectedEmp.id, {
          roleId: roleId,
          firstName: selectedEmp.name,
          phone: selectedEmp.phone,
          email: selectedEmp.email
        });
      }
      
      await fetchEmployees();
      setDrawerMode("view")
      alert("Employee saved successfully!");
    } catch (error: any) {
      console.error("Error saving employee:", error);
      alert("Error saving employee: " + (error.response?.data?.error || error.message));
    }
  }

  const handleDeleteEmployee = (id: string) => {
    if (confirm("Are you sure you want to delete this employee record?")) {
      setEmployees(employees.filter(e => e.id !== id))
      setIsDrawerOpen(false)
      setSelectedEmp(null)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 800)
  }

  // Filter & Sort Logic
  const filteredAndSorted = useMemo(() => {
    let result = employees.filter(emp => {
      const q = search.toLowerCase()
      const matchSearch = emp.name.toLowerCase().includes(q) || 
                          emp.id.toLowerCase().includes(q) || 
                          emp.role.toLowerCase().includes(q) || 
                          (emp.email || '').toLowerCase().includes(q) || 
                          emp.phone.includes(q)
      
      const matchRole = selectedRole === "All" || emp.role === selectedRole
      const matchShift = selectedShift === "All" || emp.shift === selectedShift
      
      let matchStatus = true
      if (selectedStatus === "Active") matchStatus = emp.status === "Active"
      else if (selectedStatus === "Inactive") matchStatus = emp.status === "Inactive"
      else if (selectedStatus === "On Duty") matchStatus = emp.isOnDuty === true
      else if (selectedStatus === "Off Duty") matchStatus = emp.isOnDuty === false

      return matchSearch && matchRole && matchShift && matchStatus
    })

    // Sort order
    result.sort((a, b) => {
      if (sortBy === "Alphabetically") return a.name.localeCompare(b.name)
      if (sortBy === "Newest") return b.joinedDate.localeCompare(a.joinedDate)
      if (sortBy === "Oldest") return a.joinedDate.localeCompare(b.joinedDate)
      if (sortBy === "Most Sales") return b.performance.revenue - a.performance.revenue
      return 0
    })

    return result
  }, [employees, search, selectedRole, selectedShift, selectedStatus, sortBy])

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">

      {/* ==================================================
          HEADER
          ================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Employee & Shift Manager
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Shift Controls</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Business Day: 6AM–6AM
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleRefresh}
            className={`p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border relative transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh employees database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => alert("Staff attendance sheet exported.")}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Employee [Ctrl+N]
          </button>
        </div>
      </div>

      {/* ==================================================
          STATISTICS CARDS
          ================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Total Staff", val: stats.total, sub: "Database count", color: "text-blue-500" },
          { label: "Cashiers", val: stats.cashiers, sub: "Register duty", color: "text-amber-500" },
          { label: "Managers", val: stats.managers, sub: "PIN overrides", color: "text-rose-500" },
          { label: "Kitchen Staff", val: stats.kitchen, sub: "KDS screen operators", color: "text-indigo-500" },
          { label: "Waiters", val: stats.waiters, sub: "Serving tables", color: "text-purple-500" },
          { label: "On Duty Today", val: stats.onDuty, sub: "Clocked In", color: "text-emerald-500 animate-pulse" },
          { label: "Off Duty Today", val: stats.offDuty, sub: "Inactive", color: "text-zinc-500" },
          { label: "Late Arrivals", val: stats.lateToday, sub: "Today's tardy alert", color: stats.lateToday > 0 ? "text-red-500 animate-bounce" : "text-emerald-500" }
        ].map((card, i) => (
          <div key={i} className="p-4 bg-card border border-border/50 rounded-2xl flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{card.label}</span>
              <h4 className="text-xl font-black mt-2 text-foreground">{card.val}</h4>
            </div>
            <span className={`text-[8px] font-bold mt-2 ${card.color}`}>{card.sub}</span>
          </div>
        ))}
      </div>

      {/* ==================================================
          SEARCH & FILTERS PANEL
          ================================================== */}
      <div className="bg-card border border-border rounded-3xl p-4 shadow-sm space-y-4">
        
        {/* Top Search bar */}
        <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-4 h-4" /></span>
            <input 
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Employee Name, ID, Phone, Role, Email... [Press F2 to focus]"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-sm font-bold text-foreground placeholder:text-muted-foreground transition-all"
            />
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`h-11 px-4 rounded-xl border text-xs font-black uppercase transition-all flex items-center gap-2 ${
              showFilters 
                ? 'bg-orange-500/10 border-orange-500 text-orange-500' 
                : 'bg-secondary text-muted-foreground border-border hover:border-muted-foreground'
            }`}
          >
            <Filter className="w-4 h-4" /> Filters Panel
          </button>

          <div className="flex border border-border rounded-xl overflow-hidden shrink-0">
            <button 
              onClick={() => setViewMode("grid")}
              className={`p-3 transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode("table")}
              className={`p-3 transition-colors ${viewMode === "table" ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Drawer */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-border/50"
            >
              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Role</label>
                <select 
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All Roles</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Kitchen Staff">Kitchen Staff</option>
                  <option value="Waiter">Waiter</option>
                  <option value="Accountant">Accountant</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Attendance status</label>
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active Employee</option>
                  <option value="Inactive">Inactive Employee</option>
                  <option value="On Duty">On Duty (Clocked In)</option>
                  <option value="Off Duty">Off Duty (Clocked Out)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Assign Shift</label>
                <select 
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="All">All Shifts</option>
                  <option value="Morning">Morning Shift</option>
                  <option value="Evening">Evening Shift</option>
                  <option value="Night">Night Shift</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground">Sort</label>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary border border-border text-xs font-bold px-2 mt-1 focus:outline-none"
                >
                  <option value="Newest">Newest Join</option>
                  <option value="Oldest">Oldest Join</option>
                  <option value="Alphabetically">Alphabetical</option>
                  <option value="Most Sales">Sales Performance</option>
                </select>
              </div>

              <div className="flex items-end">
                <button 
                  onClick={() => {
                    setSelectedRole("All")
                    setSelectedStatus("All")
                    setSelectedShift("All")
                    setSortBy("Newest")
                    setSearch("")
                  }}
                  className="w-full h-9 rounded-lg border border-border hover:bg-secondary text-xs font-black uppercase text-center transition-colors"
                >
                  Reset filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ==================================================
          EMPLOYEE VIEW CONTAINER
          ================================================== */}
      {viewMode === "grid" ? (
        
        // GRID VIEW
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAndSorted.map((emp) => (
            <motion.div
              layout
              key={emp.id}
              onClick={() => handleOpenView(emp)}
              className="bg-card hover:bg-secondary/20 border border-border/60 hover:border-primary/50 rounded-3xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col items-center text-center relative group overflow-hidden"
            >
              {/* Badge for On Duty */}
              <span className={`absolute top-4 right-4 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                emp.isOnDuty 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
              }`}>
                {emp.isOnDuty ? "On Duty" : "Off Duty"}
              </span>

              <div className="w-16 h-16 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center font-black text-2xl mb-3 shadow-inner">
                {emp.name.charAt(0)}
              </div>

              <h4 className="text-base font-black text-foreground">{emp.name}</h4>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">{emp.role}</p>

              <div className="w-full space-y-2 mt-4 pt-4 border-t border-border/40 text-xs text-left">
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Shift:</span>
                  <span className="text-foreground font-bold">{emp.shift}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Contact:</span>
                  <span className="text-foreground">{emp.phone}</span>
                </div>
                {emp.role === "Cashier" && (
                  <div className="flex justify-between font-medium pt-1 border-t border-border/20">
                    <span className="text-muted-foreground">Today's Sales:</span>
                    <span className="text-primary font-black">Rs. {emp.performance.revenue.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {filteredAndSorted.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground font-bold">No employee records match filters.</div>
          )}
        </div>

      ) : (

        // TABLE VIEW
        <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-secondary/30 text-muted-foreground text-xs uppercase font-bold border-b border-border">
              <tr>
                <th className="px-6 py-4">Avatar</th>
                <th className="px-6 py-4">Emp ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Shift</th>
                <th className="px-6 py-4">Duty Status</th>
                <th className="px-6 py-4">PIN Status</th>
                <th className="px-6 py-4 text-right">Today's Revenue</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAndSorted.map((emp) => (
                <tr 
                  key={emp.id}
                  onClick={() => handleOpenView(emp)}
                  className="hover:bg-secondary/20 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-3">
                    <div className="w-9 h-9 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center font-black text-sm">
                      {emp.name.charAt(0)}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-muted-foreground">{emp.id}</td>
                  <td className="px-6 py-4 font-black text-foreground">{emp.name}</td>
                  <td className="px-6 py-4 text-xs font-semibold text-muted-foreground">{emp.role}</td>
                  <td className="px-6 py-4 text-xs font-bold text-foreground">{emp.phone}</td>
                  <td className="px-6 py-4 text-xs font-bold text-foreground">{emp.shift}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border ${
                      emp.isOnDuty 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                    }`}>
                      {emp.isOnDuty ? "On Duty" : "Off Duty"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground font-semibold">{emp.pinStatus}</td>
                  <td className="px-6 py-4 text-right font-black text-primary">
                    {emp.role === "Cashier" ? `Rs. ${emp.performance.revenue.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1.5">
                      <button 
                        onClick={() => handleOpenView(emp)}
                        className="p-2 bg-secondary text-foreground hover:bg-border border border-border rounded-xl transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleResetPIN(emp)}
                        className="p-2 bg-secondary text-foreground hover:bg-border border border-border rounded-xl transition-colors"
                        title="Reset PIN"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-500" />
                      </button>
                      <button 
                        onClick={() => handleDeleteEmployee(emp.id)}
                        className="p-2 bg-secondary/80 text-red-500 hover:bg-red-500 hover:text-white border border-border rounded-xl transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground font-bold">No employee records match search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      )}

      {/* ==================================================
          EMPLOYEE DETAILS DRAWER (RIGHT-SIDE)
          ================================================== */}
      <AnimatePresence>
        {isDrawerOpen && selectedEmp && (
          <div className="fixed inset-0 z-50 flex justify-end">
            
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />

            {/* Drawer Body */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 overflow-hidden text-foreground"
            >
              <form onSubmit={handleSaveEmployee} className="flex flex-col h-full">
                
                {/* Header */}
                <div className="p-6 border-b border-border bg-secondary/30 flex justify-between items-center shrink-0">
                  <div>
                    <h2 className="text-lg font-black text-foreground">
                      {drawerMode === 'add' ? "Add New Staff" : drawerMode === 'edit' ? "Edit Employee Profile" : "Employee Profile"}
                    </h2>
                    <p className="text-xs text-muted-foreground font-semibold mt-1">
                      {drawerMode === 'add' ? "Create employee entry" : `Employee ID: ${selectedEmp.id}`}
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-2 bg-secondary hover:bg-border rounded-xl text-muted-foreground border border-border transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form fields */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-background/40">
                  
                  {/* Photo Placeholder */}
                  <div className="flex flex-col items-center py-4 bg-card border border-border rounded-2xl">
                    <div className="w-20 h-20 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center font-black text-3xl shadow shadow-orange-500/20">
                      {selectedEmp.name ? selectedEmp.name.charAt(0) : "?"}
                    </div>
                    {drawerMode === "view" && (
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mt-3 border ${
                        selectedEmp.isOnDuty 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                          : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      }`}>
                        {selectedEmp.isOnDuty ? "CLOCK IN STATUS: ON DUTY" : "CLOCK OUT STATUS: OFF DUTY"}
                      </span>
                    )}
                  </div>

                  {/* Core fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Full Name</label>
                      <input 
                        required
                        disabled={drawerMode === "view"}
                        type="text"
                        value={selectedEmp.name}
                        onChange={e => setSelectedEmp({ ...selectedEmp, name: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Role</label>
                      <select 
                        disabled={drawerMode === "view"}
                        value={selectedEmp.role}
                        onChange={e => setSelectedEmp({ ...selectedEmp, role: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-bold text-foreground disabled:opacity-60"
                      >
                        <option value="Super Admin">Super Admin</option>
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Cashier">Cashier</option>
                        <option value="Kitchen Staff">Kitchen Staff</option>
                        <option value="Waiter">Waiter</option>
                        <option value="Accountant">Accountant</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Phone Number</label>
                      <input 
                        required
                        disabled={drawerMode === "view"}
                        type="text"
                        value={selectedEmp.phone}
                        onChange={e => setSelectedEmp({ ...selectedEmp, phone: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Email Address</label>
                      <input 
                        disabled={drawerMode === "view"}
                        type="email"
                        value={selectedEmp.email || ""}
                        onChange={e => setSelectedEmp({ ...selectedEmp, email: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Operational Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Assign Shift</label>
                      <select 
                        disabled={drawerMode === "view"}
                        value={selectedEmp.shift}
                        onChange={e => setSelectedEmp({ ...selectedEmp, shift: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-bold text-foreground disabled:opacity-60"
                      >
                        <option value="Morning">Morning Shift (6AM - 2PM)</option>
                        <option value="Evening">Evening Shift (2PM - 10PM)</option>
                        <option value="Night">Night Shift (10PM - 6AM)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Security PIN</label>
                      <input 
                        required
                        disabled={drawerMode === "view"}
                        type="password"
                        maxLength={4}
                        placeholder="••••"
                        value={selectedEmp.pin}
                        onChange={e => setSelectedEmp({ ...selectedEmp, pin: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Personal details */}
                  <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">CNIC (National ID)</label>
                      <input 
                        disabled={drawerMode === "view"}
                        type="text"
                        value={selectedEmp.cnic}
                        onChange={e => setSelectedEmp({ ...selectedEmp, cnic: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Date Joined</label>
                      <input 
                        disabled={drawerMode === "view"}
                        type="date"
                        value={selectedEmp.joinedDate}
                        onChange={e => setSelectedEmp({ ...selectedEmp, joinedDate: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Address</label>
                      <input 
                        disabled={drawerMode === "view"}
                        type="text"
                        value={selectedEmp.address}
                        onChange={e => setSelectedEmp({ ...selectedEmp, address: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Permissions Summary panel */}
                  <div className="space-y-3 border-t border-border pt-4">
                    <h4 className="text-xs uppercase font-black tracking-wider text-muted-foreground">Job Role Permissions</h4>
                    <div className="grid grid-cols-2 gap-2 bg-secondary/30 p-4 border border-border rounded-2xl">
                      {Object.keys(selectedEmp.permissions).map((permKey) => {
                        const hasPerm = selectedEmp.permissions[permKey]
                        
                        return (
                          <div 
                            key={permKey} 
                            className="flex items-center justify-between p-2 bg-card border border-border rounded-xl"
                          >
                            <span className="text-[10px] font-bold text-foreground capitalize truncate pr-2">
                              {permKey.replace(/([A-Z])/g, " $1")}
                            </span>
                            <button
                              type="button"
                              disabled={drawerMode === "view"}
                              onClick={() => {
                                const nextPermissions = { ...selectedEmp.permissions, [permKey]: !hasPerm }
                                setSelectedEmp({ ...selectedEmp, permissions: nextPermissions })
                              }}
                              className={`w-8 h-4 rounded-full transition-colors relative ${
                                hasPerm ? 'bg-primary' : 'bg-zinc-600'
                              } ${drawerMode === 'view' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[1px] transition-transform ${
                                hasPerm ? 'right-[1px]' : 'left-[1px]'
                              }`} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Performance stats summary */}
                  {drawerMode === "view" && (
                    <div className="border-t border-border pt-4 space-y-3">
                      <h4 className="text-xs uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                        <Award className="w-4 h-4 text-primary" /> Shift Performance (Today)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div className="p-3 bg-secondary/50 border border-border rounded-xl text-center">
                          <span className="text-[9px] text-muted-foreground uppercase font-black">Tickets Served</span>
                          <p className="text-base font-black text-foreground mt-0.5">{selectedEmp.performance.orders}</p>
                        </div>
                        <div className="p-3 bg-secondary/50 border border-border rounded-xl text-center">
                          <span className="text-[9px] text-muted-foreground uppercase font-black">Total Sales</span>
                          <p className="text-base font-black text-primary mt-0.5">Rs. {selectedEmp.performance.revenue.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-secondary/50 border border-border rounded-xl text-center">
                          <span className="text-[9px] text-muted-foreground uppercase font-black">Service Speed</span>
                          <p className="text-base font-black text-foreground mt-0.5">{selectedEmp.performance.serviceTime}</p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-border bg-card grid grid-cols-2 gap-2 shrink-0">
                  {drawerMode === "view" ? (
                    <>
                      <button 
                        type="button" 
                        onClick={() => setDrawerMode("edit")}
                        className="py-3 bg-primary text-white hover:bg-primary/95 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary/10"
                      >
                        <Edit2 className="w-4 h-4" /> Edit Profile
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleResetPIN(selectedEmp)}
                        className="py-3 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Key className="w-4 h-4 text-amber-500" /> Reset PIN
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          const isOnDuty = !selectedEmp.isOnDuty
                          setSelectedEmp({ ...selectedEmp, isOnDuty })
                          setEmployees(employees.map(e => e.id === selectedEmp.id ? { ...e, isOnDuty } : e))
                          alert(`Employee status changed to: ${isOnDuty ? 'Clocked In (On Duty)' : 'Clocked Out (Off Duty)'}`)
                        }}
                        className="col-span-2 py-3 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Power className="w-4 h-4 text-emerald-500" />
                        {selectedEmp.isOnDuty ? "Force Clock Out (Off Duty)" : "Force Clock In (On Duty)"}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteEmployee(selectedEmp.id)}
                        className="col-span-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-4.5 h-4.5" /> Delete Record
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        type="submit"
                        className="py-3 bg-primary text-white hover:bg-primary/95 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary/10"
                      >
                        Save Employee
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (drawerMode === "add") {
                            setIsDrawerOpen(false)
                            setSelectedEmp(null)
                          } else {
                            setDrawerMode("view")
                            setSelectedEmp(employees.find(e => e.id === selectedEmp.id))
                          }
                        }}
                        className="py-3 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
