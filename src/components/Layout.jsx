import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../lib/auth'

const navItems = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/predicciones', label: 'Partidos', icon: '⚽' },
  { to: '/grupos', label: 'Grupos', icon: '🅰️' },
  { to: '/terceros', label: 'Terceros', icon: '🥉' },
  { to: '/tabla', label: 'Tabla', icon: '🏆' },
]

const adminItems = [
  { to: '/admin/marcadores', label: 'Marcadores' },
  { to: '/admin/grupos', label: 'Resultados Grupos' },
  { to: '/admin/terceros', label: 'Mejores Terceros' },
  { to: '/admin/llaves', label: 'Llaves (eliminatorias)' },
  { to: '/admin/multas', label: 'Multas' },
  { to: '/admin/usuarios', label: 'Usuarios' },
  { to: '/admin/config', label: 'Config' },
]

export default function Layout() {
  const { profile, user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <header className="sticky top-0 z-30 bg-ink-800 border-b border-ink-700">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Dari-polla" className="w-9 h-9 rounded-full bg-white p-0.5" />
            <span className="font-bold text-lg">Dari-polla</span>
          </Link>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-2 rounded-lg hover:bg-ink-700"
            aria-label="Menú"
          >
            <span className="text-xl">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
        {menuOpen && (
          <div className="max-w-2xl mx-auto px-4 pb-3 space-y-1">
            <div className="px-3 py-2 text-sm text-ink-300">
              {profile?.display_name || user?.email}
              {profile?.is_admin && <span className="ml-2 pill bg-brand-600 text-white">ADMIN</span>}
              {profile && !profile.paid && <span className="ml-2 pill bg-yellow-600 text-white">PAGO PENDIENTE</span>}
            </div>
            <NavLink to="/perfil" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-ink-700">
              🎭 Mi perfil
            </NavLink>
            <NavLink to="/progreso" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-ink-700">
              📈 Mi progreso
            </NavLink>
            <NavLink to="/resumen" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-ink-700">
              📋 Resumen de fecha
            </NavLink>
            <NavLink to="/bracket" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-ink-700">
              🏆 Camino a la final
            </NavLink>
            <NavLink to="/revive" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-ink-700">
              📜 Revive el partido
            </NavLink>
            <NavLink to="/muro" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-ink-700">
              📰 Muro de actividad
            </NavLink>
            <NavLink to="/duelo" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-ink-700">
              ⚔️ Duelo
            </NavLink>
            <NavLink to="/comunidad" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-ink-700">
              📊 Estadísticas comunales
            </NavLink>
            <NavLink to="/reglas" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-ink-700">
              📜 Reglas y premios
            </NavLink>
            {profile?.is_admin && (
              <>
                <div className="px-3 pt-3 pb-1 text-xs uppercase tracking-wider text-ink-500">Admin</div>
                {adminItems.map(i => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded hover:bg-ink-700 ${isActive ? 'bg-ink-700 text-brand-500' : ''}`
                    }
                  >
                    🔧 {i.label}
                  </NavLink>
                ))}
              </>
            )}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 rounded hover:bg-ink-700 text-red-400"
            >
              ↩️ Cerrar sesión
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-ink-800 border-t border-ink-700">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {navItems.map(i => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2 text-xs ${
                  isActive ? 'text-brand-500' : 'text-ink-300'
                }`
              }
            >
              <span className="text-xl">{i.icon}</span>
              <span className="mt-0.5">{i.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
