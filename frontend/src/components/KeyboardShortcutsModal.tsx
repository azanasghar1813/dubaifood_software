import { motion, AnimatePresence } from "framer-motion"
import { X, Command } from "lucide-react"

interface Props {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { key: "F1", desc: "Show this help menu" },
  { key: "F2", desc: "Open Customer Directory" },
  { key: "F3", desc: "Focus Search Bar" },
  { key: "F4", desc: "Open Table Management" },
  { key: "F12", desc: "Toggle Kitchen Display (KDS)" },
  { key: "Ctrl + P", desc: "Print Last Receipt" },
  { key: "Ctrl + Shift + P", desc: "Printer Settings" },
  { key: "Esc", desc: "Close any open modal or clear search" },
  { key: "Arrows (↑↓)", desc: "Navigate Search Results" },
  { key: "Enter", desc: "Select Item / Complete Payment" },
]

export function KeyboardShortcutsModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }} 
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col"
        >
          <div className="p-6 border-b border-border bg-secondary/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 text-primary rounded-lg">
                <Command className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground">Global Keyboard Shortcuts</h2>
                <p className="text-xs text-muted-foreground font-bold">Universal Keyboard Mode Active</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SHORTCUTS.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/50">
                <span className="text-sm font-bold text-muted-foreground">{s.desc}</span>
                <span className="px-2 py-1 bg-background border border-border rounded-md text-xs font-black shadow-sm">{s.key}</span>
              </div>
            ))}
          </div>

          <div className="p-4 bg-primary/10 border-t border-primary/20 text-center">
            <p className="text-xs font-bold text-primary">Pro Tip: Use the keyboard to navigate the entire application without a mouse.</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
