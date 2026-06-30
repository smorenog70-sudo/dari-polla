import { useMemo, useState } from 'react'
import { useLeagueData } from '../lib/useLeagueData'
import { buildResolver } from '../lib/bracketTeams'
import { hasMatchStarted } from '../lib/matches'
import { teamWithFlag } from '../lib/flags'
import {
  wisdomOfCrowd, groupCalibration, groupBiases, matchDifficulty,
  teamPredictability, teamPerformance, venueAnalysis,
  empiricalProbabilities, modelVsCrowd, modelForecast,
} from '../lib/dataLab'
import { venueInfo, altitudeCategory } from '../lib/venues'
import { teamColors, fifaRank } from '../lib/fifaModel'

// Puntico con el color del uniforme del equipo
function TeamDot({ team }) {
  const colors = teamColors(team)
  if (!colors || colors.length === 0) return null
  return (
    <span className="inline-flex gap-0.5 align-middle ml-1">
      {colors.slice(0, 2).map((c, i) => (
        <span key={i} className="inline-block w-2 h-2 rounded-full border border-ink-600" style={{ backgroundColor: c }} />
      ))}
    </span>
  )
}

function ConfBadge({ confidence }) {
  if (!confidence) return null
  const color =
    confidence.level === 'alta' ? 'text-green-400' :
    confidence.level === 'media' ? 'text-yellow-400' :
    confidence.level === 'baja' ? 'text-orange-400' : 'text-red-400'
  return (
    <span className={`text-[9px] ${color}`} title={confidence.note}>
      {confidence.label} · n={confidence.n ?? '?'}
    </span>
  )
}

function Card({ title, confidence, children, note }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {confidence && <ConfBadge confidence={confidence} />}
      </div>
      {children}
      {note && <p className="text-[9px] text-ink-500 mt-2">{note}</p>}
    </div>
  )
}

export default function DataLab() {
  const data = useLeagueData()
  const { teams: bracketTeams } = useMemo(() => buildResolver(data), [data.results, data.config])
  // Resuelve los nombres de un row {matchId, team1, team2} si son placeholders
  const fixNames = (m) => ({
    ...m,
    team1: bracketTeams[m.team1] || m.team1,
    team2: bracketTeams[m.team2] || m.team2,
  })
  const [tab, setTab] = useState('grupo')

  const resultsById = useMemo(
    () => new Map(data.results.map(r => [r.match_id, r])),
    [data.results]
  )

  const lab = useMemo(() => {
    if (data.loading) return null
    const preds = data.predictions
    return {
      wisdom: wisdomOfCrowd(preds, resultsById),
      calibration: groupCalibration(preds, resultsById),
      biases: groupBiases(preds, resultsById),
      difficulty: matchDifficulty(preds, resultsById),
      predictability: teamPredictability(preds, resultsById),
      performance: teamPerformance(resultsById),
      venues: venueAnalysis(resultsById),
      probabilities: empiricalProbabilities(preds, resultsById, hasMatchStarted),
      modelVsCrowd: modelVsCrowd(preds, resultsById),
      modelForecast: modelForecast(hasMatchStarted),
    }
  }, [data, resultsById])

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>
  if (!lab) return null

  const totalResults = data.results.length

  const TABS = [
    { id: 'grupo', label: '👥 El grupo' },
    { id: 'equipos', label: '⚽ Equipos' },
    { id: 'probabilidades', label: '🎲 Probabil.' },
    { id: 'modelo', label: '🧮 Modelo' },
  ]

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🔬 Laboratorio de datos</h1>
        <p className="text-xs text-ink-300">
          Análisis sobre los {totalResults} partidos jugados y las predicciones de todos.
          Cada tarjeta muestra su nivel de confianza según cuántos datos tiene.
        </p>
      </div>

      {/* Aviso honesto sobre el tamaño de muestra */}
      <div className="card bg-yellow-900/15 border-yellow-700/30">
        <p className="text-[11px] text-yellow-100/90">
          ⚠️ Llevamos pocos partidos del Mundial, así que varios análisis son apenas
          <strong> tendencias</strong>, no conclusiones firmes. Lo marcamos honestamente:
          🟢 confianza alta · 🟡 media · 🟠 baja · 🔴 solo indicativo. A medida que avance
          el torneo, los números se vuelven más sólidos.
        </p>
      </div>

      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
              tab === t.id ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== ÁREA 1: EL GRUPO ===== */}
      {tab === 'grupo' && (
        <>
          <Card title="🧠 Sabiduría de la multitud" confidence={lab.wisdom.confidence}
            note="¿El voto mayoritario del grupo le pega más que una persona promedio?">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-ink-900/40 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-brand-400">{lab.wisdom.crowdPct}%</div>
                <div className="text-[10px] text-ink-400">acierto del grupo (consenso)</div>
              </div>
              <div className="bg-ink-900/40 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-ink-200">{lab.wisdom.indivPct}%</div>
                <div className="text-[10px] text-ink-400">acierto individual promedio</div>
              </div>
            </div>
            <p className="text-[10px] text-ink-300 mt-2">
              {lab.wisdom.crowdWins
                ? '✅ El consenso del grupo le gana al individuo promedio — la multitud sabe.'
                : 'En estos datos, el individuo promedio va parejo o mejor que el consenso.'}
            </p>
          </Card>

          <Card title="🎯 Calibración del grupo" confidence={lab.calibration.confidence}
            note="Cuando el grupo está muy de acuerdo, ¿acierta más? Idealmente, a mayor consenso, mayor acierto.">
            {lab.calibration.bins.length === 0 ? (
              <p className="text-xs text-ink-500">Aún no hay suficientes partidos.</p>
            ) : (
              <div className="space-y-1">
                {lab.calibration.bins.map(b => (
                  <div key={b.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-ink-400 w-16">{b.label}</span>
                    <div className="flex-1 bg-ink-900 rounded-full h-3 overflow-hidden">
                      <div className="bg-brand-500 h-full rounded-full" style={{ width: `${b.actual}%` }} />
                    </div>
                    <span className="text-[10px] text-ink-300 w-20 text-right">{b.actual}% acierto ({b.total})</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="⚖️ Sesgos del grupo" confidence={lab.biases.confidence}>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-ink-900/40 rounded-lg p-2 text-center">
                <div className="text-sm font-bold text-brand-400">{lab.biases.predDrawPct}% <span className="text-ink-500 font-normal">vs</span> {lab.biases.realDrawPct}%</div>
                <div className="text-[10px] text-ink-400">empates predichos vs reales</div>
              </div>
              <div className="bg-ink-900/40 rounded-lg p-2 text-center">
                <div className="text-sm font-bold text-brand-400">{lab.biases.predGoalsAvg} <span className="text-ink-500 font-normal">vs</span> {lab.biases.realGoalsAvg}</div>
                <div className="text-[10px] text-ink-400">goles/partido predichos vs reales</div>
              </div>
            </div>
          </Card>

          <Card title="🔥 Partidos trampa y regalados" confidence={{ ...{ level: lab.difficulty.n >= 25 ? 'media' : lab.difficulty.n >= 10 ? 'baja' : 'muy-baja' }, label: lab.difficulty.n >= 25 ? '🟡 Confianza media' : lab.difficulty.n >= 10 ? '🟠 Confianza baja' : '🔴 Solo indicativo', n: lab.difficulty.n }}>
            {lab.difficulty.hardest.length === 0 ? (
              <p className="text-xs text-ink-500">Aún no hay suficientes partidos.</p>
            ) : (
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] text-red-400 mb-1">Los que más fallaron (trampa):</div>
                  {lab.difficulty.hardest.map(fixNames).map(m => (
                    <div key={m.matchId} className="text-[11px] flex justify-between">
                      <span>{teamWithFlag(m.team1)} vs {teamWithFlag(m.team2)}</span>
                      <span className="text-red-300">{m.hitPct}% acertó</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-[10px] text-green-400 mb-1">Los más cantados (regalados):</div>
                  {lab.difficulty.easiest.map(fixNames).map(m => (
                    <div key={m.matchId} className="text-[11px] flex justify-between">
                      <span>{teamWithFlag(m.team1)} vs {teamWithFlag(m.team2)}</span>
                      <span className="text-green-300">{m.hitPct}% acertó</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ===== ÁREA 2: EQUIPOS ===== */}
      {tab === 'equipos' && (
        <>
          <Card title="🔮 Equipos predecibles vs sorpresa"
            confidence={{ level: lab.predictability.n >= 20 ? 'baja' : 'muy-baja', label: lab.predictability.n >= 20 ? '🟠 Confianza baja' : '🔴 Solo indicativo', n: lab.predictability.n }}
            note="% del grupo que acierta en los partidos de cada equipo. Con pocos partidos por equipo, es solo una tendencia.">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-green-400 mb-1">Más predecibles</div>
                {lab.predictability.mostPredictable.map(t => (
                  <div key={t.team} className="text-[11px] flex justify-between">
                    <span className="truncate">{teamWithFlag(t.team)}</span>
                    <span className="text-ink-400">{t.predictablePct}%</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[10px] text-orange-400 mb-1">Más sorpresa</div>
                {lab.predictability.mostSurprising.map(t => (
                  <div key={t.team} className="text-[11px] flex justify-between">
                    <span className="truncate">{teamWithFlag(t.team)}</span>
                    <span className="text-ink-400">{t.predictablePct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="📊 Rendimiento real por equipo"
            confidence={{ level: 'media', label: '🟡 Descriptivo', n: lab.performance.n }}
            note="Datos duros de lo que ha pasado en la cancha (fase de grupos). Esto es descriptivo, no predictivo.">
            <div className="space-y-1">
              <div className="grid grid-cols-12 text-[9px] text-ink-500 uppercase">
                <span className="col-span-5">Equipo</span>
                <span className="col-span-2 text-center">PJ</span>
                <span className="col-span-2 text-center">GF</span>
                <span className="col-span-3 text-center">Dif</span>
              </div>
              {lab.performance.rows.slice(0, 8).map(t => (
                <div key={t.team} className="grid grid-cols-12 text-[11px] items-center">
                  <span className="col-span-5 truncate">{teamWithFlag(t.team)}</span>
                  <span className="col-span-2 text-center text-ink-400">{t.played}</span>
                  <span className="col-span-2 text-center text-ink-300">{t.gf}</span>
                  <span className={`col-span-3 text-center font-bold ${t.gd > 0 ? 'text-green-400' : t.gd < 0 ? 'text-red-400' : 'text-ink-400'}`}>
                    {t.gd > 0 ? `+${t.gd}` : t.gd}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="🏟️ Sedes: altitud, aforo y goles"
            confidence={{ level: 'muy-baja', label: '🔴 Solo contexto', n: lab.venues.n }}
            note="Datos de cada estadio (fijos) + goles por partido jugados ahí. Con 2-4 partidos por sede, lo de goles es pura curiosidad, no conclusión.">
            {lab.venues.rows.length === 0 ? (
              <p className="text-xs text-ink-500">Aún no hay partidos con sede registrada.</p>
            ) : (
              <div className="space-y-2">
                {lab.venues.rows.slice(0, 8).map(v => {
                  const info = venueInfo(v.venue)
                  return (
                    <div key={v.venue} className="bg-ink-900/40 rounded-lg p-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-medium truncate">
                          {info ? `${info.stadium}` : v.venue}
                        </span>
                        <span className="text-[10px] text-brand-400 font-bold">{v.avgGoals} ⚽/part.</span>
                      </div>
                      {info && (
                        <div className="text-[9px] text-ink-500 mt-0.5 flex flex-wrap gap-x-2">
                          <span>{info.city}</span>
                          <span>{altitudeCategory(info.altitude).emoji} {info.altitude}m</span>
                          <span>👥 {(info.capacity/1000).toFixed(0)}k</span>
                          <span>{info.roof === 'Abierto' ? '☀️' : '🏟️'} {info.roof}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ===== ÁREA 3: PROBABILIDADES ===== */}
      {tab === 'probabilidades' && (
        <Card title="🎲 Lo que cree el grupo (próximos partidos)"
          confidence={{ level: 'media', label: '🟡 Consenso real', n: lab.probabilities.n }}
          note="Probabilidad empírica = el % del grupo que apostó a cada resultado. Esto SÍ es sólido: es literalmente lo que la gente predijo. Solo aparecen partidos ya cerrados, para no filtrar predicciones secretas.">
          {lab.probabilities.rows.length === 0 ? (
            <p className="text-xs text-ink-500">No hay partidos cerrados sin resultado para analizar ahora mismo.</p>
          ) : (
            <div className="space-y-3">
              {lab.probabilities.rows.map(r => (
                <div key={r.matchId} className="bg-ink-900/40 rounded-lg p-2">
                  <div className="text-[11px] font-medium mb-1 text-center">
                    {teamWithFlag(r.team1)} vs {teamWithFlag(r.team2)}
                  </div>
                  <div className="flex h-5 rounded overflow-hidden text-[9px] font-bold">
                    <div className="bg-brand-600 flex items-center justify-center" style={{ width: `${r.pTeam1}%` }}>
                      {r.pTeam1 >= 12 && `${r.pTeam1}%`}
                    </div>
                    <div className="bg-ink-600 flex items-center justify-center" style={{ width: `${r.pDraw}%` }}>
                      {r.pDraw >= 12 && `${r.pDraw}%`}
                    </div>
                    <div className="bg-purple-600 flex items-center justify-center" style={{ width: `${r.pTeam2}%` }}>
                      {r.pTeam2 >= 12 && `${r.pTeam2}%`}
                    </div>
                  </div>
                  <div className="flex justify-between text-[9px] text-ink-400 mt-1">
                    <span>Gana {r.team1}</span>
                    <span>Empate</span>
                    <span>Gana {r.team2}</span>
                  </div>
                  <div className="text-[9px] text-ink-500 text-center mt-1">
                    Marcador más apostado: <span className="font-mono text-brand-400">{r.topScore}</span> ({r.topScorePct}%) · {r.total} votos
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ===== ÁREA 4: MODELO FIFA ===== */}
      {tab === 'modelo' && (
        <>
          <div className="card bg-blue-900/15 border-blue-700/30">
            <p className="text-[11px] text-blue-100/90">
              🧮 Este modelo estima probabilidades con el <strong>ranking FIFA</strong> de cada equipo
              (que resume miles de partidos históricos). Lo comparamos con lo que predijo tu grupo
              y con lo que pasó. Así ves si le ganan al "computador" o no.
            </p>
          </div>

          <Card title="🤖 Modelo FIFA vs 👥 El grupo" confidence={lab.modelVsCrowd.confidence}
            note="¿Quién acierta más el ganador: el modelo de ranking o el consenso del grupo? Con pocos partidos, puede cambiar rápido.">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-ink-900/40 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-blue-400">{lab.modelVsCrowd.modelPct}%</div>
                <div className="text-[10px] text-ink-400">acierto del modelo FIFA</div>
                <div className="text-[9px] text-ink-500">{lab.modelVsCrowd.modelHits}/{lab.modelVsCrowd.n}</div>
              </div>
              <div className="bg-ink-900/40 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-brand-400">{lab.modelVsCrowd.crowdPct}%</div>
                <div className="text-[10px] text-ink-400">acierto del grupo</div>
                <div className="text-[9px] text-ink-500">{lab.modelVsCrowd.crowdHits}/{lab.modelVsCrowd.n}</div>
              </div>
            </div>
            <p className="text-[10px] text-ink-300 mt-2 text-center">
              {lab.modelVsCrowd.crowdPct > lab.modelVsCrowd.modelPct
                ? '🎉 ¡El grupo le gana al modelo FIFA! La sabiduría popular manda.'
                : lab.modelVsCrowd.crowdPct === lab.modelVsCrowd.modelPct
                  ? 'Van empatados modelo y grupo.'
                  : '🤖 El modelo FIFA va adelante por ahora.'}
            </p>
          </Card>

          <Card title="🔮 Pronóstico del modelo (próximos)"
            confidence={{ level: 'media', label: '🧮 Modelo Elo', n: lab.modelForecast.n }}
            note="Probabilidad según ranking FIFA + datos de la sede. Es una estimación con base histórica, no una certeza.">
            {lab.modelForecast.rows.length === 0 ? (
              <p className="text-xs text-ink-500">No hay próximos partidos de grupos cerrados para mostrar.</p>
            ) : (
              <div className="space-y-3">
                {lab.modelForecast.rows.map(r => (
                  <div key={r.matchId} className="bg-ink-900/40 rounded-lg p-2">
                    <div className="text-[11px] font-medium mb-1 text-center flex items-center justify-center gap-1">
                      <span>{teamWithFlag(r.team1)}<TeamDot team={r.team1} /></span>
                      {r.prob.rank1 && <span className="text-[8px] text-ink-500">#{r.prob.rank1}</span>}
                      <span className="text-ink-600 mx-1">vs</span>
                      {r.prob.rank2 && <span className="text-[8px] text-ink-500">#{r.prob.rank2}</span>}
                      <span><TeamDot team={r.team2} />{teamWithFlag(r.team2)}</span>
                    </div>
                    <div className="flex h-5 rounded overflow-hidden text-[9px] font-bold">
                      <div className="bg-blue-600 flex items-center justify-center" style={{ width: `${r.prob.pTeam1}%` }}>
                        {r.prob.pTeam1 >= 12 && `${r.prob.pTeam1}%`}
                      </div>
                      <div className="bg-ink-600 flex items-center justify-center" style={{ width: `${r.prob.pDraw}%` }}>
                        {r.prob.pDraw >= 12 && `${r.prob.pDraw}%`}
                      </div>
                      <div className="bg-purple-600 flex items-center justify-center" style={{ width: `${r.prob.pTeam2}%` }}>
                        {r.prob.pTeam2 >= 12 && `${r.prob.pTeam2}%`}
                      </div>
                    </div>
                    {r.venue && (
                      <div className="text-[9px] text-ink-500 mt-1.5 flex flex-wrap gap-x-2 justify-center">
                        <span>🏟️ {r.venue.stadium}</span>
                        <span>{altitudeCategory(r.venue.altitude).emoji} {r.venue.altitude}m</span>
                        <span>👥 {(r.venue.capacity/1000).toFixed(0)}k</span>
                        <span>🌡️ {r.venue.climate}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
