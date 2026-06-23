import { teamStats, recentForm, h2h, formColor } from '../lib/teamHistory'
import { teamWithFlag } from '../lib/flags'

/** Puntitos de forma reciente (G/E/P), más reciente a la izquierda. */
function FormDots({ team }) {
  const form = recentForm(team, 5)
  if (form.length === 0) return <span className="text-[10px] text-ink-500">Sin datos</span>
  return (
    <span className="inline-flex gap-1">
      {form.map((r, i) => (
        <span
          key={i}
          className={`inline-block w-4 h-4 rounded-full ${formColor(r)} text-[9px] text-white font-bold flex items-center justify-center`}
          title={r === 'G' ? 'Ganó' : r === 'E' ? 'Empató' : 'Perdió'}
        >
          {r}
        </span>
      ))}
    </span>
  )
}

/** Bloque de stats de una selección (últimos ~3 años). */
function TeamBlock({ team }) {
  const s = teamStats(team)
  if (!s || s.played === 0) {
    return (
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm mb-1">{teamWithFlag(team)}</div>
        <div className="text-[10px] text-ink-500">Sin partidos recientes en el registro.</div>
      </div>
    )
  }
  return (
    <div className="flex-1 min-w-0">
      <div className="font-bold text-sm mb-1.5 truncate">{teamWithFlag(team)}</div>
      <div className="mb-1.5">
        <div className="text-[10px] text-ink-400 mb-0.5">Forma (últimos 5):</div>
        <FormDots team={team} />
      </div>
      <div className="space-y-0.5 text-[11px] text-ink-300">
        <div>📊 {s.played} PJ · <span className="text-green-400">{s.wins}G</span> <span className="text-yellow-400">{s.draws}E</span> <span className="text-red-400">{s.losses}P</span></div>
        <div>⚽ {s.gf_avg} goles a favor / partido</div>
        <div>🥅 {s.ga_avg} en contra / partido</div>
        <div>🎯 {s.win_pct}% de victorias</div>
      </div>
    </div>
  )
}

/**
 * Tarjeta de "antes de apostar": muestra la forma reciente y stats de ambas
 * selecciones de un partido, más el head-to-head si existe.
 */
export default function TeamFormCard({ team1, team2, title = '📈 Antes de apostar' }) {
  const head = h2h(team1, team2)

  return (
    <div className="card">
      <div className="text-xs uppercase text-ink-300 tracking-wider mb-3">{title}</div>
      <div className="flex gap-3">
        <TeamBlock team={team1} />
        <div className="w-px bg-ink-700 shrink-0" />
        <TeamBlock team={team2} />
      </div>

      {head && head.total > 0 && (
        <div className="mt-3 pt-3 border-t border-ink-700">
          <div className="text-[10px] text-ink-400 mb-1.5">
            🤝 Historial directo ({head.total} {head.total === 1 ? 'partido' : 'partidos'}):
          </div>
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="text-center">
              <div className="font-bold text-green-400">{head.wins}</div>
              <div className="text-[9px] text-ink-400">{team1}</div>
            </span>
            <span className="text-center">
              <div className="font-bold text-yellow-400">{head.draws}</div>
              <div className="text-[9px] text-ink-400">empates</div>
            </span>
            <span className="text-center">
              <div className="font-bold text-green-400">{head.losses}</div>
              <div className="text-[9px] text-ink-400">{team2}</div>
            </span>
          </div>
          {head.last5.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {head.last5.map((g, i) => (
                <div key={i} className="text-[10px] text-ink-400 text-center">
                  {g.date.slice(0, 4)}: {g.home} {g.hs}-{g.as} {g.away}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="text-[9px] text-ink-600 mt-2 text-center">
        Datos de partidos internacionales reales (fuente abierta, previos al Mundial).
      </div>
    </div>
  )
}
