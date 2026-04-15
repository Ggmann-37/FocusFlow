# FocusFlow (sin Node.js, sin build)

FocusFlow es una app web completa de productividad (calendario + tareas + planificación automática de estudio) construida solo con **HTML, CSS y JavaScript puro**, lista para publicar en **GitHub Pages**.

## ✅ Qué incluye

- Autenticación Supabase (login/registro/logout) con sesión persistente.
- Calendario mensual interactivo con navegación y animación.
- CRUD completo de tareas: nombre, minutos, fecha.
- Feature principal de exámenes: crea tareas automáticas diarias `Estudio: [nombre examen]`.
- Panel lateral deslizante para detalle diario.
- Botón flotante para acceso rápido.
- Tema claro/oscuro/sistema con localStorage y transición suave.
- Responsive para móvil y escritorio.

## Estructura del proyecto

```txt
index.html
styles.css
app.js
supabase/schema.sql
```

## 1) Configurar base de datos Supabase

1. Crea un proyecto en Supabase.
2. Ve a **SQL Editor**.
3. Ejecuta el archivo `supabase/schema.sql`.
4. En **Authentication > Providers**, habilita email/password.

## 2) Configurar claves Supabase

Abre `app.js` y reemplaza estas dos constantes:

```js
const SUPABASE_URL = 'REEMPLAZA_CON_TU_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'REEMPLAZA_CON_TU_SUPABASE_ANON_KEY';
```

## 3) Ejecutar local sin instalar nada

Puedes abrir `index.html` directamente o usar un servidor estático simple:

```bash
python3 -m http.server 8080
```

Luego abre `http://localhost:8080`.

## 4) Subir a GitHub Pages

1. Sube estos archivos al repositorio.
2. En GitHub, entra a **Settings > Pages**.
3. Publica desde la rama principal (`/root`).
4. Tu app quedará online sin build ni dependencias.

## Notas importantes

- **No usa npm, Node.js ni bundlers.**
- Supabase se carga por CDN oficial.
- Tailwind se usa por CDN.
- Toda la persistencia de datos (tareas/exámenes) está en Supabase.
- `localStorage` solo guarda la preferencia de tema.
