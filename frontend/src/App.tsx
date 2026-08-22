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
      // Ctrl+\ -> Global Shortcuts Map
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault()
        e.stopImmediatePropagation()
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

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const handleMouseMove = () => {
      document.body.style.cursor = 'default'
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        document.body.style.cursor = 'none'
      }, 5000)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mousedown', handleMouseMove)
    window.addEventListener('wheel', handleMouseMove, { passive: true })
    
    // Initialize the timeout
    handleMouseMove()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseMove)
      window.removeEventListener('wheel', handleMouseMove)
      clearTimeout(timeoutId)
      document.body.style.cursor = 'default'
    }
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
