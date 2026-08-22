import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Plus, RefreshCw, X, Shield, Lock, Edit2, Key, CheckCircle, XCircle, Users, TableProperties, Settings2 } from "lucide-react"
import { employeeService } from "../services/employeeService"
import { useAuthStore, hasPermission } from "../store/authStore"

export default function UsersPermissions() {
  const { user: currentUser } = useAuthStore()
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')

  // Data States
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Users Filter States
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [roleFilter, setRoleFilter] = useState("All")

  // Drawers State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | "reset-pin">("add")
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  
  const [isRoleDrawerOpen, setIsRoleDrawerOpen] = useState(false)
  const [roleDrawerMode, setRoleDrawerMode] = useState<"add" | "edit">("add")
  const [selectedRole, setSelectedRole] = useState<any | null>(null)

  // Forms State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    roleId: "",
    pinCode: "",
    confirmPinCode: "",
    isActive: true,
    showOnLogin: true
  })
  
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    description: "",
    permissionIds: [] as string[]
  })

  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [usersRes, rolesRes, permsRes] = await Promise.all([
        employeeService.getEmployees(),
        employeeService.getRoles(),
        employeeService.getPermissions()
      ])
      setUsers(usersRes.data?.data || usersRes.data || [])
      setRoles(rolesRes.data?.data || rolesRes.data || [])
      setPermissions(permsRes.data?.data || permsRes.data || [])
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.error || "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ------------------ USERS LOGIC ------------------

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
        firstName: "", lastName: "", username: "", roleId: "", pinCode: "", confirmPinCode: "", isActive: true, showOnLogin: true
      })
    } else if (mode === "edit" && user) {
      setFormData({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        username: user.username || "",
        roleId: user.role_id || "",
        pinCode: "",
        confirmPinCode: "",
        isActive: user.is_active === 1,
        showOnLogin: user.show_on_login !== 0 // Default to true if undefined
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

  const handleSaveUser = async (e: React.FormEvent) => {
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
          pinCode: formData.pinCode,
          showOnLogin: formData.showOnLogin
        })
      } else if (drawerMode === "edit") {
        await employeeService.updateEmployee(selectedUser.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          roleId: formData.roleId,
          showOnLogin: formData.showOnLogin
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

  // ------------------ ROLES LOGIC ------------------
  
  const openRoleDrawer = (mode: "add" | "edit", role: any = null) => {
    if (role && (role.name === 'Super Admin' || role.name === 'Admin' || role.name === 'Owner')) {
       alert("Core system roles cannot be modified directly.")
       return
    }
    setRoleDrawerMode(mode)
    setSelectedRole(role)
    setFormError(null)
    
    if (mode === "add") {
      setRoleFormData({ name: "", description: "", permissionIds: [] })
    } else if (mode === "edit" && role) {
      setRoleFormData({
        name: role.name || "",
        description: role.description || "",
        permissionIds: (role.permissions || []).map((p: any) => p.id)
      })
    }
    setIsRoleDrawerOpen(true)
  }

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    
    try {
      setIsSubmitting(true)
      if (roleDrawerMode === "add") {
        if (!roleFormData.name) throw new Error("Role name is required")
        await employeeService.createRole(roleFormData)
      } else {
        if (!roleFormData.name) throw new Error("Role name is required")
        await employeeService.updateRole(selectedRole.id, roleFormData)
      }
      
      setIsRoleDrawerOpen(false)
      fetchData()
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRole = async (role: any) => {
    if (role.name === 'Super Admin' || role.name === 'Admin' || role.name === 'Owner') {
       alert("Core system roles cannot be deleted.")
       return
    }
    const roleInUse = users.some(u => u.role_id === role.id)
    if (roleInUse) {
      alert("Cannot delete this role because there are users assigned to it.")
      return
    }
    
    if (confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      try {
        await employeeService.deleteRole(role.id)
        fetchData()
      } catch (err: any) {
        alert(err.response?.data?.error || "Failed to delete role")
      }
    }
  }

  const togglePermission = (permId: string) => {
    setRoleFormData(prev => {
      const exists = prev.permissionIds.includes(permId)
      if (exists) {
        return { ...prev, permissionIds: prev.permissionIds.filter(id => id !== permId) }
      } else {
        return { ...prev, permissionIds: [...prev.permissionIds, permId] }
      }
    })
  }
  
  // Group permissions for the UI
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, any[]> = {}
    permissions.forEach(p => {
      if (!groups[p.module]) groups[p.module] = []
      groups[p.module].push(p)
    })
    return groups
  }, [permissions])

  // Role filtering logic based on logged in user
  const canManageRole = (roleName: string) => {
    if (currentUser?.role === 'Super Admin') return true
    if (currentUser?.role === 'Admin') {
      return roleName !== 'Super Admin' && roleName !== 'Admin'
    }
    return true // Default fallback for other roles if they somehow access this
  }
  const availableRoles = roles.filter(r => canManageRole(r.name))

  // Access Control for the whole screen
  if (!hasPermission('VIEW_USERS') && currentUser?.role !== 'Admin' && currentUser?.role !== 'Super Admin') {
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

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center z-10 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-500" />
            Users & Permissions
          </h1>
          <p className="text-sm text-slate-500 font-medium">Manage POS users and access control</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {activeTab === 'users' ? (
            <button 
              onClick={() => openDrawer("add")}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          ) : (
            <button 
              onClick={() => openRoleDrawer("add")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Create Role
            </button>
          )}
        </div>
      </header>
      
      {/* Tabs */}
      <div className="px-6 pt-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'users' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" /> Users List
          </button>
          {hasPermission('MANAGE_ROLES') && (
            <button
              onClick={() => setActiveTab('roles')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'roles' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Settings2 className="w-4 h-4" /> Roles & Permissions
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}
        
        {activeTab === 'users' ? (
          <>
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
          </>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 border-b border-slate-200 w-1/4">Role Name</th>
                    <th className="px-6 py-4 border-b border-slate-200 w-2/4">Description</th>
                    <th className="px-6 py-4 border-b border-slate-200 w-1/4 text-right">Permissions</th>
                    <th className="px-6 py-4 border-b border-slate-200 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No roles found.
                      </td>
                    </tr>
                  ) : (
                    roles.map(role => (
                      <tr key={role.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 font-bold text-slate-800">
                          {role.name}
                          {role.is_system === 1 && (
                             <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">System</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{role.description || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            {role.permissions?.some((p:any) => p.code === '*') ? 'Full Access' : `${role.permissions?.length || 0} Assigned`}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {role.name !== 'Super Admin' && role.name !== 'Admin' && role.name !== 'Owner' && (
                              <>
                                <button 
                                  onClick={() => openRoleDrawer("edit", role)}
                                  title="Edit Role"
                                  className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteRole(role)}
                                  title="Delete Role"
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Users Drawer */}
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
                
                <form id="user-form" onSubmit={handleSaveUser} className="space-y-5">
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
                          value={formData.username}
                          onChange={(e) => setFormData({...formData, username: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
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
                      
                      <div className="flex items-center gap-3 mt-4 mb-2">
                        <input 
                          type="checkbox" 
                          id="showOnLogin"
                          checked={formData.showOnLogin}
                          onChange={(e) => setFormData({...formData, showOnLogin: e.target.checked})}
                          className="w-5 h-5 text-orange-500 border-slate-300 rounded focus:ring-orange-500"
                        />
                        <label htmlFor="showOnLogin" className="text-sm font-medium text-slate-700 cursor-pointer">
                          Show on Login Screen
                        </label>
                      </div>
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

      {/* Roles Drawer */}
      <AnimatePresence>
        {isRoleDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
              onClick={() => setIsRoleDrawerOpen(false)}
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[550px] max-w-full bg-white z-50 shadow-2xl flex flex-col border-l border-slate-200"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                <h2 className="text-xl font-bold text-slate-800">
                  {roleDrawerMode === 'add' ? 'Create Role' : 'Edit Role'}
                </h2>
                <button 
                  onClick={() => setIsRoleDrawerOpen(false)}
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
                
                <form id="role-form" onSubmit={handleSaveRole} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Role Name *</label>
                    <input 
                      type="text" 
                      required
                      value={roleFormData.name}
                      onChange={(e) => setRoleFormData({...roleFormData, name: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Description</label>
                    <input 
                      type="text" 
                      value={roleFormData.description}
                      onChange={(e) => setRoleFormData({...roleFormData, description: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">Permissions</h3>
                    <div className="space-y-6">
                      {Object.keys(groupedPermissions).map(module => (
                        <div key={module}>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{module}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {groupedPermissions[module].map(p => {
                              // Don't show the ALL '*' permission here to prevent accidental full access mapping manually.
                              if (p.code === '*') return null
                              
                              const isChecked = roleFormData.permissionIds.includes(p.id)
                              return (
                                <label 
                                  key={p.id} 
                                  className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${isChecked ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                                >
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked}
                                    onChange={() => togglePermission(p.id)}
                                    className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-600"
                                  />
                                  <div>
                                    <p className={`text-sm font-bold ${isChecked ? 'text-blue-800' : 'text-slate-700'}`}>
                                      {p.code.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{p.description}</p>
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsRoleDrawerOpen(false)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="role-form"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    "Save Role"
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
