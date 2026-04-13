import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SupabaseWarning from './components/SupabaseWarning'
import NetworkStatusToast from './components/NetworkStatusToast'
import { ConflictResolutionModal } from './components/ConflictResolutionModal'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Incomes from './pages/Incomes'
import Reports from './pages/Reports'
import Investments from './pages/Investments'
import CreditCards from './pages/CreditCards'
import Settings from './pages/Settings'
import CategoriesHome from './pages/CategoriesHome'
import Categories from './pages/Categories'
import IncomeCategories from './pages/IncomeCategories'
import OnboardingCategories from './pages/OnboardingCategories'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SupabaseWarning />
          <NetworkStatusToast />
          <ConflictResolutionModal />
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
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/categories" element={<CategoriesHome />} />
                    <Route path="/expense-categories" element={<Categories />} />
                    <Route path="/incomes" element={<Incomes />} />
                    <Route path="/income-categories" element={<IncomeCategories />} />
                    <Route path="/onboarding" element={<OnboardingCategories />} />
                    <Route path="/investments" element={<Investments />} />
                    <Route path="/credit-cards" element={<CreditCards />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
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

