import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import DashboardLayout from './layouts/DashboardLayout.tsx'
import Login from './pages/Login.tsx'
import App from './App.tsx'
import { lazy, Suspense } from 'react'
import GlobalErrorBoundary from './components/GlobalErrorBoundary.tsx'
import { ToastProvider } from './components/ui/ToastProvider.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AppInitializer } from './components/AppInitializer.tsx'
import { useUIStore } from './store/uiStore.ts'
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'))
const POS = lazy(() => import('./pages/POS.tsx'))
const Orders = lazy(() => import('./pages/Orders.tsx'))
const Products = lazy(() => import('./pages/Products.tsx'))
const Categories = lazy(() => import('./pages/Categories.tsx'))
const Customers = lazy(() => import('./pages/Customers.tsx'))
const Reports = lazy(() => import('./pages/Reports.tsx'))
const CashierManagement = lazy(() => import('./pages/CashierManagement.tsx'))
const Settings = lazy(() => import('./pages/Settings.tsx'))
const Synchronization = lazy(() => import('./pages/Synchronization.tsx'))
const LanSync = lazy(() => import('./pages/LanSync.tsx'))
const NotificationCenter = lazy(() => import('./pages/NotificationCenter.tsx'))
const ReceiptPreview = lazy(() => import('./pages/ReceiptPreview.tsx'))
const KDS = lazy(() => import('./pages/KDS.tsx').then(m => ({ default: m.KDS })))
const UsersPermissions = lazy(() => import('./pages/UsersPermissions.tsx'))
const TablesManagement = lazy(() => import('./pages/TablesManagement.tsx'))
const ActivityLogs = lazy(() => import('./pages/ActivityLogs.tsx'))
const Backup = lazy(() => import('./pages/Backup.tsx'))

// Initialize theme on app load
useUIStore.getState()

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="flex h-full items-center justify-center p-8"><div className="animate-pulse flex flex-col items-center gap-4"><div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div><p className="text-muted-foreground">Loading module...</p></div></div>}>
    {children}
  </Suspense>
)

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: (
      <AppInitializer>
        <ProtectedRoute>
          <App />
        </ProtectedRoute>
      </AppInitializer>
    ),
    errorElement: <GlobalErrorBoundary />,
    children: [
      {
        path: "/",
        element: <DashboardLayout />,
        children: [
          { path: "/", element: <SuspenseWrapper><Dashboard /></SuspenseWrapper> },
          { path: "/dashboard", element: <SuspenseWrapper><Dashboard /></SuspenseWrapper> },
          { path: "/pos", element: <SuspenseWrapper><POS /></SuspenseWrapper> },
          { path: "/orders", element: <SuspenseWrapper><Orders /></SuspenseWrapper> },
          { path: "/products", element: <SuspenseWrapper><Products /></SuspenseWrapper> },
          { path: "/categories", element: <SuspenseWrapper><Categories /></SuspenseWrapper> },
          { path: "/customers", element: <SuspenseWrapper><Customers /></SuspenseWrapper> },
          { path: "/reports", element: <SuspenseWrapper><Reports /></SuspenseWrapper> },
          { path: "/employees", element: <Navigate to="/permissions" replace /> },
          { path: "/cashier", element: <SuspenseWrapper><CashierManagement /></SuspenseWrapper> },
          { path: "/settings", element: <SuspenseWrapper><Settings /></SuspenseWrapper> },
          { path: "/sync", element: <SuspenseWrapper><Synchronization /></SuspenseWrapper> },
          { path: "/lan-sync", element: <SuspenseWrapper><LanSync /></SuspenseWrapper> },
          { path: "/notifications", element: <SuspenseWrapper><NotificationCenter /></SuspenseWrapper> },
          { path: "/receipt", element: <SuspenseWrapper><ReceiptPreview /></SuspenseWrapper> },
          { path: "/tables", element: <SuspenseWrapper><TablesManagement /></SuspenseWrapper> },
          { path: "/permissions", element: <SuspenseWrapper><UsersPermissions /></SuspenseWrapper> },
          { path: "/activity-logs", element: <SuspenseWrapper><ActivityLogs /></SuspenseWrapper> },
          { path: "/backup", element: <SuspenseWrapper><Backup /></SuspenseWrapper> },
          { path: "/kds", element: <SuspenseWrapper><KDS /></SuspenseWrapper> },
        ],
      }
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <ToastProvider />
  </StrictMode>,
)
