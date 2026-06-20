import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminConfig() {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('config').select('*')
    const c = {}
    for (const r of data || []) c[r.key] = r.value
    setConfig(c)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const set = (key, value) => setConfig(prev => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    setMsg('')
    const rows = [
      { key: 'entry_fee', value: Number(config.entry_fee) || 50000 },
      { key: 'fine_amount', value: Number(config.fine_amount) || 5000 },
      { key: 'knockouts_enabled', value: !!config.knockouts_enabled },
      { key: 'predictions_locked', value: !!config.predictions_locked },
    ]
    const { error } = await supabase.from('config').upsert(rows, { onConflict: 'key' })
    setSaving(false)
    if (error) {
      setMsg('❌ ' + error.message)
    } else {
      setMsg('✅ Guardado')
      setTimeout(() => setMsg(''), 2000)
    }
  }

  if (loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3 pb-24">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🔧 Configuración</h1>
      </div>

      {/* BLOQUEO DE EMERGENCIA — destacado */}
      <div className={`card border-2 ${config.predictions_locked ? 'border-red-500 bg-red-900/20' : 'border-ink-600'}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!config.predictions_locked}
            onChange={async e => {
              const val = e.target.checked
              set('predictions_locked', val)
              // Guardado inmediato para que el bloqueo sea instantáneo
              setSaving(true)
              await supabase.from('config').upsert(
                [{ key: 'predictions_locked', value: val }],
                { onConflict: 'key' }
              )
              setSaving(false)
              setMsg(val ? '🔒 Predicciones BLOQUEADAS para todos' : '🔓 Predicciones reabiertas')
              setTimeout(() => setMsg(''), 3000)
            }}
            className="w-6 h-6 rounded accent-red-600 mt-0.5"
          />
          <div>
            <div className="font-bold text-base">
              {config.predictions_locked ? '🔒 Predicciones BLOQUEADAS' : '🔓 Bloquear todas las predicciones'}
            </div>
            <div className="text-xs text-ink-400 mt-1">
              Bloqueo de emergencia: al activarlo, <strong>nadie</strong> puede crear ni modificar
              predicciones (ni grupos, ni terceros, ni partidos), sin importar los horarios.
              Úsalo si hay un problema con las fechas. Se guarda al instante.
            </div>
          </div>
        </label>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label">Costo de entrada (COP)</label>
          <input
            type="number"
            value={config.entry_fee || ''}
            onChange={e => set('entry_fee', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Multa por fecha (COP)</label>
          <input
            type="number"
            value={config.fine_amount || ''}
            onChange={e => set('fine_amount', e.target.value)}
            className="input"
          />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!config.knockouts_enabled}
            onChange={e => set('knockouts_enabled', e.target.checked)}
            className="w-5 h-5 rounded accent-brand-600"
          />
          <div>
            <div className="font-medium">Habilitar predicciones de eliminatorias</div>
            <div className="text-xs text-ink-500">
              Activar cuando termine la fase de grupos. Al activarlo, las predicciones de grupos y mejores terceros se bloquean.
            </div>
          </div>
        </label>
      </div>

      {msg && <div className="text-sm text-center bg-ink-800 rounded-lg px-3 py-2">{msg}</div>}

      <button onClick={save} disabled={saving} className="btn-primary w-full">
        {saving ? 'Guardando…' : '💾 Guardar configuración'}
      </button>
    </div>
  )
}
