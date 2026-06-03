/**
 * Helpers para mostrar el nombre de un jugador de forma consistente
 * en toda la app, respetando su apodo y avatar.
 */

const DEFAULT_AVATAR = '⚽'

/**
 * Devuelve el nombre a mostrar: usa el apodo si existe, si no el display_name.
 */
export function displayName(profile) {
  if (!profile) return 'Jugador'
  const nick = (profile.nickname || '').trim()
  if (nick) return nick
  return profile.display_name || 'Jugador'
}

/**
 * Devuelve el avatar (emoji) del jugador, o el default.
 */
export function displayAvatar(profile) {
  if (!profile) return DEFAULT_AVATAR
  return (profile.avatar || '').trim() || DEFAULT_AVATAR
}

/**
 * Nombre + avatar juntos, ej. "⚽ Pacho"
 */
export function displayNameWithAvatar(profile) {
  return `${displayAvatar(profile)} ${displayName(profile)}`
}

/**
 * Lista de avatares sugeridos para que el usuario elija.
 */
export const AVATAR_OPTIONS = [
  '⚽', '🔥', '⭐', '🏆', '👑', '🎯', '💪', '🚀',
  '🦁', '🐉', '🦅', '🐺', '🐂', '🦊', '🐯', '🦈',
  '😎', '🤓', '😏', '🥶', '🤖', '👻', '💀', '🎩',
  '🇨🇴', '🇩🇪', '🇧🇷', '🇦🇷', '🇪🇸', '🇫🇷', '🇮🇹', '🇵🇹',
]
