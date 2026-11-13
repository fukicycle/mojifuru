import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fukicycle/design/css/tokens.css'
import '@fukicycle/design/css/material.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
