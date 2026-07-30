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
      phoneNumber: "+971 4 123 4567",
      address: "Sheikh Zayed Road, Dubai, UAE",
      trn: "100234567890",
      
      taxRate: 7,
      serviceChargeRate: 5,
      deliveryChargeRate: 50,
      currencySymbol: "AED",
      receiptFooter: "Thank you for dining with us! Please come again.",
      
      updateSettings: (settings) => set((state) => ({ ...state, ...settings }))
    }),
    {
      name: 'settings-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        // Force taxRate to 7 when migrating from old versions
        return { ...persistedState, taxRate: 7 }
      },
    }
  )
)
