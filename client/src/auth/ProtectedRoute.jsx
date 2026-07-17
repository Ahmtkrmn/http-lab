import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { FullPageSpinner } from '../components/Feedback.jsx'

// Korumalı route deseni (TODO.md Week 9): giriş yapmamış kullanıcı /items'a
// gitmeye çalışırsa /login'e yönlendirilir. Üç dal:
//   loading   -> bootstrap (cookie ile sessiz giriş) sürüyor; karar VERME,
//                bekle. Yoksa oturumu olan kullanıcı her F5'te login görürdü.
//   anonymous -> /login'e yönlendir; gelmek istediği yeri state ile taşı ki
//                login sonrası kaldığı yere dönebilsin.
//   authenticated -> içeriği göster.
export default function ProtectedRoute({ children }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullPageSpinner label="Oturum kontrol ediliyor…" />
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
