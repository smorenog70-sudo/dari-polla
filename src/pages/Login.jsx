import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setErr(error.message)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <img src="/logo.png" alt="Dari-polla" className="w-24 h-24 mx-auto mb-3 rounded-full bg-white p-1" />
          <h1 className="text-2xl font-bold">Dari-polla</h1>
          <p className="text-sm text-ink-300">Polla Mundialista 2026</p>
        </div>

        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="input"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="input"
            required
            autoComplete="current-password"
          />
        </div>

        {err && <div className="text-red-400 text-sm">{err}</div>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="text-center text-sm text-ink-300">
          ¿No tienes cuenta?{' '}
          <Link to="/signup" className="text-brand-500 hover:underline">
            Regístrate
          </Link>
        </div>
      </form>
    </div>
  )
}
