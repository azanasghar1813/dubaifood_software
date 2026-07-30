import { useState, useEffect } from "react"
import {  UserPlus, Phone, Mail, Loader2 } from "lucide-react"
import { api } from "../services/api"

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.getCustomers()
        setCustomers(result)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[calc(100vh-100px)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">CRM and loyalty program management.</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md shadow-primary/20 w-fit">
          <UserPlus className="w-4 h-4" /> New Customer
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((cust) => {
          const totalSpent = Number(cust.totalSpent) || 0;
          const points = cust.loyaltyPoints || cust.points || 0;
          return (
          <div key={cust.id} className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-5 hover:border-primary/50 transition-colors shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
                {cust.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold">{cust.name}</h3>
                <p className="text-xs text-muted-foreground">{cust.id}</p>
              </div>
            </div>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" /> {cust.phone}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" /> {cust.email}
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-border/50 pt-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Spent</p>
                <p className="font-bold text-lg">${totalSpent.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Loyalty Pts</p>
                <p className="font-bold text-primary text-lg">{points}</p>
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}
