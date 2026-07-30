import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, User, Phone, MapPin, StickyNote, Star, X, CheckCircle2, Plus } from "lucide-react"
import { usePosStore, type CustomerProfile } from "../store/posStore"

interface CustomerPanelModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CustomerPanelModal({ isOpen, onClose }: CustomerPanelModalProps) {
  const { setCustomer } = usePosStore()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Create Form State
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [newNotes, setNewNotes] = useState("")
  const [isVip, setIsVip] = useState(false)

  // Mock Database
  const [customers, setCustomers] = useState<CustomerProfile[]>([
    { id: "1", name: "Ahmed", phone: "0501234567", type: "Regular", isVip: true, address: "Marina", history: [{ date: '2023-10-01', amount: 150 }] },
    { id: "2", name: "Sarah", phone: "0559876543", type: "Regular", isVip: false, address: "JLT" },
  ])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  )

  const handleSelect = (c: CustomerProfile) => {
    setCustomer(c)
    onClose()
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newPhone) return
    const newCust: CustomerProfile = {
      id: Date.now().toString(),
      name: newName,
      phone: newPhone,
      address: newAddress,
      notes: newNotes,
      isVip,
      type: 'New'
    }
    setCustomers(prev => [newCust, ...prev])
    setCustomer(newCust)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex h-[600px] border border-border"
        >
          {/* Left Panel: Search & List */}
          <div className="w-1/2 border-r border-border flex flex-col bg-background">
            <div className="p-4 border-b border-border bg-card">
              <h2 className="text-lg font-black text-foreground mb-4">Customer Directory</h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by Phone, Name or ID..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {filteredCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                  <User className="w-12 h-12 mb-2" />
                  <p>No customers found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCustomers.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => handleSelect(c)}
                      className="w-full text-left p-3 rounded-xl hover:bg-secondary transition-colors flex items-center gap-3 group"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.isVip ? 'bg-orange-500/20 text-orange-500' : 'bg-primary/10 text-primary'}`}>
                        {c.isVip ? <Star className="w-5 h-5 fill-current" /> : <User className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-foreground group-hover:text-orange-500 transition-colors">{c.name}</p>
                          {c.isVip && <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">VIP</span>}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Create / Details */}
          <div className="w-1/2 flex flex-col bg-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-black text-foreground">Quick Create</h2>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold" placeholder="John Doe" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input required type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold" placeholder="050..." />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <textarea value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full h-20 pl-9 pr-4 pt-2.5 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold resize-none" placeholder="Delivery address..." />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notes</label>
                <div className="relative">
                  <StickyNote className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full h-20 pl-9 pr-4 pt-2.5 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold resize-none" placeholder="Allergies, preferences..." />
                </div>
              </div>

              <div className="pt-2 flex-1">
                <button 
                  type="button"
                  onClick={() => setIsVip(!isVip)}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between ${isVip ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-secondary hover:border-orange-500/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <Star className={`w-5 h-5 ${isVip ? 'text-orange-500 fill-orange-500' : 'text-muted-foreground'}`} />
                    <div className="text-left">
                      <p className={`font-bold ${isVip ? 'text-orange-500' : 'text-foreground'}`}>VIP Customer</p>
                      <p className="text-xs text-muted-foreground">Assign priority routing and loyalty benefits</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isVip ? 'border-orange-500 bg-orange-500' : 'border-muted-foreground'}`}>
                    {isVip && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                </button>
              </div>

              <div className="pt-4 mt-auto">
                <button type="submit" className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                  <Plus className="w-5 h-5" /> Save Customer
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
