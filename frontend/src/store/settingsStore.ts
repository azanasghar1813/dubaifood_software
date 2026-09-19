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
  logoBase64: string | null
  
  updateSettings: (settings: Partial<SettingsState>) => void
  fetchLogoBase64: () => Promise<void>
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
      currencySymbol: "Rs",
      receiptFooter: "Thank you for dining with us! Please come again.",
      logoBase64: null,
      
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
      fetchLogoBase64: async () => {
        const state = set;
        try {
          const response = await fetch(`${window.location.origin}/receipt_logo.png`);
          if (!response.ok) return;
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result && typeof reader.result === 'string') {
              set({ logoBase64: reader.result });
            }
          };
          reader.readAsDataURL(blob);
        } catch (e) {
          console.warn('Failed to load logo for printing', e);
        }
      }
    }),
    {
      name: 'settings-storage',
      version: 4,
      migrate: (persistedState: any, version: number) => {
        const next = { ...persistedState, taxRate: 0, currencySymbol: "Rs" }
        if (!version || version < 4) {
          next.address = "Opposite Akbar Plaza Near Waqas Nazir Printers Layyah Road,\nChowk Azam (Layyah)"
          next.phoneNumber = "0308-8020784, 0345-6420784"
          next.currencySymbol = "Rs"
        }
        return next
      },
    }
  )
)
