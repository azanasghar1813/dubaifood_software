import { Outlet } from "react-router-dom"
import { useState, useEffect, lazy, Suspense } from "react"
import { PrinterManager } from "./components/PrinterManager"

import { KeyboardShortcutsModal } from "./components/KeyboardShortcutsModal"
import { usePrinterStore } from "./store/printerStore"
import { initSocket } from "./api/socketClient"

const KDS = lazy(() => import("./pages/KDS").then(m => ({ default: m.KDS })))

function App() {
  const [printerManagerOpen, setPrinterManagerOpen] = useState(false)
  const [kdsOpen, setKdsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => {
    initSocket();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || !!t?.isContentEditable
      if (typing && e.key !== 'Escape' && e.key !== 'F12' && !(e.ctrlKey && (e.key === '\\' || (e.shiftKey && e.key.toLowerCase() === 'p')))) {
        return
      }
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
      
      // Ctrl+P on POS is the Paid stamp toggle. Do not steal it here.
      
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
    usePrinterStore.getState().fetchPrinters()
  }, [])

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <main className="relative flex min-h-screen flex-col">
        <div className="flex-1">
          <Outlet />
        </div>
      </main>

      {/* Global Overlays */}
      {kdsOpen && (
        <Suspense fallback={null}>
          <KDS />
        </Suspense>
      )}
      <PrinterManager isOpen={printerManagerOpen} onClose={() => setPrinterManagerOpen(false)} />

      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}

export default App
