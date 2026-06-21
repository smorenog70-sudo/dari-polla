import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Home from './pages/Home'
import Predictions from './pages/Predictions'
import GroupsPredictions from './pages/GroupsPredictions'
import ThirdsPredictions from './pages/ThirdsPredictions'
import Standings from './pages/Standings'
import Rules from './pages/Rules'
import CommunityStats from './pages/CommunityStats'
import Profile from './pages/Profile'
import Duel from './pages/Duel'
import ActivityWall from './pages/ActivityWall'
import Progress from './pages/Progress'
import Simulator from './pages/Simulator'
import GroupTables from './pages/GroupTables'
import DataLab from './pages/DataLab'
import FechaRecap from './pages/FechaRecap'
import Bracket from './pages/Bracket'
import MatchReplay from './pages/MatchReplay'
import AdminBracket from './pages/AdminBracket'
import AdminResults from './pages/AdminResults'
import AdminGroupResults from './pages/AdminGroupResults'
import AdminThirds from './pages/AdminThirds'
import AdminUsers from './pages/AdminUsers'
import AdminFines from './pages/AdminFines'
import AdminConfig from './pages/AdminConfig'
import AdminDashboard from './pages/AdminDashboard'

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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/recuperar" element={<ForgotPassword />} />
        <Route path="/nueva-clave" element={<ResetPassword />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route index element={<Home />} />
          <Route path="predicciones" element={<Predictions />} />
          <Route path="grupos" element={<GroupsPredictions />} />
          <Route path="terceros" element={<ThirdsPredictions />} />
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
    </AuthProvider>
  )
}
