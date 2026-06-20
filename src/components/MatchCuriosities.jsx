import { flagFor } from '../lib/flags'
import { countryFacts } from '../lib/countryFacts'
import { confederationOf } from '../lib/confederations'
import { fifaRank, teamNickname, teamColors } from '../lib/fifaModel'
import { teamWithFlag } from '../lib/flags'

const CONF_NAMES = {
  CONMEBOL: 'Sudamérica', UEFA: 'Europa', CONCACAF: 'Norteamérica',
  CAF: 'África', AFC: 'Asia', OFC: 'Oceanía',
}

function TeamFacts({ team }) {
  const facts = countryFacts(team)
  const rank = fifaRank(team)
  const nick = teamNickname(team)
  const conf = confederationOf(team)
  const colors = teamColors(team)

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-2xl">{flagFor(team)}</span>
        <div className="min-w-0">
          <div className="font-bold text-sm leading-tight truncate">{team}</div>
          {nick && <div className="text-[10px] text-ink-400 italic truncate">"{nick}"</div>}
        </div>
        {colors && colors.length > 0 && (
          <span className="inline-flex gap-0.5 ml-auto shrink-0">
            {colors.slice(0, 2).map((c, i) => (
              <span key={i} className="inline-block w-3 h-3 rounded-full border border-ink-600" style={{ backgroundColor: c }} />
            ))}
          </span>
        )}
      </div>
      <div className="space-y-0.5 text-[11px] text-ink-300">
        {rank && <div>🏅 Ranking FIFA: <span className="text-ink-100">#{rank}</span></div>}
        {conf && <div>🌍 {CONF_NAMES[conf] || conf}</div>}
        {facts && (
          <>
            <div>🏛️ {facts.capital} · {facts.pop}M hab.</div>
            <div>🗣️ {facts.lang}</div>
            <div>🍽️ {facts.food}</div>
          </>
        )}
      </div>
      {facts?.fact && (
        <div className="mt-1.5 text-[10px] text-brand-300 bg-brand-900/15 rounded px-1.5 py-1 leading-snug">
          💡 {facts.fact}
        </div>
      )}
    </div>
  )
}

/**
 * Tarjeta de datos curiosos de un enfrentamiento.
 * @param team1, team2 - nombres en español
 * @param label - encabezado ("Próximo partido" / "En vivo")
 */
export default function MatchCuriosities({ team1, team2, label = 'Datos del partido', accent = 'brand' }) {
  if (!team1 || !team2) return null
  // Solo mostrar si al menos uno tiene datos (evita placeholders)
  const hasData = countryFacts(team1) || countryFacts(team2)
  if (!hasData) return null

  return (
    <div className="card">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
          🔎 {label}: datos curiosos
        </span>
      </div>
      <div className="flex gap-3">
        <TeamFacts team={team1} />
        <div className="text-ink-600 font-bold text-xs self-start pt-1">VS</div>
        <TeamFacts team={team2} />
      </div>
    </div>
  )
}
