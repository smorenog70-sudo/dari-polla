export default function Rules() {
  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-bold mb-2">🔥 Polla Mundialista 2026 🔥</h1>
        <p className="text-ink-300 text-sm">
          Se viene el mundial y armamos nueva edición de la polla ⚽️
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">💰 Entrada</h2>
        <p className="text-2xl font-bold text-brand-500">50.000 COP</p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">📊 ¿Cómo se puntúa?</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>Ganador o empate</span><span className="font-mono text-brand-500">5 pts</span></li>
          <li className="flex justify-between"><span>Marcador exacto</span><span className="font-mono text-brand-500">5 pts</span></li>
          <li className="flex justify-between"><span>Goles del local</span><span className="font-mono text-brand-500">2 pts</span></li>
          <li className="flex justify-between"><span>Goles del visitante</span><span className="font-mono text-brand-500">2 pts</span></li>
          <li className="flex justify-between"><span>Diferencia de gol</span><span className="font-mono text-brand-500">1 pt</span></li>
          <li className="flex justify-between"><span>Posición final en el grupo</span><span className="font-mono text-brand-500">5 pts</span></li>
          <li className="flex justify-between"><span>Mejor tercero</span><span className="font-mono text-brand-500">5 pts</span></li>
        </ul>
        <p className="text-xs text-ink-500 mt-3">
          Los puntos son aditivos: si aciertas el marcador exacto también te dan los 5 de ganador, los 2 del local, los 2 del visitante y 1 de diferencia.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">⚠️ Reglas clave</h2>
        <ul className="space-y-2 text-sm text-ink-100">
          <li>
            Después de cada fecha (fase de grupos y eliminatorias), los dos últimos de la tabla
            en esa fecha (<strong>no</strong> acumulado) pagan una multa de <strong>5.000 COP</strong> cada uno.
            Esa plata se suma a la bolsa final 💸
          </li>
          <li>
            Cada partido cierra automáticamente <strong>10 minutos antes</strong> del pitazo inicial.
            Después de eso ya no puedes editar el pronóstico ⏱️
          </li>
        </ul>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">🏆 Premios</h2>
        <ul className="space-y-2">
          <li className="flex justify-between"><span>🥇 1er lugar</span><span className="font-bold text-brand-500">80% del botín</span></li>
          <li className="flex justify-between"><span>🥈 2do lugar</span><span className="font-bold text-brand-500">20% del botín</span></li>
        </ul>
      </div>

      <p className="text-center text-ink-300 text-sm py-4">
        La idea es meterle emoción a cada partido y que nadie se duerma 😏
      </p>
    </div>
  )
}
