import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
    setUsers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggle = async (id, field, value) => {
    setMsg('')
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', id)
    if (error) {
      setMsg('❌ ' + error.message)
    } else {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u))
      setMsg(`✅ Actualizado`)
      setTimeout(() => setMsg(''), 1500)
    }
  }

  if (loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const paidCount = users.filter(u => u.paid).length

  return (
    <div className="space-y-3">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🔧 Usuarios</h1>
        <p className="text-xs text-ink-300">
          Confirma los pagos de 50.000 COP y nombra otros admins.
        </p>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span>Total: {users.length}</span>
          <span className="text-brand-500 font-medium">{paidCount} pagaron</span>
        </div>
      </div>

      {msg && <div className="text-sm text-center bg-ink-800 rounded-lg px-3 py-2">{msg}</div>}

      <div className="card p-0 overflow-hidden">
        {users.map(u => (
          <div key={u.id} className="p-3 border-b border-ink-700 last:border-b-0">
            <div className="font-medium">{u.display_name}</div>
            <div className="text-xs text-ink-500 mt-0.5 break-all">{u.id.slice(0, 8)}…</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => toggle(u.id, 'paid', !u.paid)}
                className={`btn ${u.paid ? 'btn-ghost' : 'btn-primary'}`}
              >
                {u.paid ? '✅ Pagó' : '💰 Marcar pagado'}
              </button>
              <button
                onClick={() => toggle(u.id, 'is_admin', !u.is_admin)}
                className={`btn ${u.is_admin ? 'btn-ghost' : 'btn-ghost'}`}
              >
                {u.is_admin ? '👑 Admin' : 'Hacer admin'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
