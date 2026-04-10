import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LandingPage from './components/LandingPage'
import './index.css'

function Root() {
  const [showDashboard, setShowDashboard] = useState(false)

  if (showDashboard) return <App />
  return <LandingPage onEnter={() => setShowDashboard(true)} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
