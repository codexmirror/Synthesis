import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/base.css'
import './shell/shell.css'
import './apps/apps.css'
import './apps/terminal/terminal.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
