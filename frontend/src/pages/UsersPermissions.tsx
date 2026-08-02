import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Key, Search, Plus, RefreshCw, X, Lock, Unlock
} from "lucide-react"
import { employeeService } from "../services/employeeService"
import { activityLogService } from "../services/activityLogService"

// Mock Permission Modules matrix data
const defaultMatrix: Record<string, Record<string, boolean>> = {
  "Dashboard": { view: true, create: false, edit: false, delete: false, approve: false, print: true, export: true },
  "POS": { view: true, create: true, edit: true, delete: false, approve: false, print: true, export: false },
  "Orders": { view: true, create: true, edit: true, delete: false, approve: true, print: true, export: true },
  "Products": { view: true, create: false, edit: false, delete: false, approve: false, print: true, export: true },
  "Categories": { view: true, create: false, edit: false, delete: false, approve: false, print: true, export: false },
  "KDS": { view: true, create: false, edit: true, delete: false, approve: true, print: false, export: false },
  "Reports": { view: false, create: false, edit: false, delete: false, approve: false, print: false, export: false },
  "Employees": { view: false, create: false, edit: false, delete: false, approve: false, print: false, export: false },
  "Settings": { view: false, create: false, edit: false, delete: false, approve: false, print: false, export: false }
}

export default function UsersPermissions() {
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  
  const [selectedRole, setSelectedRole] = useState("Cashier")
  const [matrix, setMatrix] = useState(defaultMatrix)
  
  // States
  const [search, setSearch] = useState("")
  const [filterRole, setFilterRole] = useState("All")
  const [isRefreshing, setIsRefreshing] = useState(false)
  

  // const [currentTime, setCurrentTime] = useState(new Date())
  // Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [drawerMode, setDrawerMode] = useState<"view" | "edit" | "add">("view")

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  const fetchData = async () => {
    try {
      setIsRefreshing(true)
      const [usersRes, rolesRes, logsRes] = await Promise.all([
        employeeService.getEmployees(),
        employeeService.getRoles(),
        activityLogService.getLogs({ limit: 5 })
      ])
      
      setUsers(usersRes.data || usersRes)
      setRoles(rolesRes.data || rolesRes)
      setAuditLogs(logsRes.data || logsRes)
    } catch (err) {
      console.error(err)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Live clock
  // useEffect(() => {
  //   const timer = setInterval(() => setCurrentTime(new Date()), 1000)
  //   return () => clearInterval(timer)
  // }, [])

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 Focus Search

      if (e.key === "F2") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      if (e.ctrlKey && e.key === "n") {
        e.preventDefault()
        handleOpenAdd()
      }

      if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault()
        handleAddRole()
      }

      if (e.key === "Escape" && isDrawerOpen) {
        e.preventDefault()
        setIsDrawerOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isDrawerOpen])

  // KPI Statistics
  const stats = useMemo(() => {
    const total = users.length
    const online = users.filter(u => u.device !== "—").length
    const offline = total - online
    const locked = users.filter(u => u.status === "Locked").length
    const disabled = users.filter(u => u.status === "Inactive").length
    
    return { total, online, offline, locked, disabled }
  }, [users])

  // Filtered list
  const filteredUsers = useMemo(() => {
    return users.filter(usr => {
      const q = search.toLowerCase()
      const matchSearch = usr.name.toLowerCase().includes(q) || 
                          usr.username.toLowerCase().includes(q) || 
                          usr.empId.toLowerCase().includes(q) || 
                          usr.role.toLowerCase().includes(q)
      const matchRole = filterRole === "All" || usr.role === filterRole
      const matchStatus = true; // filterStatus ignored

      return matchSearch && matchRole && matchStatus
    })
  }, [users, search, filterRole])

  // Trigger PIN reset
  const handleResetPIN = (user: any) => {
    const newPin = prompt(`Enter new 4-digit security PIN for ${user.name}:`)
    if (!newPin) return
    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      alert("PIN must be exactly 4 numeric digits.")
      return
    }
    setUsers(users.map(u => u.id === user.id ? { ...u, pin: newPin } : u))
    setAuditLogs(prev => [
      { time: new Date().toLocaleTimeString(), msg: `PIN changed successfully for ${user.name}`, user: "Super Admin" },
      ...prev
    ])
    alert(`PIN updated successfully.`)
  }

  // Toggle account lock
  const handleToggleLock = (user: any) => {
    const isLocked = user.status === "Locked"
    const nextStatus = isLocked ? "Active" : "Locked"
    setUsers(users.map(u => u.id === user.id ? { ...u, status: nextStatus, failedAttempts: isLocked ? 0 : u.failedAttempts } : u))
    alert(`Account ${isLocked ? 'Unlocked' : 'Locked'} successfully for ${user.name}.`)
  }

  // Add User Drawer
  const handleOpenAdd = () => {
    setSelectedUser({
      id: `USR-0${users.length + 1}`,
      name: "",
      username: "",
      empId: `EMP-${Math.floor(Math.random() * 800) + 100}`,
      role: "Cashier",
      status: "Active",
      lastLogin: "Never",
      device: "—",
      shift: "Morning",
      phone: "",
      email: "",
      branch: "Dubai Main Branch",
      failedAttempts: 0,
      sessionDuration: "—",
      joinedDate: new Date().toISOString().split("T")[0],
      pin: "0000"
    })
    setDrawerMode("add")
    setIsDrawerOpen(true)
  }

  const handleOpenView = (user: any) => {
    setSelectedUser({ ...user })
    setDrawerMode("view")
    setIsDrawerOpen(true)
  }

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (drawerMode === "add") {
      setUsers([...users, selectedUser])
    } else {
      setUsers(users.map(u => u.id === selectedUser.id ? selectedUser : u))
    }
    setIsDrawerOpen(false)
  }

  const handleAddRole = () => {
    const roleName = prompt("Enter Custom Role Name:")
    if (!roleName) return
    const newRole = {
      id: `R-${roles.length + 1}`,
      name: roleName,
      usersCount: 0,
      permissionsCount: 8,
      description: `Custom restaurant role with configured access rules.`,
      status: "Active",
      color: "border-zinc-500 text-zinc-500 bg-zinc-500/10"
    }
    setRoles([...roles, newRole])
  }

  const handleToggleMatrixCheckbox = (mod: string, perm: string) => {
    setMatrix({
      ...matrix,
      [mod]: {
        ...matrix[mod],
        [perm]: !matrix[mod][perm]
      }
    })
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 800)
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">
      
      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Security & Access Control Center
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Enterprise User Roles</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Manage system operators, configure module permission matrices, enforce cashier PIN rules, and monitor login audits.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleRefresh}
            className={`p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border relative transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button 
            onClick={handleAddRole}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Role [Ctrl+Shift+N]
          </button>

          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add User [Ctrl+N]
          </button>
        </div>
      </div>

      {/* ====================================================
          STATISTICS CARDS
          ==================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Users", val: stats.total, color: "text-blue-500" },
          { label: "Online Users", val: stats.online, color: "text-emerald-500 animate-pulse" },
          { label: "Offline Users", val: stats.offline, color: "text-zinc-500" },
          { label: "Locked Accounts", val: stats.locked, color: stats.locked > 0 ? "text-red-500 animate-bounce" : "text-emerald-500" },
          { label: "Disabled Users", val: stats.disabled, color: "text-zinc-500" }
        ].map((card, i) => (
          <div key={i} className="p-4 bg-card border border-border rounded-2xl flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{card.label}</span>
              <h4 className="text-xl font-black mt-2 text-foreground">{card.val}</h4>
            </div>
          </div>
        ))}
      </div>

      {/* ====================================================
          ROLE MANAGEMENT CARDS
          ==================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {roles.map((role) => (
          <div 
            key={role.id}
            onClick={() => setSelectedRole(role.name)}
            className={`p-4 bg-card border rounded-2xl cursor-pointer hover:border-primary/50 transition-all flex flex-col justify-between h-40 relative overflow-hidden ${
              selectedRole === role.name ? 'border-primary shadow shadow-primary/10' : 'border-border/60'
            }`}
          >
            <div>
              <div className="flex justify-between items-start">
                <span className="text-xs font-black text-foreground">{role.name}</span>
                <span className={`text-[8px] px-2 py-0.5 rounded-full font-black border ${role.color}`}>
                  {role.usersCount} Users
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed line-clamp-3 font-semibold">{role.description}</p>
            </div>

            <span className="text-[9px] font-black text-primary bg-secondary px-2 py-0.5 rounded border border-border w-fit mt-3">
              {role.permissionsCount} Perms
            </span>
          </div>
        ))}
      </div>

      {/* ====================================================
          PERMISSION MATRIX
          ==================================================== */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-foreground">
              Module Access Permissions: <span className="text-primary">{selectedRole}</span>
            </h3>
            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Toggle checkboxes to configure granular access privileges for this role group.</p>
          </div>
          <button 
            onClick={() => alert("Permissions successfully saved.")}
            className="px-4 py-1.5 bg-secondary hover:bg-border border border-border text-xs font-black rounded-lg transition-colors"
          >
            Save Role Permissions Matrix
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-secondary/35 text-muted-foreground text-xs uppercase font-bold border-b border-border">
              <tr>
                <th className="px-6 py-4">System Module</th>
                <th className="px-4 py-4 text-center">View</th>
                <th className="px-4 py-4 text-center">Create</th>
                <th className="px-4 py-4 text-center">Edit</th>
                <th className="px-4 py-4 text-center">Delete</th>
                <th className="px-4 py-4 text-center">Approve</th>
                <th className="px-4 py-4 text-center">Print</th>
                <th className="px-4 py-4 text-center">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.keys(matrix).map((modKey) => (
                <tr key={modKey} className="hover:bg-secondary/15 transition-colors">
                  <td className="px-6 py-3 font-black text-foreground text-xs">{modKey}</td>
                  {["view", "create", "edit", "delete", "approve", "print", "export"].map((permKey) => {
                    const isChecked = matrix[modKey][permKey]
                    return (
                      <td key={permKey} className="px-4 py-3 text-center">
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleMatrixCheckbox(modKey, permKey)}
                          className="w-4.5 h-4.5 rounded text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================
          USERS LIST
          ==================================================== */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
        
        {/* Search / Filters header */}
        <div className="flex justify-between items-center flex-wrap gap-2 border-b border-border pb-3">
          <h3 className="text-base font-black uppercase tracking-wider text-foreground">Registered System Operators</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                ref={searchInputRef}
                type="text" 
                value={search}
                onChange={e=>setSearch(e.target.value)}
                placeholder="Search user profile... (F2)"
                className="h-9 pl-9 pr-3 rounded-xl bg-secondary/80 border border-border text-xs font-bold focus:outline-none"
              />
            </div>
            
            <select 
              value={filterRole}
              onChange={e=>setFilterRole(e.target.value)}
              className="h-9 px-2.5 rounded-xl bg-secondary border border-border text-xs font-bold focus:outline-none"
            >
              <option value="All">All Roles</option>
              <option value="Cashier">Cashier</option>
              <option value="Manager">Manager</option>
              <option value="Kitchen Staff">Kitchen Staff</option>
            </select>
          </div>
        </div>

        {/* Users table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-secondary/30 text-muted-foreground text-xs uppercase font-bold border-b border-border">
              <tr>
                <th className="px-6 py-4">Avatar</th>
                <th className="px-6 py-4">User ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role Group</th>
                <th className="px-6 py-4">Active Terminal</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((usr: any) => (
                <tr 
                  key={usr.id} 
                  onClick={() => handleOpenView(usr)}
                  className="hover:bg-secondary/20 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                      {usr.name.charAt(0)}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-muted-foreground">{usr.id}</td>
                  <td className="px-6 py-4 font-black text-foreground">{usr.name}</td>
                  <td className="px-6 py-4 font-semibold text-muted-foreground">{usr.username}</td>
                  <td className="px-6 py-4 text-xs font-bold">{usr.role}</td>
                  <td className="px-6 py-4 text-xs font-medium">{usr.device}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border ${
                      usr.status === "Active" ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      usr.status === "Locked" ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                      'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                    }`}>
                      {usr.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={e=>e.stopPropagation()}>
                    <div className="flex justify-end gap-1.5">
                      <button 
                        onClick={() => handleResetPIN(usr)}
                        className="p-2 bg-secondary hover:bg-border border border-border rounded-xl transition-colors"
                        title="Reset Security PIN"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-500" />
                      </button>
                      <button 
                        onClick={() => handleToggleLock(usr)}
                        className="p-2 bg-secondary hover:bg-border border border-border rounded-xl transition-colors"
                        title={usr.status === "Locked" ? "Unlock Account" : "Lock Account"}
                      >
                        {usr.status === "Locked" ? <Unlock className="w-3.5 h-3.5 text-emerald-500" /> : <Lock className="w-3.5 h-3.5 text-rose-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================
          AUDIT LOG PREVIEW
          ==================================================== */}
      <div className="p-6 bg-card border border-border rounded-3xl shadow-sm space-y-4">
        <h3 className="text-base font-black uppercase tracking-wider text-foreground">Recent Security Audits</h3>
        <div className="space-y-2 font-mono text-[10px]">
          {auditLogs.map((log, idx) => (
            <div key={idx} className="flex justify-between items-center py-2 border-b border-border/20">
              <div className="flex gap-2">
                <span className="text-muted-foreground">{log.time}</span>
                <span className="text-foreground font-semibold">{log.msg}</span>
              </div>
              <span className="text-primary font-black">{log.user}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ====================================================
          USER DETAILS DRAWER (RIGHT-SIDE)
          ==================================================== */}
      <AnimatePresence>
        {isDrawerOpen && selectedUser && (
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
              <form onSubmit={handleSaveUser} className="flex flex-col h-full">
                
                {/* Header */}
                <div className="p-6 border-b border-border bg-secondary/30 flex justify-between items-center shrink-0">
                  <div>
                    <h2 className="text-lg font-black text-foreground">
                      {drawerMode === 'add' ? "Add Security Account" : "Operator Details"}
                    </h2>
                    <p className="text-xs text-muted-foreground font-semibold mt-1">
                      {drawerMode === 'add' ? "Create user profile" : `Operator ID: ${selectedUser.id}`}
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
                  
                  <div className="flex flex-col items-center py-4 bg-card border border-border rounded-2xl">
                    <div className="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-2xl">
                      {selectedUser.name ? selectedUser.name.charAt(0) : "?"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Full Name</label>
                      <input 
                        required
                        disabled={drawerMode === "view"}
                        type="text"
                        value={selectedUser.name}
                        onChange={e => setSelectedUser({ ...selectedUser, name: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Username</label>
                      <input 
                        required
                        disabled={drawerMode === "view"}
                        type="text"
                        value={selectedUser.username}
                        onChange={e => setSelectedUser({ ...selectedUser, username: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Assigned Role</label>
                      <select 
                        disabled={drawerMode === "view"}
                        value={selectedUser.role}
                        onChange={e => setSelectedUser({ ...selectedUser, role: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border outline-none text-xs font-bold text-foreground disabled:opacity-60"
                      >
                        <option value="Cashier">Cashier Operator</option>
                        <option value="Manager">Override Manager</option>
                        <option value="Kitchen Staff">Kitchen Staff</option>
                        <option value="Super Admin">Super Administrator</option>
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
                        value={selectedUser.pin}
                        onChange={e => setSelectedUser({ ...selectedUser, pin: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Phone Number</label>
                      <input 
                        disabled={drawerMode === "view"}
                        type="text"
                        value={selectedUser.phone}
                        onChange={e => setSelectedUser({ ...selectedUser, phone: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border outline-none text-xs font-black text-foreground disabled:opacity-60"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs uppercase font-black text-muted-foreground">Account Status</label>
                      <select 
                        disabled={drawerMode === "view"}
                        value={selectedUser.status}
                        onChange={e => setSelectedUser({ ...selectedUser, status: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border outline-none text-xs font-bold text-foreground disabled:opacity-60"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Locked">Locked</option>
                      </select>
                    </div>
                  </div>

                  {drawerMode === "view" && (
                    <div className="p-4 bg-secondary/40 border border-border rounded-2xl text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Active Session:</span>
                        <span className="font-black text-foreground">{selectedUser.sessionDuration}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Joined Date:</span>
                        <span className="font-black text-foreground">{selectedUser.joinedDate}</span>
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
                        className="py-3 bg-primary text-white hover:bg-primary/95 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md"
                      >
                        Edit Operator
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleResetPIN(selectedUser)}
                        className="py-3 bg-secondary hover:bg-border border border-border text-foreground font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        Reset PIN
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        type="submit"
                        className="py-3 bg-primary text-white hover:bg-primary/95 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md"
                      >
                        Save User
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (drawerMode === "add") {
                            setIsDrawerOpen(false)
                          } else {
                            setDrawerMode("view")
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
