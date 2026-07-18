import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TripLayout } from './components/TripLayout'
import { AuthProvider } from './lib/authContext'
import { Home } from './pages/Home'
import { Onboarding } from './pages/Onboarding'
import { Journey } from './pages/Journey'
import { Today } from './pages/Today'
import { Checklist } from './pages/Checklist'
import { Spese } from './pages/Spese'
import { Memories } from './pages/Memories'
import { Profilo } from './pages/Profilo'
import { Recap } from './pages/Recap'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/trip/:tripId" element={<TripLayout />}>
            <Route index element={<Navigate to="journey" replace />} />
            <Route path="journey" element={<Journey />} />
            <Route path="today" element={<Today />} />
            <Route path="checklist" element={<Checklist />} />
            <Route path="spese" element={<Spese />} />
            <Route path="memories" element={<Memories />} />
            <Route path="profilo" element={<Profilo />} />
            <Route path="recap" element={<Recap />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
