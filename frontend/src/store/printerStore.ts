import { create } from 'zustand'

export type PrinterType = 'Receipt' | 'Fast Food' | 'Restaurant'
export type PrintJobStatus = 'Pending' | 'Printing' | 'Completed' | 'Failed'

export interface PrintJob {
  id: string
  type: 'Receipt' | 'KitchenTicket'
  printerType: PrinterType
  content: string // HTML or template reference
  status: PrintJobStatus
  timestamp: string
  retries: number
  metadata?: any
}

export interface Printer {
  id: string
  name: string
  type: PrinterType
  status: 'Online' | 'Offline' | 'Error'
  lastPrint?: string
  connectionType: 'USB' | 'LAN' | 'Wi-Fi' | 'Bluetooth'
}

interface PrinterState {
  printers: Printer[]
  printQueue: PrintJob[]
  settings: {
    receiptWidth: '58mm' | '80mm'
    copies: number
    autoPrintReceipt: boolean
    autoPrintKitchen: boolean
    receiptFooter: string
    cutPaper: boolean
  }

  // Actions
  enqueuePrintJob: (job: Omit<PrintJob, 'id' | 'status' | 'timestamp' | 'retries'>) => void
  retryPrintJob: (jobId: string) => void
  cancelPrintJob: (jobId: string) => void
  updatePrinterStatus: (printerId: string, status: Printer['status']) => void
  updateSettings: (settings: Partial<PrinterState['settings']>) => void
  simulatePrintProcess: () => void // Internal mock logic
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  printers: [
    { id: 'p-1', name: 'Main Cashier USB', type: 'Receipt', status: 'Online', connectionType: 'USB' },
    { id: 'p-2', name: 'Fast Food Station', type: 'Fast Food', status: 'Online', connectionType: 'LAN' },
    { id: 'p-3', name: 'Restaurant Kitchen', type: 'Restaurant', status: 'Online', connectionType: 'Wi-Fi' },
  ],
  printQueue: [],
  settings: {
    receiptWidth: '80mm',
    copies: 1,
    autoPrintReceipt: true,
    autoPrintKitchen: true,
    receiptFooter: 'Thank you for your visit!',
    cutPaper: true
  },

  enqueuePrintJob: (job) => {
    const newJob: PrintJob = {
      ...job,
      id: `print-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'Pending',
      timestamp: new Date().toISOString(),
      retries: 0
    }
    set(state => ({ printQueue: [newJob, ...state.printQueue] }))
    
    // Simulate printing process
    setTimeout(() => {
      get().simulatePrintProcess()
    }, 500)
  },

  retryPrintJob: (jobId) => {
    set(state => ({
      printQueue: state.printQueue.map(job => 
        job.id === jobId ? { ...job, status: 'Pending', retries: job.retries + 1 } : job
      )
    }))
    setTimeout(() => {
      get().simulatePrintProcess()
    }, 500)
  },

  cancelPrintJob: (jobId) => {
    set(state => ({
      printQueue: state.printQueue.filter(job => job.id !== jobId)
    }))
  },

  updatePrinterStatus: (printerId, status) => {
    set(state => ({
      printers: state.printers.map(p => 
        p.id === printerId ? { ...p, status } : p
      )
    }))
  },

  updateSettings: (newSettings) => {
    set(state => ({
      settings: { ...state.settings, ...newSettings }
    }))
  },

  simulatePrintProcess: () => {
    const { printQueue, printers } = get()
    
    const pendingJobs = printQueue.filter(j => j.status === 'Pending')
    if (pendingJobs.length === 0) return

    pendingJobs.forEach(job => {
      const targetPrinter = printers.find(p => p.type === job.printerType)
      
      if (!targetPrinter || targetPrinter.status === 'Offline' || targetPrinter.status === 'Error') {
        // Fail job if printer unavailable
        set(state => ({
          printQueue: state.printQueue.map(j => 
            j.id === job.id ? { ...j, status: 'Failed' } : j
          )
        }))
        return
      }

      // Transition to printing
      set(state => ({
        printQueue: state.printQueue.map(j => 
          j.id === job.id ? { ...j, status: 'Printing' } : j
        )
      }))

      // Complete print after delay
      setTimeout(() => {
        set(state => ({
          printQueue: state.printQueue.map(j => 
            j.id === job.id ? { ...j, status: 'Completed' } : j
          ),
          printers: state.printers.map(p => 
            p.id === targetPrinter.id ? { ...p, lastPrint: new Date().toISOString() } : p
          )
        }))
      }, 1500) // Simulate 1.5 seconds to print
    })
  }
}))
