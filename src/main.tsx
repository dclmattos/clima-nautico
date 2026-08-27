/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)

// Registrar Service Worker para suporte a PWA e funcionamento offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registrado com sucesso:', registration.scope)
      })
      .catch((error) => {
        console.warn('[PWA] Falha ao registrar Service Worker:', error)
      })
  })
}
