import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  // Cuando el usuario llega desde el correo, Supabase establece una sesión
  // temporal de tipo "recovery". Esperamos a que esa sesión esté lista.
  useEffect(() => {
    // El evento PASSWORD_RECOVERY confirma que venimos de un enlace válido
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true)
      }
    })
    // También revisamos si ya hay sesión activa al cargar
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true)
    })
    return () => sub?.subscription?.unsubscribe?.()
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (password.length < 6) {
      setErr('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setErr('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setErr(error.message)
    } else {
      setDone(true)
      setTimeout(() => navigate('/'), 1800)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <img src="/logo.png" alt="Dari-polla" className="w-20 h-20 mx-auto mb-3 rounded-full bg-white p-1" />
          <h1 className="text-xl font-bold">Nueva contraseña</h1>
        </div>

        {done ? (
          <div className="text-center text-sm text-ink-100 bg-ink-900/50 rounded-lg p-4">
            ✅ ¡Listo! Tu contraseña fue actualizada. Entrando…
          </div>
        ) : !ready ? (
          <div className="text-center text-sm text-ink-300 py-4">
            <p>Verificando tu enlace…</p>
            <p className="text-xs text-ink-500 mt-2">
              Si llegaste aquí sin usar el enlace del correo, vuelve a{' '}
              <a href="/recuperar" className="text-brand-500 hover:underline">solicitarlo</a>.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-ink-300 text-center">
              Escribe tu nueva contraseña.
            </p>
            <div>
              <label className="label">Nueva contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="input"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {err && <div className="text-red-400 text-sm">{err}</div>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
