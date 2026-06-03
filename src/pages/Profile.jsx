import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { AVATAR_OPTIONS, displayName, displayAvatar } from '../lib/playerDisplay'

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState('⚽')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname || '')
      setAvatar(profile.avatar || '⚽')
    }
  }, [profile])

  const save = async () => {
    setSaving(true)
    setMsg('')
    const clean = nickname.trim().slice(0, 24)
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: clean || null, avatar })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      setMsg('❌ ' + error.message)
    } else {
      setMsg('✅ Guardado')
      if (refreshProfile) refreshProfile()
      setTimeout(() => setMsg(''), 2000)
    }
  }

  const preview = { display_name: profile?.display_name, nickname: nickname.trim(), avatar }

  return (
    <div className="space-y-3 pb-24">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🎭 Mi perfil</h1>
        <p className="text-xs text-ink-300">
          Personaliza cómo te ven los demás en la tabla, comentarios y duelos.
        </p>
      </div>

      {/* Vista previa */}
      <div className="card text-center">
        <div className="text-5xl mb-2">{displayAvatar(preview)}</div>
        <div className="text-lg font-bold">{displayName(preview)}</div>
        <div className="text-xs text-ink-500 mt-1">Así te verán los demás</div>
      </div>

      {/* Apodo */}
      <div className="card">
        <label className="label">Tu apodo (opcional)</label>
        <input
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          maxLength={24}
          placeholder={profile?.display_name || 'Tu nombre'}
          className="input"
        />
        <p className="text-xs text-ink-500 mt-1">
          Si lo dejas vacío, se usará tu nombre real ({profile?.display_name}). Máx. 24 caracteres.
        </p>
      </div>

      {/* Avatar */}
      <div className="card">
        <label className="label mb-2">Elige tu avatar</label>
        <div className="grid grid-cols-8 gap-2">
          {AVATAR_OPTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => setAvatar(emoji)}
              className={`text-2xl p-1.5 rounded-lg transition ${
                avatar === emoji ? 'bg-brand-600 ring-2 ring-brand-400' : 'bg-ink-700 hover:bg-ink-600'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {msg && <div className="text-sm text-center bg-ink-800 rounded-lg px-3 py-2">{msg}</div>}

      <button onClick={save} disabled={saving} className="btn-primary w-full">
        {saving ? 'Guardando…' : '💾 Guardar perfil'}
      </button>
    </div>
  )
}
