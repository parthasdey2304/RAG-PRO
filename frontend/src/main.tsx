import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Security Gatekeeper Token for backend verification
const RAG_STUDIO_TOKEN = 'rag_sec_7f9b2d8e4c1a5b6f3e0d8c2a9e1b4f7a'

// Global fetch interceptor to securely attach x-studio-token to all /api/ requests
const originalFetch = window.fetch
window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/api/')) {
    const headers = new Headers(init.headers || {})
    if (!headers.has('x-studio-token')) {
      headers.set('x-studio-token', RAG_STUDIO_TOKEN)
    }
    return originalFetch(input, { ...init, headers })
  }
  return originalFetch(input, init)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
