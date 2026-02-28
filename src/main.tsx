import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import OfflineSyncManager from './components/OfflineSyncManager'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <OfflineSyncManager />
      <PwaUpdatePrompt />
    </ErrorBoundary>
  </React.StrictMode>,
)

