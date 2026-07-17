import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ItemsPage from './pages/ItemsPage.jsx'

// Route haritası bilinçli olarak küçük: /login (herkese açık) ve /items
// (korumalı). Bilinmeyen her path /items'a yönlenir — /items korumalı olduğu
// için oturumu olmayan kullanıcı oradan da /login'e düşer.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/items"
        element={
          <ProtectedRoute>
            <ItemsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/items" replace />} />
    </Routes>
  )
}
