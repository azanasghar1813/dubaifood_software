import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  restaurantName: string
  phoneNumber: string
  address: string
  trn: string
  
  taxRate: number
  serviceChargeRate: number
  deliveryChargeRate: number
  currencySymbol: string
  receiptFooter: string
  
  updateSettings: (settings: Partial<SettingsState>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      restaurantName: "Dubai Foods",
      phoneNumber: "0308-8020784, 0345-6420784",
      address: "Opposite Akbar Plaza Near Waqas Nazir Printers Layyah Road,\nChowk Azam (Layyah)",
      trn: "100234567890",
      
      taxRate: 0,
      serviceChargeRate: 5,
      deliveryChargeRate: 50,
      currencySymbol: "AED",
      receiptFooter: "Thank you for dining with us! Please come again.",
      
      updateSettings: (settings) => set((state) => ({ ...state, ...settings }))
    }),
    {
      name: 'settings-storage',
      version: 3,
      migrate: (persistedState: any, version: number) => {
        const next = { ...persistedState, taxRate: 0 }
        if (!version || version < 3) {
          next.address = "Opposite Akbar Plaza Near Waqas Nazir Printers Layyah Road,\nChowk Azam (Layyah)"
          next.phoneNumber = "0308-8020784, 0345-6420784"
        }
        return next
      },
    }
  )
)
