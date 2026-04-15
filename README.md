# FocusFlow

Aplicación web moderna de productividad con calendario, tareas y planificación automática de estudio para exámenes.

## Stack

- **Frontend:** React + Vite
- **Estilos:** TailwindCSS
- **Animaciones:** Framer Motion
- **Backend:** Supabase (Auth + Database)
- **Desktop ready:** Electron + electron-updater
- **Deploy web:** GitHub Pages

## Funcionalidades implementadas

- ✅ Login / registro con Supabase (email/password)
- ✅ Persistencia de sesión y logout
- ✅ Seguridad por usuario con RLS en Supabase
- ✅ Calendario mensual con navegación animada
- ✅ Panel lateral deslizante al hacer click en día
- ✅ CRUD completo de tareas (nombre, minutos, fecha)
- ✅ Feature principal de exámenes: generación automática de tareas diarias
- ✅ Modo claro / oscuro / sistema con persistencia en localStorage
- ✅ Botón flotante para acciones rápidas
- ✅ Loader y mensajes de error elegantes
- ✅ Indicador visual de carga diaria de minutos
- ✅ Resumen semanal en minutos
- ✅ Diseño responsive con estética moderna tipo SaaS

---

## 1) Instalación

```bash
npm install
```

## 2) Configurar variables de entorno

Copia `.env.example` a `.env` y completa:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 3) Configurar base de datos en Supabase

1. Abre tu proyecto en Supabase.
2. Ve a **SQL Editor**.
3. Ejecuta el contenido de `supabase/schema.sql`.
4. Verifica que en **Authentication > Providers** esté habilitado email/password.

## 4) Ejecutar en desarrollo

```bash
npm run dev
```

## 5) Build producción web

```bash
npm run build
npm run preview
```

## 6) Deploy en GitHub Pages

1. Cambia en `package.json` y `electron/main.js` el placeholder `YOUR_GITHUB_USERNAME`.
2. Sube el repo a GitHub.
3. Publica la carpeta `dist` con GitHub Pages.

> `vite.config.js` ya incluye `base: '/FocusFlow/'`.

## 7) Ejecutar versión Electron

```bash
npm run electron
```

## 8) Empaquetar `.exe`

```bash
npm run electron:dist
```

`electron-updater` está configurado para buscar actualizaciones publicadas en GitHub Releases.

---

## Estructura

```txt
src/
  components/
    Auth.jsx
    Calendar.jsx
    ExamForm.jsx
    SidePanel.jsx
    TaskForm.jsx
    TaskList.jsx
    ThemeToggle.jsx
  hooks/
    useTheme.js
  lib/
    supabase.js
  styles/
    index.css
  App.jsx
  main.jsx
electron/
  main.js
supabase/
  schema.sql
```

---

## Notas de arquitectura

- Todos los datos viven en Supabase (no solo localStorage).
- localStorage se usa únicamente para guardar la preferencia visual del tema.
- La generación de plan de examen crea:
  - Un registro en `exams`
  - N tareas de tipo `exam` en `tasks` (una por día desde inicio hasta el día previo al examen)
- Todo el acceso a datos está filtrado por `user_id` y protegido por políticas RLS.
