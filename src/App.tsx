import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAppSettings } from '@/hooks/useAppSettings'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SupabaseWarning from './components/SupabaseWarning'
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
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import { runAssistantPrivacyCleanup } from '@/utils/assistantPrivacy'

function App() {
  const { assistantDataRetentionDays, screenRotationAllowed } = useAppSettings()

  useEffect(() => {
    runAssistantPrivacyCleanup(assistantDataRetentionDays)
  }, [assistantDataRetentionDays])

  useEffect(() => {
    // Gerenciamento de orientação de tela
    const lockOrientation = async () => {
      try {
        const orientation = (window.screen as any).orientation
        if (!screenRotationAllowed && orientation?.lock) {
          // Tenta travar em retrato se a rotação não for permitida
          // Alguns navegadores exigem modo tela cheia para travar, então tratamos o erro silenciosamente
          await orientation.lock('portrait')
        } else if (screenRotationAllowed && orientation?.unlock) {
          orientation.unlock()
        }
      } catch (error) {
        // Ignora erros de bloqueio de orientação (comum em navegadores que não suportam ou exigem fullscreen)
        console.warn('Screen orientation lock failed:', error)
      }
    }

    lockOrientation()
  }, [screenRotationAllowed])

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SupabaseWarning />
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
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

