import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import './theme.css'

const host = document.getElementById('app')
if (host) createRoot(host).render(<App />)
