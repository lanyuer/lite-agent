//import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
//import App from './App.tsx'
import AppWithEvents from './AppWithEvents.tsx'
//import TestEvents from './TestEvents.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<AppWithEvents />} />
      <Route path="/task/:taskId" element={<AppWithEvents />} />
    </Routes>
  </BrowserRouter>
)
