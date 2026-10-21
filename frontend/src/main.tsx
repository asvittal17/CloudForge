import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installErrorMonitoring } from './lib/errorReporter'

// Global frontend error monitoring (uncaught errors, promise rejections,
// API failures). Installed before render so first-paint failures are seen.
installErrorMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
