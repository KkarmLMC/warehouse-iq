/* ── Stale chunk recovery ──────────────────────────────────────────────────────
   After a deploy, cached index.html may reference JS chunks with old hashes
   that no longer exist on the server. Vite fires this event when a preloaded
   module fails to fetch. We catch it and reload once to get fresh assets.    */
window.addEventListener('vite:preloadError', () => {
  const last = sessionStorage.getItem('chunk-reload')
  if (!last || Date.now() - Number(last) > 10000) {
    sessionStorage.setItem('chunk-reload', String(Date.now()))
    window.location.reload()
  }
})

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/useAuth.jsx'
import '@kkarm-lmc/shared/styles/globals.css'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
