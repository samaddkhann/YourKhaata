import { useEffect } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { useDispatch } from "react-redux"
import { Toaster } from "react-hot-toast"
import api from "./utils/api"
import { setUserData } from "./redux/userSlice"
import Auth from "./pages/Auth"
import Dashboard from "./pages/Dashboard"
import Businesses from "./pages/Businesses"
import Customers from "./pages/Customers"
import CustomerLedger from "./pages/CustomerLedger"
import Reminders from "./pages/Reminders"
import Reports from "./pages/Reports"
import Invoices from "./pages/Invoices"
import InvoiceForm from "./pages/InvoiceForm"
import InvoiceView from "./pages/InvoiceView"
import Inventory from "./pages/Inventory"
import Settings from "./pages/Settings"
import ProtectedRoute from "./components/ProtectedRoute"
import AppLayout from "./components/AppLayout"

function App() {
  const dispatch = useDispatch()

  // On every page load, ask the server who is logged in (the cookie decides)
  useEffect(() => {
    const getUser = async () => {
      try {
        const result = await api.get("/api/user/current-user")
        dispatch(setUserData(result.data))
      } catch (error) {
        dispatch(setUserData(null))
      }
    }
    getUser()
  }, [dispatch])

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { border: "1px solid #e5e7eb", color: "#1f2937", background: "#fff", borderRadius: "12px" },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/auth" element={<Auth />} />

        {/* Pages that need login, all inside the same layout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/businesses" element={<Businesses />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:customerId" element={<CustomerLedger />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/new" element={<InvoiceForm />} />
          <Route path="/invoices/:invoiceId" element={<InvoiceView />} />
          <Route path="/invoices/:invoiceId/edit" element={<InvoiceForm />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App