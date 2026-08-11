import { Outlet } from "react-router-dom"
import { useState, useEffect } from "react"
import { PrinterManager } from "./components/PrinterManager"
import { PrintTemplates } from "./components/PrintTemplates"
import { KDS } from "./pages/KDS"
import { KeyboardShortcutsModal } from "./components/KeyboardShortcutsModal"
import { usePrinterStore } from "./store/printerStore"
import { useOrderStore } from "./store/orderStore"

function App() {
  const [printerManagerOpen, setPrinterManagerOpen] = useState(false)
  const [kdsOpen, setKdsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1 or Ctrl + / -> Global Shortcuts Map
      if (e.key === 'F1' || (e.ctrlKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen(prev => !prev)
      }
      // F12 -> KDS
      if (e.key === 'F12') {
        e.preventDefault()
        setKdsOpen(prev => !prev)
      }
      
      // Ctrl + Shift + P -> Print Manager
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPrinterManagerOpen(prev => !prev)
      }
      
      // Ctrl + P -> Print Last Receipt
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        const orders = useOrderStore.getState().orders
        if (orders.length > 0) {
          usePrinterStore.getState().enqueuePrintJob({
            type: 'Receipt',
            printerType: 'Receipt',
            content: JSON.stringify({ orderId: orders[orders.length - 1].id })
          })
        }
      }
      
      // Esc -> Close Modals
      if (e.key === 'Escape') {
        setKdsOpen(false)
        setPrinterManagerOpen(false)
        setShortcutsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <main className="relative flex min-h-screen flex-col">
        <div className="flex-1">
          <Outlet />
        </div>
      </main>

      {/* Global Overlays */}
      {kdsOpen && <KDS />}
      <PrinterManager isOpen={printerManagerOpen} onClose={() => setPrinterManagerOpen(false)} />
      <PrintTemplates />
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}

export default App
