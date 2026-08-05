import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, User, Phone, MapPin, StickyNote, Star, X, CheckCircle2, Plus } from "lucide-react"
import { usePosStore } from "../store/posStore"
import toast from "react-hot-toast"

import { customerService } from "../services/customerService"

interface CustomerPanelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CustomerPanelModal({ isOpen, onClose, onSuccess }: CustomerPanelModalProps) {
  const { setCustomer } = usePosStore()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Create Form State
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [newNotes, setNewNotes] = useState("")
  const [isVip, setIsVip] = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLTextAreaElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [activeInput, setActiveInput] = useState<number>(1) // 0: Name, 1: Phone, 2: Address, 3: Notes

  const fetchCustomers = async () => {
    try {
      const res: any = await customerService.getCustomers()
      if (res.success || res.data?.success || res.status === 200) {
        const mapped = (res.data || []).map((c: any) => ({
          ...c,
          name: c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Guest'
        }))
        setCustomers(mapped)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchCustomers()
      setSearchQuery("")
      setNewName("")
      setNewPhone("")
      setNewAddress("")
      setNewNotes("")
      setIsVip(false)
      setSelectedIndex(-1)
      setActiveInput(1)
      setTimeout(() => phoneRef.current?.focus(), 100)
    }
  }, [isOpen])

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone || '').includes(searchQuery)
  )

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle VIP shortcut
      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        setIsVip(v => !v)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(0, prev - 1))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(filteredCustomers.length - 1, prev + 1))
      } else if (e.key === 'ArrowLeft') {
        // e.preventDefault() // Don't prevent default, allow text cursor to move if they are typing, just focus if at edges? Actually prompt requested side arrows to move. We'll just shift focus.
        // It's safer to only move focus if they hold a modifier or we can just move it.
        setActiveInput(prev => {
          const next = Math.max(0, prev - 1)
          focusInput(next)
          return next
        })
      } else if (e.key === 'ArrowRight') {
        setActiveInput(prev => {
          const next = Math.min(3, prev + 1)
          focusInput(next)
          return next
        })
      } else if (e.key === 'Enter') {
        // if inside search bar, select the highlighted customer.
        if (document.activeElement === searchInputRef.current) {
          e.preventDefault()
          if (selectedIndex >= 0 && filteredCustomers[selectedIndex]) {
            handleSelect(filteredCustomers[selectedIndex])
          }
        }
        // If focused on other inputs (phone, name, address), allow the default form submission to handle it.
      } else if (e.key === 'Backspace' && searchQuery === '' && document.activeElement === searchInputRef.current) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCustomers, selectedIndex, searchQuery, onClose])

  const focusInput = (index: number) => {
    if (index === 0) nameRef.current?.focus()
    else if (index === 1) phoneRef.current?.focus()
    else if (index === 2) addressRef.current?.focus()
    else if (index === 3) notesRef.current?.focus()
  }

  const handleSelect = (c: any) => {
    setCustomer(c)
    onClose()
    if (onSuccess) onSuccess()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    // Name is not mandatory, if empty write Guest
    const finalName = newName.trim() === '' ? 'Guest' : newName
    if (!newPhone) {
      toast.error('Phone number is required')
      return
    }
    
    const newCust: any = {
      first_name: finalName,
      name: finalName, // Keep name for frontend state
      phone: newPhone,
      address: newAddress,
      notes: newNotes,
      is_vip: isVip,
    }
    try {
      const res: any = await customerService.createCustomer(newCust)
      if (res.success || res.data?.success || res.id || res.data?.id) {
        setCustomer(res.data || res)
        onClose()
        if (onSuccess) onSuccess()
      } else {
        toast.error("Failed to create customer")
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err?.response?.data?.error || err?.message || "Error saving customer")
    }
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
                  {filteredCustomers.map((c, i) => (
                    <button 
                      key={c.id || i} 
                      onClick={() => handleSelect(c)}
                      className={`w-full text-left p-3 rounded-xl hover:bg-secondary transition-colors flex items-center gap-3 group ${selectedIndex === i ? 'bg-secondary ring-2 ring-orange-500' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.is_vip || c.isVip ? 'bg-orange-500/20 text-orange-500' : 'bg-primary/10 text-primary'}`}>
                        {c.is_vip || c.isVip ? <Star className="w-5 h-5 fill-current" /> : <User className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-foreground group-hover:text-orange-500 transition-colors">{c.name}</p>
                          {(c.is_vip || c.isVip) && <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">VIP</span>}
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
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input ref={nameRef} onFocus={() => setActiveInput(0)} type="text" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate(e as any); } }} className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold" placeholder="Guest" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input ref={phoneRef} onFocus={() => setActiveInput(1)} required type="text" value={newPhone} onChange={e => {
                      let val = e.target.value.replace(/[^0-9]/g, '');
                      val = val.slice(0, 11);
                      if (val.length > 4) {
                        val = val.slice(0, 4) + '-' + val.slice(4);
                      }
                      setNewPhone(val);
                    }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate(e as any); } }} className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold" placeholder="03XX-XXXXXXX" maxLength={12} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <textarea ref={addressRef} onFocus={() => setActiveInput(2)} value={newAddress} onChange={e => setNewAddress(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate(e as any); } }} className="w-full h-20 pl-9 pr-4 pt-2.5 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold resize-none" placeholder="Delivery address..." />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notes</label>
                <div className="relative">
                  <StickyNote className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <textarea ref={notesRef} onFocus={() => setActiveInput(3)} value={newNotes} onChange={e => setNewNotes(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate(e as any); } }} className="w-full h-20 pl-9 pr-4 pt-2.5 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold resize-none" placeholder="Allergies, preferences..." />
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
                      <p className={`font-bold ${isVip ? 'text-orange-500' : 'text-foreground'}`}>VIP Customer <span className="opacity-50 text-[10px] ml-1">(CTRL + V)</span></p>
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
