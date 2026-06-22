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

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'

async function fetchAllShareHistory(portfolioId: string): Promise<any[]> {
  let allShares: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('portfolio_share_daily')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('rate_date', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allShares = [...allShares, ...data]
      if (data.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  return allShares
}

function App() {
  useEffect(() => {
    async function dump() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        const [portfoliosRes, defsRes, pricesRes] = await Promise.all([
          supabase.from('portfolios').select('*'),
          supabase.from('portfolio_asset_definitions').select('*'),
          supabase.from('asset_prices').select('*')
        ])

        const portfolio = portfoliosRes.data?.[0]
        if (!portfolio) return

        const [txs, shares] = await Promise.all([
          fetchAllPortfolioTransactions(portfolio.id),
          fetchAllShareHistory(portfolio.id)
        ])

        await fetch('/api/dump-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txs: txs,
            shares: shares,
            portfolios: portfoliosRes.data || [],
            definitions: defsRes.data || [],
            prices: pricesRes.data || []
          })
        })
        console.log('DUMPED DATABASE DATA TO tmp_dump.json!')
      } catch (err) {
        console.error('Error dumping data:', err)
      }
    }
    dump()
  }, [])

  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NotificationsProvider>
            <SupabaseWarning />
            <NetworkStatusToast />
            <ConflictResolutionModal />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
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
