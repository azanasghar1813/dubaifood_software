import { motion, AnimatePresence } from "framer-motion"
import { X, Command } from "lucide-react"

interface Props {
  isOpen: boolean
  onClose: () => void
}

type ShortcutCategory = {
  category: string;
  shortcuts: { key: string; desc: string; detail: string }[];
};

const SHORTCUT_GROUPS: ShortcutCategory[] = [
  {
    category: "Global Application",
    shortcuts: [
      { key: "Ctrl + \\", desc: "Show Keyboard Shortcuts Help", detail: "Opens this detailed menu from anywhere in the app." },
      { key: "Ctrl + Shift + R", desc: "Refresh Software", detail: "Fully reloads the software and clears cache." },
      { key: "F12", desc: "Toggle Kitchen Display System (KDS)", detail: "Quickly switch to the kitchen view to manage orders." },
      { key: "Ctrl + P", desc: "Print Last Receipt", detail: "Instantly sends the most recent order to the receipt printer." },
      { key: "Ctrl + Shift + P", desc: "Printer Settings", detail: "Open the global printer management and status panel." },
      { key: "Esc", desc: "Close Modals / Clear Focus", detail: "Closes any open popup, modal, or resets the current input focus." },
    ]
  },
  {
    category: "Point of Sale (POS) - Navigation",
    shortcuts: [
      { key: "Ctrl + ↑/↓", desc: "Cycle Categories", detail: "Move instantly between categories like Fast Food or Deals without the mouse." },
      { key: "Arrow Keys (↑↓←→)", desc: "Navigate Menus & Cart", detail: "Move between product categories, items, and the cart seamlessly." },
      { key: "Enter", desc: "Select Item / Open Checkout", detail: "Adds highlighted item to cart, or opens payment window if cart is focused." },
      { key: "Ctrl + Enter", desc: "Fast Cash Payment", detail: "Instantly checks out the order using Exact Cash." },
      { key: "Tab", desc: "Switch Focus Area", detail: "Cycle focus between Categories, Menu Items, and the Cart." },
      { key: "Ctrl + S", desc: "Toggle Service Charges", detail: "Toggle whether service charges apply to the current order." },
      { key: "Ctrl + O", desc: "View Held Orders", detail: "Opens the list of Draft/Held orders to resume." },
    ]
  },
  {
    category: "Point of Sale (POS) - Cart & Items",
    shortcuts: [
      { key: "Delete / Backspace", desc: "Remove Item", detail: "Removes the currently highlighted item from the cart." },
      { key: "+ / -", desc: "Adjust Quantity", detail: "Increases or decreases the quantity of the selected cart item." },
      { key: "Ctrl + D", desc: "Apply Discount", detail: "Opens the discount modal for the current order." },
      { key: "Ctrl + N", desc: "Add Order Note", detail: "Attach a special instruction or note to the entire order." },
      { key: "Ctrl + K", desc: "Toggle Kitchen Print", detail: "Toggle whether the order should be sent to the kitchen." },
      { key: "Ctrl + C", desc: "Select Customer", detail: "Opens the customer database to attach a customer to the order." },
      { key: "Ctrl + W", desc: "Select Waiter / Rider", detail: "Opens the waiter or rider selection panel depending on the order type." },
    ]
  },
  {
    category: "Cashier & Shift Management",
    shortcuts: [
      { key: "F2", desc: "Search Transactions", detail: "Focuses the search bar to find past orders or shift logs." },
      { key: "F4", desc: "Cash Drop", detail: "Opens the cash drop modal to transfer cash to the safe." },
      { key: "F5", desc: "Refresh Data", detail: "Forces a refresh of shift data and transaction logs." },
      { key: "F6", desc: "Print Shift Report", detail: "Prints the current mid-shift (Z/X) report." },
      { key: "F8", desc: "Close Shift", detail: "Initiates the End of Shift / Drawer Close sequence." },
    ]
  },
  {
    category: "Customer Directory",
    shortcuts: [
      { key: "Ctrl + V", desc: "Toggle VIP Status", detail: "Marks the selected customer as a VIP." },
      { key: "Ctrl + N", desc: "Add Customer Note", detail: "Opens the customer note editor." },
    ]
  }
];

export function KeyboardShortcutsModal({ isOpen, onClose }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-card w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0">
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
            
            <div className="p-6 overflow-y-auto space-y-8">
              {SHORTCUT_GROUPS.map((group, gIdx) => (
                <div key={gIdx} className="space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary/80 border-b border-border/50 pb-2">{group.category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.shortcuts.map((s, idx) => (
                      <div key={idx} className="flex flex-col p-3 rounded-xl bg-secondary/50 border border-border/50 hover:bg-secondary transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-foreground">{s.desc}</span>
                          <span className="px-2 py-1 bg-background border border-border rounded-md text-xs font-black shadow-sm">{s.key}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-primary/10 border-t border-primary/20 text-center shrink-0">
              <p className="text-xs font-bold text-primary">Pro Tip: Use the keyboard to navigate the entire application without a mouse.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
