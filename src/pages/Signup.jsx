import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (password.length < 6) {
      setErr('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    })
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
          <div className="text-4xl mb-2">⚽</div>
          <h1 className="text-2xl font-bold">Crear cuenta</h1>
          <p className="text-sm text-ink-300">Polla Mundialista 2026 · 50.000 COP</p>
        </div>

        <div>
          <label className="label">Nombre y apellido</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="input"
            required
            placeholder="Santiago Moreno"
          />
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
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        {err && <div className="text-red-400 text-sm">{err}</div>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Creando…' : 'Crear cuenta'}
        </button>

        <p className="text-xs text-ink-500 text-center">
          Después de crear tu cuenta, transfiérele 50.000 COP a Dari y él te marcará como pagado.
        </p>

        <div className="text-center text-sm text-ink-300">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-brand-500 hover:underline">
            Inicia sesión
          </Link>
        </div>
      </form>
    </div>
  )
}
