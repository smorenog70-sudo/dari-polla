import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    // El usuario volverá a /nueva-clave después de hacer click en el correo
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-clave`,
    })
    setLoading(false)
    if (error) {
      setErr(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <img src="/logo.png" alt="Dari-polla" className="w-20 h-20 mx-auto mb-3 rounded-full bg-white p-1" />
          <h1 className="text-xl font-bold">Recuperar contraseña</h1>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="text-center text-sm text-ink-100 bg-ink-900/50 rounded-lg p-4">
              📧 Te enviamos un correo a <strong>{email}</strong> con un enlace para
              crear una nueva contraseña.
              <div className="text-xs text-ink-400 mt-2">
                Revisa también tu carpeta de spam. El enlace funciona una sola vez.
              </div>
            </div>
            <Link to="/login" className="btn-primary w-full block text-center">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-ink-300 text-center">
              Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.
            </p>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                required
                autoComplete="email"
                placeholder="tu@correo.com"
              />
            </div>

            {err && <div className="text-red-400 text-sm">{err}</div>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>

            <div className="text-center text-sm text-ink-300">
              <Link to="/login" className="text-brand-500 hover:underline">
                Volver a iniciar sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
