import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import DashboardLayout from './layouts/DashboardLayout.tsx'
import Login from './pages/Login.tsx'
import Dashboard from './pages/Dashboard.tsx'
import POS from './pages/POS.tsx'
import Orders from './pages/Orders.tsx'
import Products from './pages/Products.tsx'
import Categories from './pages/Categories.tsx'
import Customers from './pages/Customers.tsx'
import Reports from './pages/Reports.tsx'
import Employees from './pages/Employees.tsx'
import CashierManagement from './pages/CashierManagement.tsx'
import Settings from './pages/Settings.tsx'
import Synchronization from './pages/Synchronization.tsx'
import NotificationCenter from './pages/NotificationCenter.tsx'
import ReceiptPreview from './pages/ReceiptPreview.tsx'
import { KDS } from './pages/KDS.tsx'
import PrinterSettings from './pages/PrinterSettings.tsx'
import UsersPermissions from './pages/UsersPermissions.tsx'
import ActivityLogs from './pages/ActivityLogs.tsx'
import Backup from './pages/Backup.tsx'
import GlobalErrorBoundary from './components/GlobalErrorBoundary.tsx'
import { ToastProvider } from './components/ui/ToastProvider.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AppInitializer } from './components/AppInitializer.tsx'
import { useUIStore } from './store/uiStore.ts'

// Initialize theme on app load
useUIStore.getState()
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
          <DashboardLayout />
        </ProtectedRoute>
      </AppInitializer>
    ),
    errorElement: <GlobalErrorBoundary />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/pos", element: <POS /> },
      { path: "/orders", element: <Orders /> },
      { path: "/products", element: <Products /> },
      { path: "/categories", element: <Categories /> },
      { path: "/customers", element: <Customers /> },
      { path: "/reports", element: <Reports /> },
      { path: "/employees", element: <Employees /> },
      { path: "/cashier", element: <CashierManagement /> },
      { path: "/settings", element: <Settings /> },
      { path: "/sync", element: <Synchronization /> },
      { path: "/notifications", element: <NotificationCenter /> },
      { path: "/receipt", element: <ReceiptPreview /> },
      { path: "/settings/printer", element: <PrinterSettings /> },
      { path: "/permissions", element: <UsersPermissions /> },
      { path: "/activity-logs", element: <ActivityLogs /> },
      { path: "/backup", element: <Backup /> },
      { path: "/kds", element: <KDS /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <ToastProvider />
  </StrictMode>,
)
