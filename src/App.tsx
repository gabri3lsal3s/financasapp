import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SupabaseWarning from './components/SupabaseWarning'
import NetworkStatusToast from './components/NetworkStatusToast'
import { ConflictResolutionModal } from './components/ConflictResolutionModal'
import { Toaster } from 'react-hot-toast'
import Loader from './components/Loader'
import { NotificationsProvider } from '@/contexts/NotificationsContext'

// Páginas — carregadas sob demanda (code-splitting por rota)
const Dashboard           = lazy(() => import('./pages/Dashboard'))
const Expenses            = lazy(() => import('./pages/Expenses'))
const Incomes             = lazy(() => import('./pages/Incomes'))
const Reports             = lazy(() => import('./pages/Reports'))
const Investments         = lazy(() => import('./pages/Investments'))
const Contas               = lazy(() => import('./pages/Contas'))
const Settings            = lazy(() => import('./pages/Settings'))
const Categories          = lazy(() => import('./pages/Categories'))
const ExpenseCategories   = lazy(() => import('./pages/ExpenseCategories'))
const IncomeCategories    = lazy(() => import('./pages/IncomeCategories'))
const OnboardingCategories = lazy(() => import('./pages/OnboardingCategories'))
const Login               = lazy(() => import('./pages/Login'))
const Register            = lazy(() => import('./pages/Register'))
const ForgotPassword      = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword       = lazy(() => import('./pages/ResetPassword'))

const PageFallback = () => <Loader text="Carregando..." className="py-24" />

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/expense-categories" element={<ExpenseCategories />} />
        <Route path="/incomes" element={<Incomes />} />
        <Route path="/income-categories" element={<IncomeCategories />} />
        <Route path="/onboarding" element={<OnboardingCategories />} />
        <Route path="/investments" element={<Investments />} />
        <Route path="/contas" element={<Contas />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  )
}

function App() {

  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: true }}>
          <NotificationsProvider>
            <SupabaseWarning />
            <NetworkStatusToast />
            <ConflictResolutionModal />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--ds-color-surface-glass)',
                  color: 'var(--ds-color-text-primary)',
                  border: '1px solid var(--glass-border)',
                  backdropFilter: 'blur(12px)',
                },
              }}
            />
            <Routes>
              {/* Rotas Públicas */}
              <Route path="/login" element={<Suspense fallback={<PageFallback />}><Login /></Suspense>} />
              <Route path="/register" element={<Suspense fallback={<PageFallback />}><Register /></Suspense>} />
              <Route path="/forgot-password" element={<Suspense fallback={<PageFallback />}><ForgotPassword /></Suspense>} />
              <Route path="/reset-password" element={<Suspense fallback={<PageFallback />}><ResetPassword /></Suspense>} />

              {/* Rotas Protegidas */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <Layout>
                    <AppRoutes />
                  </Layout>
                </ProtectedRoute>
              } />
            </Routes>
          </NotificationsProvider>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App
