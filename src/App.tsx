import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SupabaseWarning from './components/SupabaseWarning'
import NetworkStatusToast from './components/NetworkStatusToast'
import { ConflictResolutionModal } from './components/ConflictResolutionModal'
import { Toaster } from 'react-hot-toast'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Incomes from './pages/Incomes'
import Reports from './pages/Reports'
import Investments from './pages/Investments'
import CreditCards from './pages/CreditCards'
import Settings from './pages/Settings'
import Categories from './pages/Categories'
import ExpenseCategories from './pages/ExpenseCategories'
import IncomeCategories from './pages/IncomeCategories'
import OnboardingCategories from './pages/OnboardingCategories'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ConsultantDashboard from './pages/ConsultantDashboard'
import ClientDashboard from './pages/ClientDashboard'

function AppRoutes() {
  const { profile } = useAuth()

  // Se o usuário for um cliente de assessoria, a interface é restrita e somente-leitura
  if (profile?.role === 'client') {
    return (
      <Routes>
        <Route path="/" element={<ClientDashboard />} />
        <Route path="/*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // Consultor e Usuário Comum compartilham as funcionalidades de finanças
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/expense-categories" element={<ExpenseCategories />} />
      <Route path="/incomes" element={<Incomes />} />
      <Route path="/income-categories" element={<IncomeCategories />} />
      <Route path="/onboarding" element={<OnboardingCategories />} />
      <Route path="/investments" element={<Investments />} />
      
      {/* Rota exclusiva para consultores gerenciarem clientes */}
      {profile?.role === 'consultant' && (
        <Route path="/consulting" element={<ConsultantDashboard />} />
      )}
      
      <Route path="/credit-cards" element={<CreditCards />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SupabaseWarning />
          <NetworkStatusToast />
          <ConflictResolutionModal />
          <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff' } }} />
          <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Rotas Protegidas */}
            <Route path="/*" element={
              <ProtectedRoute>
                <Layout>
                  <AppRoutes />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App

