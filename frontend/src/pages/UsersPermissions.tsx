import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Plus, RefreshCw, X, Shield, Lock, Edit2, Key, CheckCircle, XCircle } from "lucide-react"
import { employeeService } from "../services/employeeService"
import { useAuthStore } from "../store/authStore"

export default function UsersPermissions() {
  const { user: currentUser } = useAuthStore()

  // Ensure "Users" screen is accessible to Admin/Super Admin only
  if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Super Admin') {
    return (
      <div className="h-full flex items-center justify-center min-h-[calc(100vh-100px)]">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </div>
    )
  }
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [roleFilter, setRoleFilter] = useState("All")

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | "reset-pin">("add")
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    roleId: "",
    pinCode: "",
    confirmPinCode: "",
    isActive: true
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [usersRes, rolesRes] = await Promise.all([
        employeeService.getEmployees(),
        employeeService.getRoles()
      ])
      setUsers(usersRes.data || usersRes)
      setRoles(rolesRes.data || rolesRes)
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.error || "Failed to load users")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.first_name?.toLowerCase().includes(search.toLowerCase()) || 
        user.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        user.username?.toLowerCase().includes(search.toLowerCase())
      
      const matchesStatus = 
        statusFilter === "All" ? true :
        statusFilter === "Active" ? user.is_active === 1 :
        statusFilter === "Inactive" ? user.is_active === 0 :
        statusFilter === "Locked" ? (user.locked_until && new Date(user.locked_until) > new Date()) : true
        
      const matchesRole = roleFilter === "All" ? true : user.role_name === roleFilter

      return matchesSearch && matchesStatus && matchesRole
    })
  }, [users, search, statusFilter, roleFilter])

  const stats = useMemo(() => {
    const total = users.length
    const active = users.filter(u => u.is_active === 1).length
    const inactive = users.filter(u => u.is_active === 0).length
    const locked = users.filter(u => u.locked_until && new Date(u.locked_until) > new Date()).length
    return { total, active, inactive, locked }
  }, [users])

  const openDrawer = (mode: "add" | "edit" | "reset-pin", user: any = null) => {
    setDrawerMode(mode)
    setSelectedUser(user)
    setFormError(null)
    if (mode === "add") {
      setFormData({
        firstName: "", lastName: "", username: "", roleId: "", pinCode: "", confirmPinCode: "", isActive: true
      })
    } else if (mode === "edit" && user) {
      setFormData({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        username: user.username || "",
        roleId: user.role_id || "",
        pinCode: "",
        confirmPinCode: "",
        isActive: user.is_active === 1
      })
    } else if (mode === "reset-pin" && user) {
      setFormData({
        ...formData,
        pinCode: "",
        confirmPinCode: ""
      })
    }
    setIsDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    
    try {
      setIsSubmitting(true)
      
      if (drawerMode === "add") {
        if (!formData.firstName || !formData.username || !formData.roleId || !formData.pinCode) {
          throw new Error("Please fill in all required fields")
        }
        if (formData.pinCode !== formData.confirmPinCode) {
          throw new Error("PINs do not match")
        }
        if (formData.pinCode.length < 4) {
          throw new Error("PIN must be at least 4 digits")
        }
        
        await employeeService.createEmployee({
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          roleId: formData.roleId,
          pinCode: formData.pinCode
        })
      } else if (drawerMode === "edit") {
        await employeeService.updateEmployee(selectedUser.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          roleId: formData.roleId
        })
        
        if (selectedUser.is_active !== (formData.isActive ? 1 : 0)) {
          await employeeService.updateStatus(selectedUser.id, formData.isActive)
        }
      } else if (drawerMode === "reset-pin") {
        if (!formData.pinCode) throw new Error("PIN is required")
        if (formData.pinCode !== formData.confirmPinCode) throw new Error("PINs do not match")
        if (formData.pinCode.length < 4) throw new Error("PIN must be at least 4 digits")
        
        await employeeService.resetPin(selectedUser.id, formData.pinCode)
      }
      
      setIsDrawerOpen(false)
      fetchData()
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleToggleStatus = async (user: any) => {
    if (user.role_name === 'Super Admin' && user.is_active === 1) {
       // Prevent easy disabling from table
       alert("Cannot disable a Super Admin account directly.")
       return
    }
    if (confirm(`Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} this user?`)) {
      try {
        await employeeService.updateStatus(user.id, !user.is_active)
        fetchData()
      } catch (err: any) {
        alert(err.response?.data?.error || "Failed to update status")
      }
    }
  }

  // Role filtering logic based on logged in user
  const canManageRole = (roleName: string) => {
    if (currentUser?.role === 'Super Admin') return true
    if (currentUser?.role === 'Admin') {
      return roleName !== 'Super Admin' && roleName !== 'Admin'
    }
    return false // Other roles shouldn't even be here, but just in case
  }
  
  const availableRoles = roles.filter(r => canManageRole(r.name))

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center z-10 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-500" />
            Users
          </h1>
          <p className="text-sm text-slate-500 font-medium">Manage POS users and access</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => openDrawer("add")}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          {[
            { label: "Total Users", value: stats.total, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Active", value: stats.active, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Inactive", value: stats.inactive, color: "text-slate-600", bg: "bg-slate-100" },
            { label: "Locked", value: stats.locked, color: "text-red-600", bg: "bg-red-50" },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-sm text-slate-500 font-medium mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-4 shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or username..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Locked">Locked</option>
          </select>
          <select 
            value={roleFilter} 
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            <option value="All">All Roles</option>
            {roles.map(r => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 border-b border-slate-200">Name</th>
                  <th className="px-6 py-4 border-b border-slate-200">Username</th>
                  <th className="px-6 py-4 border-b border-slate-200">Role</th>
                  <th className="px-6 py-4 border-b border-slate-200">Status</th>
                  <th className="px-6 py-4 border-b border-slate-200">Last Login</th>
                  <th className="px-6 py-4 border-b border-slate-200 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No users found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    const isLocked = user.locked_until && new Date(user.locked_until) > new Date()
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 font-medium text-slate-800">
                          {user.first_name} {user.last_name}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{user.username}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            {user.role_name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {isLocked ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100 inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          ) : user.is_active ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => openDrawer("reset-pin", user)}
                              title="Reset PIN"
                              className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => openDrawer("edit", user)}
                              title="Edit User"
                              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleToggleStatus(user)}
                              title={user.is_active ? "Deactivate" : "Activate"}
                              className={`p-1.5 rounded transition-colors ${user.is_active ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'}`}
                            >
                              {user.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[450px] bg-white z-50 shadow-2xl flex flex-col border-l border-slate-200"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                <h2 className="text-xl font-bold text-slate-800">
                  {drawerMode === 'add' ? 'Add User' : drawerMode === 'edit' ? 'Edit User' : 'Reset PIN'}
                </h2>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6">
                {formError && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-2">
                    <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    {formError}
                  </div>
                )}
                
                <form id="user-form" onSubmit={handleSave} className="space-y-5">
                  {(drawerMode === 'add' || drawerMode === 'edit') && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">First Name *</label>
                          <input 
                            type="text" 
                            required
                            value={formData.firstName}
                            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Last Name</label>
                          <input 
                            type="text" 
                            value={formData.lastName}
                            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">Username *</label>
                        <input 
                          type="text" 
                          required
                          disabled={drawerMode === 'edit'}
                          value={formData.username}
                          onChange={(e) => setFormData({...formData, username: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all disabled:opacity-50 disabled:bg-slate-100"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">Role *</label>
                        <select 
                          required
                          value={formData.roleId}
                          onChange={(e) => setFormData({...formData, roleId: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        >
                          <option value="">Select a role...</option>
                          {availableRoles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>

                      {drawerMode === 'edit' && (
                         <div className="flex items-center gap-3 mt-4">
                           <input 
                             type="checkbox" 
                             id="isActive"
                             checked={formData.isActive}
                             onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                             className="w-5 h-5 text-orange-500 border-slate-300 rounded focus:ring-orange-500"
                           />
                           <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer">
                             Active Account
                           </label>
                         </div>
                      )}
                    </>
                  )}

                  {(drawerMode === 'add' || drawerMode === 'reset-pin') && (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      {drawerMode === 'add' && <h3 className="font-semibold text-slate-800">Security</h3>}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">PIN (min 4 digits) *</label>
                        <input 
                          type="password"
                          required
                          maxLength={6}
                          pattern="\d*"
                          inputMode="numeric"
                          value={formData.pinCode}
                          onChange={(e) => setFormData({...formData, pinCode: e.target.value.replace(/\D/g, '')})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">Confirm PIN *</label>
                        <input 
                          type="password"
                          required
                          maxLength={6}
                          pattern="\d*"
                          inputMode="numeric"
                          value={formData.confirmPinCode}
                          onChange={(e) => setFormData({...formData, confirmPinCode: e.target.value.replace(/\D/g, '')})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        />
                      </div>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="user-form"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
