# Dari-polla ⚽

Polla Mundialista 2026 — Web app móvil con auth, predicciones, marcadores, tabla en vivo y multas.

Stack: React + Vite + Tailwind (frontend) · Supabase (auth + Postgres + RLS) · Netlify (hosting).

---

## 🚀 Despliegue paso a paso

### 1. Crear proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea cuenta (free tier alcanza de sobra).
2. Click **New Project**. Ponle nombre `dari-polla`, elige una contraseña fuerte para la DB, y la región más cercana (`us-east` o `sa-east`).
3. Espera ~2 min a que el proyecto se aprovisione.

### 2. Cargar el schema

1. En el dashboard del proyecto: **SQL Editor** → **New query**.
2. Copia y pega el contenido completo de `supabase_schema.sql`.
3. Click **Run** (abajo a la derecha). Debe decir "Success" sin errores.

> **¿Ya tienes la app corriendo con usuarios?** No vuelvas a correr
> `supabase_schema.sql`. En su lugar corre una sola vez
> `supabase_migration_social.sql` (agrega apodos, avatares, comentarios y
> reacciones sin tocar tus datos existentes).

### 3. Obtener las credenciales

1. En el dashboard: **Project Settings** (engranaje abajo a la izq) → **API**.
2. Anota dos cosas:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public** key (un string largo que empieza con `eyJ…`)

### 4. Probar local

```bash
npm install
cp .env.example .env.local
```

Edita `.env.local` y pega tus credenciales:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Arranca el dev server:

```bash
npm run dev
```

Abre `http://localhost:5173` en el celular (si está en la misma WiFi) o el navegador del computador.

### 5. Crear tu cuenta y hacerte admin

1. Click **Regístrate** en la app y crea tu cuenta normal.
2. Vuelve al **SQL Editor** de Supabase y corre:

```sql
update profiles
set is_admin = true, paid = true
where display_name ilike '%dari%';
```

(Cambia el filtro para que machee con tu nombre.) Refresca la app y deberías ver la sección **Admin** en el menú hamburguesa.

Para nombrar más admins luego: úsalo desde la misma app en **Admin → Usuarios**, o con SQL.

### 6. Configurar email de Supabase (opcional pero recomendado)

Por defecto, Supabase requiere confirmación de email. Para una polla casera con amigos:

- **Authentication** → **Providers** → **Email** → desactiva *Confirm email* (así los amigos entran inmediato sin verificar).

Si lo dejas activado: tienes que ir a **Authentication → URL Configuration** y asegurarte que la URL del sitio sea la de Netlify.

### 7. Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/dari-polla.git
git push -u origin main
```

### 8. Desplegar en Netlify

1. Entra a [netlify.com](https://app.netlify.com) y dale **Add new site → Import from Git**.
2. Conecta tu repo de GitHub.
3. **Build settings** (debería detectar automático por `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **Environment variables** → agrega:
   - `VITE_SUPABASE_URL` = tu URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = tu anon key
5. Click **Deploy site**.

Te dará una URL tipo `https://random-name-12345.netlify.app`. Puedes cambiarle el nombre en **Site settings → Change site name** a algo como `dari-polla.netlify.app`, o conectar un dominio propio.

---

## 📱 Flujo de uso

### Para los jugadores

1. Se registran con nombre + email + password
2. Te transfieren los 50.000 COP por aparte (Nequi, Daviplata, lo que sea)
3. Hacen sus predicciones:
   - **Partidos**: marcador de cada partido (cierra 10 min antes del pitazo)
   - **Grupos**: orden 1º a 4º de cada grupo
   - **Terceros**: los 8 equipos que crean clasificarán como mejor tercero
4. Ven sus puntos en **Tabla** en tiempo real

### Para ti (admin)

- **Admin → Usuarios**: confirma quién pagó (marca `Pagó`). Solo los pagados cuentan para la bolsa.
- **Admin → Marcadores**: después de cada partido mete el resultado real. Los puntos se recalculan al instante.
- **Admin → Multas**: cuando termine una fecha, elige la fecha y dale **Aplicar multas**: se le suman 5.000 COP a los 2 últimos.
- **Admin → Resultados Grupos**: cuando termine la fase de grupos, mete el orden real 1-4 de cada grupo.
- **Admin → Mejores Terceros**: marca los 8 equipos que efectivamente clasificaron como mejor tercero.
- **Admin → Config**: cuando termine la fase de grupos, activa el toggle **Habilitar predicciones de eliminatorias**. Esto bloquea grupos/terceros y abre los 32 partidos de eliminación.

---

## 🧮 Sistema de puntos (igual al Excel original)

Por partido:
- Ganador o empate: **5 pts**
- Marcador exacto: **+5 pts**
- Goles del local correctos: **+2 pts**
- Goles del visitante correctos: **+2 pts**
- Diferencia de gol correcta: **+1 pt**

Bonificaciones:
- Cada posición exacta de grupo acertada: **5 pts**
- Cada equipo correcto entre los 8 mejores terceros: **5 pts**

Bolsa final:
- Cada pago de 50.000 COP suma a la bolsa
- Cada multa de 5.000 COP también suma
- 🥇 1º lugar: **80%**
- 🥈 2º lugar: **20%**

---

## 🛠️ Mantenimiento

### Reconstruir las fechas de partidos

Si openfootball publica cambios después de los playoffs de clasificación:

```bash
# editar scripts/build_fixtures.py si hay cambios en placeholders
python3 scripts/build_fixtures.py
```

Esto regenera `src/data/fixtures.json`. Después haz commit + push y Netlify rebuildea solo.

### Backup de la base de datos

Supabase trae backup automático en planes pagos. En free puedes:
- **Database → Backups** y descargar dump manual de vez en cuando.

### Costos

- Supabase free: hasta 500MB de DB + 50k MAUs. Sobra para una polla de ~50 amigos.
- Netlify free: 100GB de bandwidth/mes. Sobra de sobra.
- Total: **0 USD/mes**.

---

## 📁 Estructura del proyecto

```
dari-polla/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── netlify.toml
├── supabase_schema.sql        ← schema completo, correr una sola vez
├── scripts/
│   └── build_fixtures.py       ← genera fixtures desde openfootball
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── data/
    │   └── fixtures.json       ← 104 partidos del Mundial 2026
    ├── lib/
    │   ├── supabase.js
    │   ├── auth.jsx
    │   ├── scoring.js          ← motor de puntos
    │   ├── matches.js          ← helpers de fechas/locks
    │   └── useLeagueData.js
    ├── components/
    │   └── Layout.jsx
    └── pages/
        ├── Login.jsx
        ├── Signup.jsx
        ├── Home.jsx
        ├── Predictions.jsx
        ├── GroupsPredictions.jsx
        ├── ThirdsPredictions.jsx
        ├── Standings.jsx
        ├── Rules.jsx
        └── Admin*.jsx          ← 6 páginas de admin
```

---

## ⚠️ Notas importantes

- **Equipos de playoff de clasificación**: El JSON de openfootball trae "UEFA Path D winner", "IC Path 1 winner" etc. para los 6 slots que se deciden en los playoffs de clasificación (marzo 2026). El script `build_fixtures.py` los mapea automáticamente a los equipos elegidos en el Excel original (República Checa, Bosnia, Suecia, Turquía, Congo, Iraq). Si la realidad cambia, edita el mapa `PLACEHOLDER_MAP` en el script.

- **Horarios**: los fixtures de openfootball vienen en hora local del estadio con offset UTC. El script los convierte a UTC y la app los muestra en hora de Bogotá (UTC-5).

- **Bloqueo de partidos**: cada partido se bloquea automáticamente 10 minutos antes del kickoff. El cálculo es del lado del cliente, así que si alguien manipula el reloj de su sistema, podría editar después. Para una polla de amigos esto no es problema; si quieres bloqueo server-side hay que mover la validación a una Postgres function o a un Edge Function.

- **Eliminatorias**: los partidos de eliminatoria muestran las posiciones genéricas (1A, 2B, etc.) en pantalla pequeña debajo del row. Cuando termine la fase de grupos, lo ideal es que los reemplaces manualmente por los equipos reales — pero la app también funciona sin hacerlo, porque la gente puede predecir igual ingresando un marcador.

---

## 🐛 Troubleshooting

**"Faltan VITE_SUPABASE_URL"** en la consola: no creaste el `.env.local` o no le pusiste las variables.

**No me deja loggear / "Invalid login credentials"**: si tienes confirmación de email activa, revisa el correo (incluso spam) y confirma.

**El admin no ve la sección Admin**: corre el SQL `update profiles set is_admin = true where ...` y haz logout/login.

**"Cannot read properties of null"**: cuando todo está vacío al inicio. Recarga después de meter algunos datos.

**Tabla no muestra puntos**: necesitas tener marcadores en `Admin → Marcadores` y predicciones de los usuarios.

---

Cualquier duda, abre un issue o pregúntale a Claude. ⚽🏆
