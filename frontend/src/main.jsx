import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // Shtojmë këtë rresht
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* Mbështjellim App me BrowserRouter */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
)