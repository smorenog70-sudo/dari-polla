import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { LeagueDataProvider } from './lib/useLeagueData'
import Layout from './components/Layout'
import Login from './pages/Login'

// Code-splitting: cada página se descarga solo cuando el usuario navega a
// ella, en vez de meter las ~25 páginas (incluyendo todo el panel de admin)
// en un único bundle inicial de ~1MB.
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Home = lazy(() => import('./pages/Home'))
const Predictions = lazy(() => import('./pages/Predictions'))
const GroupsPredictions = lazy(() => import('./pages/GroupsPredictions'))
const ThirdsPredictions = lazy(() => import('./pages/ThirdsPredictions'))
const Podium = lazy(() => import('./pages/Podium'))
const Standings = lazy(() => import('./pages/Standings'))
const Rules = lazy(() => import('./pages/Rules'))
const CommunityStats = lazy(() => import('./pages/CommunityStats'))
const Profile = lazy(() => import('./pages/Profile'))
const Duel = lazy(() => import('./pages/Duel'))
const ActivityWall = lazy(() => import('./pages/ActivityWall'))
const Progress = lazy(() => import('./pages/Progress'))
const Simulator = lazy(() => import('./pages/Simulator'))
const GroupTables = lazy(() => import('./pages/GroupTables'))
const DataLab = lazy(() => import('./pages/DataLab'))
const FechaRecap = lazy(() => import('./pages/FechaRecap'))
const Bracket = lazy(() => import('./pages/Bracket'))
const MatchReplay = lazy(() => import('./pages/MatchReplay'))
const AdminBracket = lazy(() => import('./pages/AdminBracket'))
const AdminResults = lazy(() => import('./pages/AdminResults'))
const AdminGroupResults = lazy(() => import('./pages/AdminGroupResults'))
const AdminThirds = lazy(() => import('./pages/AdminThirds'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminFines = lazy(() => import('./pages/AdminFines'))
const AdminConfig = lazy(() => import('./pages/AdminConfig'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

function PageFallback() {
  return <div className="p-8 text-center text-ink-300">Cargando…</div>
}

function Protected({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="p-8 text-center text-ink-300">Cargando…</div>
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !profile?.is_admin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/recuperar" element={<ForgotPassword />} />
          <Route path="/nueva-clave" element={<ResetPassword />} />
          <Route element={<Protected><LeagueDataProvider><Layout /></LeagueDataProvider></Protected>}>
            <Route index element={<Home />} />
            <Route path="predicciones" element={<Predictions />} />
            <Route path="grupos" element={<GroupsPredictions />} />
            <Route path="terceros" element={<ThirdsPredictions />} />
            <Route path="podio" element={<Podium />} />
            <Route path="tabla" element={<Standings />} />
            <Route path="comunidad" element={<CommunityStats />} />
            <Route path="progreso" element={<Progress />} />
            <Route path="progreso/:userId" element={<Progress />} />
            <Route path="simulador" element={<Simulator />} />
            <Route path="grupos-mundial" element={<GroupTables />} />
            <Route path="laboratorio" element={<DataLab />} />
            <Route path="resumen" element={<FechaRecap />} />
            <Route path="bracket" element={<Bracket />} />
            <Route path="revive" element={<MatchReplay />} />
            <Route path="muro" element={<ActivityWall />} />
            <Route path="duelo" element={<Duel />} />
            <Route path="perfil" element={<Profile />} />
            <Route path="reglas" element={<Rules />} />
            <Route path="admin/dashboard" element={<Protected adminOnly><AdminDashboard /></Protected>} />
            <Route path="admin/marcadores" element={<Protected adminOnly><AdminResults /></Protected>} />
            <Route path="admin/grupos" element={<Protected adminOnly><AdminGroupResults /></Protected>} />
            <Route path="admin/terceros" element={<Protected adminOnly><AdminThirds /></Protected>} />
            <Route path="admin/llaves" element={<Protected adminOnly><AdminBracket /></Protected>} />
            <Route path="admin/usuarios" element={<Protected adminOnly><AdminUsers /></Protected>} />
            <Route path="admin/multas" element={<Protected adminOnly><AdminFines /></Protected>} />
            <Route path="admin/config" element={<Protected adminOnly><AdminConfig /></Protected>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
