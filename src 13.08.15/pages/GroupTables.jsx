import { useMemo, useState } from 'react'
import { useLeagueData } from '../lib/useLeagueData'
import { computeGroupTables, groupScenarios } from '../lib/groupTables'
import { teamWithFlag } from '../lib/flags'

export default function GroupTables() {
  const data = useLeagueData()
  const [openGroup, setOpenGroup] = useState(null)

  const resultsById = useMemo(
    () => new Map(data.results.map(r => [r.match_id, r])),
    [data.results]
  )

  const { groups, order } = useMemo(
    () => computeGroupTables(resultsById),
    [resultsById]
  )

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const anyResults = resultsById.size > 0

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🌍 Grupos del Mundial</h1>
        <p className="text-xs text-ink-300">
          La tabla real de cada grupo según los resultados oficiales. Clasifican los 2 primeros
          de cada grupo, más los 8 mejores terceros.
        </p>
      </div>

      {!anyResults && (
        <div className="card text-center py-8 text-ink-300">
          <div className="text-3xl mb-2">⏳</div>
          <div className="font-medium">Aún no hay resultados cargados</div>
          <div className="text-xs mt-1">Las tablas se llenan a medida que se juegan los partidos.</div>
        </div>
      )}

      {anyResults && order.map(g => {
        const rows = groupScenarios(groups[g])
        const isOpen = openGroup === g
        return (
          <div key={g} className="card p-0 overflow-hidden">
            <button
              onClick={() => setOpenGroup(isOpen ? null : g)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-ink-700/50 transition"
            >
              <span className="font-bold">Grupo {g}</span>
              <span className="text-xs text-ink-400">
                {rows[0]?.played > 0 ? `Líder: ${rows[0].team}` : 'Sin jugar'} {isOpen ? '▲' : '▼'}
              </span>
            </button>

            {isOpen && (
              <div className="px-2 pb-3">
                <table className="w-full text-sm">
                  <thead className="text-[10px] text-ink-400 uppercase">
                    <tr>
                      <th className="py-1 px-1 text-left">#</th>
                      <th className="py-1 px-1 text-left">Equipo</th>
                      <th className="py-1 px-1 text-center">PJ</th>
                      <th className="py-1 px-1 text-center">DG</th>
                      <th className="py-1 px-1 text-center font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr
                        key={r.team}
                        className={`border-t border-ink-700/60 ${
                          r.status === 'qualified' || r.status === 'leading' ? 'bg-green-900/15' :
                          r.status === 'maybe' || r.status === 'bubble' ? 'bg-yellow-900/15' :
                          r.status === 'eliminated' ? 'bg-red-900/10 opacity-70' : ''
                        }`}
                      >
                        <td className="py-1.5 px-1 font-mono text-ink-400">{r.pos}</td>
                        <td className="py-1.5 px-1">
                          <div className="truncate">{teamWithFlag(r.team)}</div>
                          <div className="text-[9px] text-ink-500">{r.note}</div>
                        </td>
                        <td className="py-1.5 px-1 text-center text-ink-300">{r.played}</td>
                        <td className="py-1.5 px-1 text-center text-ink-300">
                          {r.gd > 0 ? `+${r.gd}` : r.gd}
                        </td>
                        <td className="py-1.5 px-1 text-center font-bold text-brand-400">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-3 mt-2 px-1 text-[9px] text-ink-500">
                  <span>🟢 Clasifica</span>
                  <span>🟡 Pelea 3er puesto</span>
                  <span>🔴 Eliminado</span>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {anyResults && (
        <p className="text-[10px] text-ink-500 text-center px-4">
          💡 Los escenarios son una guía. El cupo de mejor tercero depende de cómo queden
          los terceros de TODOS los grupos, así que un 3° marcado en amarillo aún puede clasificar o quedar fuera.
        </p>
      )}
    </div>
  )
}
