import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://pztdjbeyyuckhygobdla.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9DWuwVmEnBqYlWdWmRqV5w_4_MPO1HD';
const GH_PAGES_APP_URL = 'https://ggmann-37.github.io/FocusFLow/';
const APP_BASE_PATH = '/FocusFLow/';

function hasSupabaseAuthParams() {
  const raw = `${window.location.hash || ''}${window.location.search || ''}`;
  return /(access_token|refresh_token|expires_in|token_type|type)=/i.test(raw);
}

function isAppBasePath() {
  const normalize = (value) => {
    if (!value) return '/';
    const trimmed = value.replace(/\/+$/, '');
    return trimmed || '/';
  };

  return normalize(window.location.pathname) === normalize(APP_BASE_PATH);
}

function cleanupAuthUrl() {
  if (!hasSupabaseAuthParams()) return;
  const cleanUrl = `${window.location.pathname}${window.location.search || ''}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

const shouldDetectSessionInUrl = hasSupabaseAuthParams() && isAppBasePath();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: shouldDetectSessionInUrl,
  },
});

const state = {
  session: null,
  profile: null,
  tasks: [],
  selectedDate: formatDate(new Date()),
  currentMonth: monthKey(new Date()),
  panelOpen: false,
  editTaskId: null,
  mode: localStorage.getItem('focusflow-theme') || 'system',
  loading: true,
  toast: '',
  authError: '',
  authLoading: false,
  loginPanelOpen: false,
  registerPanelOpen: false,
  registerLoading: false,
  registerError: '',
  examSummary: null,
  todayTasksModalOpen: false,
  createMode: false,
  notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  notificationPromptDismissed: sessionStorage.getItem('focusflow-notification-prompt-dismissed') === '1',
  timer: {
    taskId: null,
    remainingSeconds: 0,
    running: false,
    doneTaskName: '',
  },
};

let timerInterval = null;

const app = document.getElementById('app');

const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toHumanDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function todayISO() {
  return formatDate(new Date());
}

function dateStatus(dateStr) {
  const today = todayISO();
  if (dateStr < today) return 'past';
  if (dateStr > today) return 'future';
  return 'today';
}

function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
}

function getMonthDays(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startWeek = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const prevMonthDays = new Date(y, m - 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeek; i += 1) {
    const day = prevMonthDays - startWeek + i + 1;
    const prevDate = new Date(y, m - 2, day);
    cells.push({ date: formatDate(prevDate), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: formatDate(new Date(y, m - 1, day)), inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const nextDate = new Date(y, m - 1, daysInMonth + (cells.length % 7));
    cells.push({ date: formatDate(nextDate), inMonth: false });
  }

  return cells;
}

function tasksForDate(date) {
  return state.tasks.filter((t) => t.fecha === date);
}

function minutesForDate(date) {
  return tasksForDate(date).reduce((sum, t) => sum + Number(t.minutos || 0), 0);
}

function getWeekBounds(dateStr) {
  const date = parseDate(dateStr);
  const day = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: formatDate(start), end: formatDate(end) };
}

function weekMinutes(dateStr) {
  const { start, end } = getWeekBounds(dateStr);
  return state.tasks
    .filter((t) => t.fecha >= start && t.fecha <= end)
    .reduce((sum, t) => sum + Number(t.minutos || 0), 0);
}

function toast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    if (state.toast === message) {
      state.toast = '';
      render();
    }
  }, 2500);
}

async function fetchTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', state.session.user.id)
    .order('fecha', { ascending: true });

  if (error) {
    toast(`Error al cargar tareas: ${error.message}`);
    return;
  }

  state.tasks = data || [];
}

async function fetchProfile() {
  if (!state.session?.user?.id) return;
  const { data } = await supabase.from('profiles').select('username').eq('id', state.session.user.id).maybeSingle();
  state.profile = data || null;
}

async function initSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) toast(error.message);
  state.session = data.session;
  cleanupAuthUrl();
  state.loading = false;

  if (state.session) {
    await Promise.all([fetchTasks(), fetchProfile()]);
    openTodayTasksPanel();
    updateNotificationPermissionState();
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    cleanupAuthUrl();
    state.session = session;
    state.editTaskId = null;
    state.examSummary = null;
    resetTimer();

    if (session) {
      await Promise.all([fetchTasks(), fetchProfile()]);
      openTodayTasksPanel();
      updateNotificationPermissionState();
    } else {
      state.tasks = [];
      state.profile = null;
      state.todayTasksModalOpen = false;
      state.notificationPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    }
    render();
  });

  render();
}

function authView() {
  return `
    <main class="relative min-h-screen overflow-hidden bg-zinc-100 px-4 py-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 md:px-8">
      <div class="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-blue-400/35 blur-3xl"></div>
      <div class="pointer-events-none absolute -right-24 top-16 h-72 w-72 rounded-full bg-violet-400/30 blur-3xl"></div>

      <section class="relative mx-auto max-w-6xl space-y-10">
        <header class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/80 p-3 shadow-soft backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
          <div class="flex items-center gap-3">
            <img src="assets/logo-focusflow.svg" alt="Logo FocusFlow" class="h-11 w-11 rounded-2xl" />
            <h1 class="text-2xl font-bold text-blue-600 dark:text-blue-300">FocusFlow</h1>
          </div>
          <div class="flex gap-2">
            <button id="open-login-panel" class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Iniciar sesión</button>
            <button id="open-register-panel" class="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-zinc-800">Regístrate</button>
          </div>
        </header>

        <section class="space-y-5 text-center">
          <div class="mx-auto flex w-fit items-center gap-3 rounded-full border border-blue-200 bg-white px-4 py-3 shadow-sm dark:border-blue-900/50 dark:bg-zinc-900">
            <img src="assets/logo-focusflow.svg" alt="Icono FocusFlow" class="h-12 w-12" />
            <h2 class="text-4xl font-black tracking-wide text-blue-600 dark:text-blue-300 md:text-6xl">FOCUSFLOW</h2>
          </div>
          <p class="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600/90 dark:text-blue-300">Planificación inteligente de exámenes y tareas</p>
          <p class="mx-auto max-w-3xl text-sm text-zinc-600 dark:text-zinc-300 md:text-base">Organiza tu estudio diario, crea planes de examen automáticos y mantén el foco con temporizador y recordatorios.</p>
        </section>

        <section class="grid gap-4 md:grid-cols-3">
          <article class="rounded-3xl border border-blue-100 bg-blue-200/70 p-6 text-center shadow-sm dark:border-blue-900/40 dark:bg-blue-950/30">
            <h3 class="text-2xl font-bold text-blue-700 dark:text-blue-300">Intuitivo</h3>
            <p class="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Diseño pensado para estudiantes: creas tareas, ves tu calendario y organizas cada día en pocos clics, sin menús confusos ni pasos innecesarios.</p>
          </article>
          <article class="rounded-3xl border border-violet-100 bg-violet-200/70 p-6 text-center shadow-sm dark:border-violet-900/40 dark:bg-violet-950/30">
            <h3 class="text-2xl font-bold text-violet-700 dark:text-violet-300">Gratis</h3>
            <p class="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Disfruta de planificación automática de exámenes, temporizador y seguimiento diario sin pagar cuotas ni encontrarte con funciones bloqueadas a mitad de uso.</p>
          </article>
          <article class="rounded-3xl border border-indigo-100 bg-indigo-200/70 p-6 text-center shadow-sm dark:border-indigo-900/40 dark:bg-indigo-950/30">
            <h3 class="text-2xl font-bold text-indigo-700 dark:text-indigo-300">Seguro</h3>
            <p class="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Tu información académica se guarda en un entorno protegido y estable, con una experiencia fiable para que puedas centrarte en estudiar con tranquilidad.</p>
          </article>
        </section>

        <footer class="pb-3 text-center text-sm font-semibold text-zinc-500">FocusFlow 2026</footer>
      </section>

      ${state.loginPanelOpen ? loginPanelView() : ''}
      ${state.registerPanelOpen ? registerPanelView() : ''}
    </main>
  `;
}

function loginPanelView() {
  return `
    <div id="login-overlay" class="fixed inset-0 z-40 bg-black/35"></div>
    <section class="modal-panel fixed inset-0 z-50 m-auto h-fit w-[92%] rounded-2xl border border-zinc-200 bg-white p-5 shadow-soft dark:border-zinc-700 dark:bg-zinc-900">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-semibold">Iniciar sesión</h2>
        <button id="close-login-panel" class="rounded-lg border border-zinc-200 px-2 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Cerrar</button>
      </div>
      <form id="auth-form" class="mt-3 space-y-2">
        <input required name="email" type="email" placeholder="Correo electrónico" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700" />
        <input required name="password" type="password" placeholder="Contraseña" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700" />
        ${state.authError ? `<p class="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/20 dark:text-red-300">${state.authError}</p>` : ''}
        <button data-mode="login" ${state.authLoading ? 'disabled' : ''} class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2 text-white hover:bg-blue-500 disabled:opacity-70">
          ${state.authLoading ? '<span class="spinner"></span> Iniciando...' : 'Entrar'}
        </button>
        <button type="button" id="go-register-from-login" class="w-full rounded-xl border border-zinc-200 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">¿No tienes cuenta? Regístrate</button>
      </form>
    </section>
  `;
}

function registerPanelView() {
  return `
    <div id="register-overlay" class="fixed inset-0 z-40 bg-black/35"></div>
    <section class="modal-panel fixed inset-0 z-50 m-auto h-fit w-[92%] rounded-2xl border border-zinc-200 bg-white p-5 shadow-soft dark:border-zinc-700 dark:bg-zinc-900">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-semibold">Nueva cuenta</h2>
        <button id="close-register-panel" class="rounded-lg border border-zinc-200 px-2 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Cerrar</button>
      </div>
      <form id="register-form" class="mt-3 space-y-2">
        <input required name="register_email" type="email" placeholder="Correo electrónico" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700" />
        <input required name="register_password" type="password" placeholder="Contraseña" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700" />
        <input required name="confirm_password" type="password" placeholder="Repite la contraseña" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700" />
        ${state.registerError ? `<p class="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/20 dark:text-red-300">${state.registerError}</p>` : ''}
        <button data-mode="register" ${state.registerLoading ? 'disabled' : ''} class="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2 text-white hover:bg-violet-500 disabled:opacity-70">
          ${state.registerLoading ? '<span class="spinner"></span> Registrando...' : 'Registrarse'}
        </button>
      </form>
    </section>
  `;
}

function formatSeconds(total) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function dayPanelView() {
  const tasks = tasksForDate(state.selectedDate);
  const editingTask = tasks.find((t) => t.id === state.editTaskId);
  const selectedDateStatus = dateStatus(state.selectedDate);
  const defaultCreateDate = state.selectedDate < todayISO() ? todayISO() : state.selectedDate;

  return `
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold">${new Date(`${state.selectedDate}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        <p class="text-sm text-zinc-500">${tasks.length} tarea(s)</p>
      </div>

      <div class="space-y-2">
        ${
          tasks.length
            ? tasks
                .map((task) => {
                  const isTimerTask = state.timer.taskId === task.id;
                  const taskStatus = dateStatus(task.fecha);
                  const isPast = taskStatus === 'past';
                  const isFuture = taskStatus === 'future';
                  return `
              <article class="task-item rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="font-medium">${task.nombre}</p>
                    <p class="text-sm text-zinc-500">${task.minutos} min · ${task.tipo === 'exam' ? 'Plan examen' : 'Tarea'}</p>
                    ${isPast ? '<p class="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300">No entregada</p>' : ''}
                    <p id="timer-${task.id}" class="timer-text mt-1 text-sm font-semibold text-blue-600 dark:text-blue-300">${isTimerTask ? formatSeconds(state.timer.remainingSeconds) : formatSeconds(Number(task.minutos) * 60)}</p>
                  </div>
                  <div class="flex gap-1">
                    <button data-edit-task="${task.id}" ${isPast ? 'disabled' : ''} class="rounded-lg border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Editar</button>
                    <button data-delete-task="${task.id}" ${isPast ? 'disabled' : ''} class="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Eliminar</button>
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button data-start-timer="${task.id}" ${(isPast || isFuture) ? 'disabled' : ''} class="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">Iniciar</button>
                  <button data-pause-timer="${task.id}" ${(isPast || isFuture) ? 'disabled' : ''} class="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Pausar</button>
                  <button data-submit-task="${task.id}" ${(isPast || isFuture) ? 'disabled' : ''} class="rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">Entregar</button>
                </div>
              </article>
            `;
                })
                .join('')
            : '<p class="text-sm text-zinc-500">No hay tareas para este día.</p>'
        }
      </div>

      ${
        state.createMode
          ? `<form id="task-form" class="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 space-y-2">
              <h3 class="font-semibold">${editingTask ? 'Editar tarea' : 'Nueva tarea'}</h3>
              <input required name="nombre" value="${editingTask ? editingTask.nombre : ''}" placeholder="Nombre" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
              <input required min="1" name="minutos" type="number" value="${editingTask ? editingTask.minutos : 30}" placeholder="Minutos" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
              <input required min="${todayISO()}" name="fecha" type="date" value="${editingTask ? editingTask.fecha : defaultCreateDate}" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
              <div class="flex gap-2">
                <button class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500">${editingTask ? 'Guardar cambios' : 'Crear tarea'}</button>
                ${editingTask ? '<button type="button" id="cancel-edit" class="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">Cancelar</button>' : ''}
              </div>
            </form>

            <form id="exam-form" class="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 space-y-2">
              <h3 class="font-semibold">Planificar examen</h3>
              <input required name="nombre" placeholder="Nombre examen" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
              <div class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                Fecha del examen
              </div>
              <input required min="${todayISO()}" name="fecha_examen" type="date" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
              <div class="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200">
                Fecha de inicio
              </div>
              <input required min="${todayISO()}" name="fecha_inicio" type="date" value="${defaultCreateDate}" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
              <input required min="1" name="minutos_diarios" type="number" value="60" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
              <button class="rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500">Generar plan automático</button>
              ${
                state.examSummary
                  ? `<p class="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/20 dark:text-amber-300">Plan creado. Fecha de inicio: <strong>${toHumanDate(state.examSummary.fecha_inicio)}</strong> · Fecha del examen: <strong>${toHumanDate(state.examSummary.fecha_examen)}</strong></p>`
                  : ''
              }
            </form>`
          : `<div class="rounded-2xl border border-zinc-200 bg-zinc-100/80 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
              ${selectedDateStatus === 'past' ? 'Este día ya pasó: solo puedes revisar tareas no entregadas.' : 'Pulsa el botón + para crear tareas o planificar exámenes.'}
            </div>`
      }
    </div>
  `;
}

function appView() {
  const monthDays = getMonthDays(state.currentMonth);
  const dailyMinutes = minutesForDate(state.selectedDate);
  const weekTotal = weekMinutes(state.selectedDate);
  const { start, end } = getWeekBounds(state.selectedDate);
  const today = todayISO();
  const todayLabel = new Date(`${today}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const todayTasks = tasksForDate(today);
  const showNotificationPrompt = state.notificationPermission === 'default' && !state.notificationPromptDismissed;

  return `
    <main class="mx-auto max-w-7xl p-4 md:p-8 space-y-5">
      ${
        showNotificationPrompt
          ? `<section class="pointer-events-none fixed left-1/2 top-3 z-[65] w-[95%] max-w-xl -translate-x-1/2 md:top-4">
              <div class="pointer-events-auto flex items-start gap-3 rounded-xl border border-blue-200/90 bg-white/95 px-3 py-2 text-sm text-blue-900 shadow-lg backdrop-blur dark:border-blue-900/70 dark:bg-zinc-900/95 dark:text-blue-200">
                <button id="request-notification-permission" class="flex-1 text-left hover:opacity-90">
                  <strong>Notificaciones de escritorio</strong><br />
                  <span class="text-xs opacity-90">Actívalas para avisos del temporizador.</span>
                </button>
                <button id="dismiss-notification-prompt" class="rounded-md border border-blue-200 px-2 py-0.5 text-xs hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30">Cerrar</button>
              </div>
            </section>`
          : ''
      }
      <header class="rounded-3xl border border-zinc-200 bg-white p-4 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <img src="assets/logo-focusflow.svg" alt="Logo FocusFlow" class="h-11 w-11 rounded-2xl" />
          <div>
            <h1 class="text-2xl font-semibold">FocusFlow</h1>
            <p class="text-sm text-zinc-500">Calendario, tareas y estudio automático para exámenes${state.profile?.username ? ` · @${state.profile.username}` : ''}</p>
            <p class="text-sm text-blue-600 dark:text-blue-300">Hoy: ${todayLabel}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button id="logout" class="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Logout</button>
        </div>
      </header>

      <section class="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <article class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-xl font-semibold capitalize">${monthLabel(state.currentMonth)}</h2>
            <div class="flex gap-2">
              <button id="prev-month" class="rounded-xl border border-zinc-200 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">←</button>
              <button id="next-month" class="rounded-xl border border-zinc-200 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">→</button>
            </div>
          </div>

          <div class="calendar-grid text-xs text-zinc-500">
            ${WEEK_DAYS.map((d) => `<span class="px-2">${d}</span>`).join('')}
          </div>

          <div class="calendar-grid calendar-month mt-2">
            ${monthDays
              .map((cell) => {
                const count = tasksForDate(cell.date).length;
                const isSelected = cell.date === state.selectedDate;
                return `
                  <button data-date="${cell.date}" class="min-h-20 rounded-2xl border border-zinc-200 p-2 text-left transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 ${
                    cell.inMonth ? '' : 'opacity-40'
                  } ${isSelected ? 'bg-blue-50 border-blue-500 dark:bg-blue-950/30' : ''}">
                    <p class="text-sm font-medium">${new Date(`${cell.date}T12:00:00`).getDate()}</p>
                    ${count ? `<p class="mt-2 text-xs text-zinc-500">${count} tareas</p>` : ''}
                  </button>
                `;
              })
              .join('')}
          </div>
        </article>

        <aside class="space-y-4">
          <article class="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 class="font-semibold">Carga diaria</h3>
            <p class="mt-1 text-sm text-zinc-500">${state.selectedDate}</p>
            <div class="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div class="h-full rounded-full bg-emerald-500" style="width:${Math.min((dailyMinutes / 240) * 100, 100)}%"></div>
            </div>
            <p class="mt-2 text-sm">${dailyMinutes} minutos planificados</p>
          </article>

          <article class="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 class="font-semibold">Resumen semanal</h3>
            <p class="text-sm text-zinc-500 mt-2">Semana ${start} → ${end}</p>
            <p class="text-xl font-semibold mt-2">${weekTotal} min</p>
          </article>

          <button id="open-panel" class="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">Ver tareas del día</button>
        </aside>
      </section>

      <button id="fab" class="fixed bottom-6 right-6 rounded-full bg-blue-600 p-4 text-2xl leading-none text-white shadow-soft hover:scale-105 hover:bg-blue-500">+</button>

      <div id="overlay" class="overlay fixed inset-0 z-40 bg-black/30"></div>
      <aside id="panel" class="side-panel fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-semibold">Detalle del día</h2>
          <button id="close-panel" class="rounded-xl border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Cerrar</button>
        </div>
        ${dayPanelView()}
      </aside>

      ${
        state.todayTasksModalOpen
          ? `
        <div id="today-tasks-overlay" class="fixed inset-0 z-[70] bg-black/40"></div>
        <section class="fixed left-1/2 top-1/2 z-[80] w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-soft dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold">Tus tareas de hoy (${toHumanDate(today)})</h3>
              <p class="text-sm text-zinc-500">${todayTasks.length ? 'Empieza por la más importante.' : 'Hoy no tienes tareas programadas.'}</p>
            </div>
            <button id="close-today-tasks-modal" class="rounded-lg border border-zinc-200 px-2 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Cerrar</button>
          </div>
          <div class="mt-3 max-h-60 space-y-2 overflow-y-auto">
            ${
              todayTasks.length
                ? todayTasks
                    .map(
                      (task) =>
                        `<article class="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700">
                          <p class="font-medium">${task.nombre}</p>
                          <p class="text-zinc-500">${task.minutos} min · ${task.tipo === 'exam' ? 'Plan examen' : 'Tarea'}</p>
                        </article>`,
                    )
                    .join('')
                : '<p class="text-sm text-zinc-500">Añade tareas desde el panel de día para organizarte.</p>'
            }
          </div>
        </section>
      `
          : ''
      }

      ${state.toast ? `<div class="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-soft dark:bg-zinc-100 dark:text-zinc-900">${state.toast}</div>` : ''}
    </main>
  `;
}

function render() {
  if (state.loading) {
    app.innerHTML = '<main class="min-h-screen grid place-items-center text-zinc-500">Cargando FocusFlow...</main>';
    return;
  }

  app.innerHTML = state.session ? appView() : authView();
  bindEvents();
  setPanel(state.panelOpen);
}

function setPanel(open) {
  state.panelOpen = open;
  const panel = document.getElementById('panel');
  const overlay = document.getElementById('overlay');
  if (!panel || !overlay) return;
  panel.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
}

async function handleAuth(event) {
  event.preventDefault();
  if (state.authLoading) return;

  const formData = new FormData(event.target);
  const email = String(formData.get('email')).trim();
  const password = String(formData.get('password')).trim();

  state.authError = '';
  state.authLoading = true;
  render();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  state.authLoading = false;
  if (!error) {
    state.loginPanelOpen = false;
  }
  if (error) {
    state.authError = 'E-mail o contraseña incorrecta.';
    render();
  }
}

async function handleRegister(event) {
  event.preventDefault();
  if (state.registerLoading) return;

  const formData = new FormData(event.target);
  const email = String(formData.get('register_email')).trim();
  const username = email.split('@')[0] || 'usuario';
  const password = String(formData.get('register_password')).trim();
  const confirmPassword = String(formData.get('confirm_password')).trim();

  state.registerError = '';

  if (password !== confirmPassword) {
    state.registerError = 'La contraseña no coincide.';
    render();
    return;
  }

  state.registerLoading = true;
  render();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: GH_PAGES_APP_URL,
    },
  });

  if (!error && data?.user?.id) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      username,
      email,
    });
  }

  state.registerLoading = false;

  if (error) {
    state.registerError = error.message;
    render();
  } else {
    state.registerPanelOpen = false;
    toast('Cuenta creada. Revisa tu correo si la confirmación está habilitada.');
    render();
  }
}

async function upsertTask(event) {
  event.preventDefault();
  const formData = new FormData(event.target);

  const payload = {
    user_id: state.session.user.id,
    nombre: String(formData.get('nombre')).trim(),
    minutos: Number(formData.get('minutos')),
    fecha: String(formData.get('fecha')),
    tipo: 'task',
  };

  if (!payload.nombre || payload.minutos <= 0 || !payload.fecha) {
    toast('Completa todos los campos de tarea correctamente.');
    return;
  }
  if (payload.fecha < todayISO()) {
    toast('No puedes crear tareas en días anteriores a hoy.');
    return;
  }

  if (state.editTaskId) {
    const current = state.tasks.find((item) => String(item.id) === String(state.editTaskId));
    if (current && dateStatus(current.fecha) === 'past') {
      toast('No puedes editar tareas de días anteriores.');
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .update({ nombre: payload.nombre, minutos: payload.minutos, fecha: payload.fecha })
      .eq('id', state.editTaskId)
      .eq('user_id', state.session.user.id);

    if (error) return toast(error.message);
    if (state.timer.taskId === state.editTaskId) resetTimer();
    state.editTaskId = null;
    toast('Tarea actualizada.');
  } else {
    const { error } = await supabase.from('tasks').insert(payload);
    if (error) return toast(error.message);
    toast('Tarea creada.');
  }

  await fetchTasks();
  render();
}

async function deleteTask(taskId) {
  const task = state.tasks.find((item) => String(item.id) === String(taskId));
  if (task && dateStatus(task.fecha) === 'past') {
    toast('No puedes modificar tareas de días anteriores.');
    return;
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', state.session.user.id);

  if (error) {
    toast(error.message);
    return;
  }

  if (state.timer.taskId === taskId) resetTimer();

  await fetchTasks();
  render();
}

async function createExamPlan(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const nombre = String(formData.get('nombre')).trim();
  const fecha_examen = String(formData.get('fecha_examen'));
  const fecha_inicio = String(formData.get('fecha_inicio'));
  const minutos_diarios = Number(formData.get('minutos_diarios'));

  if (!nombre || !fecha_examen || !fecha_inicio || minutos_diarios <= 0) {
    toast('Completa todos los datos del examen.');
    return;
  }
  if (fecha_inicio < todayISO() || fecha_examen < todayISO()) {
    toast('No puedes planificar exámenes en fechas anteriores a hoy.');
    return;
  }

  if (fecha_inicio > fecha_examen) {
    toast('La fecha de inicio no puede ser posterior al examen.');
    return;
  }

  const { error: examError } = await supabase.from('exams').insert({
    user_id: state.session.user.id,
    nombre,
    fecha_examen,
    fecha_inicio,
    minutos_diarios,
  });

  if (examError) return toast(examError.message);

  const tasks = [];
  let cursor = parseDate(fecha_inicio);
  const examDate = parseDate(fecha_examen);
  while (cursor < examDate) {
    tasks.push({
      user_id: state.session.user.id,
      fecha: formatDate(cursor),
      nombre: `Estudio: ${nombre}`,
      minutos: minutos_diarios,
      tipo: 'exam',
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  if (tasks.length) {
    const { error: tasksError } = await supabase.from('tasks').insert(tasks);
    if (tasksError) return toast(tasksError.message);
  }

  state.examSummary = { fecha_inicio, fecha_examen, nombre };
  await fetchTasks();
  render();
  toast(`Plan de examen generado (${tasks.length} tareas).`);
}

function shiftMonth(offset) {
  const [y, m] = state.currentMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  state.currentMonth = monthKey(date);
  render();
}

function playAlarmSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const now = context.currentTime;
  const frequencies = [880, 660, 880];

  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0.0001, now + index * 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.25, now + index * 0.25 + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.25 + 0.22);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(now + index * 0.25);
    oscillator.stop(now + index * 0.25 + 0.24);
  });
}

function notifyTimerDone(taskName) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  new Notification('⏰ FocusFlow', {
    body: `Se acabó el tiempo de: ${taskName}`,
    icon: 'assets/logo-focusflow.svg',
    badge: 'assets/logo-focusflow.svg',
  });
}

function updateNotificationPermissionState() {
  if (typeof Notification === 'undefined') {
    state.notificationPermission = 'unsupported';
    return;
  }
  state.notificationPermission = Notification.permission;
}

async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') {
    toast('Tu navegador no soporta notificaciones de escritorio.');
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    state.notificationPermission = permission;
    if (permission === 'granted') {
      toast('Notificaciones de escritorio activadas.');
    } else if (permission === 'denied') {
      toast('Has bloqueado las notificaciones. Puedes cambiarlas en el navegador.');
    }
    render();
  } catch {
    toast('No se pudo pedir permiso de notificaciones.');
  }
}

function openTodayTasksPanel() {
  const today = todayISO();
  state.selectedDate = today;
  state.currentMonth = monthKey(today);
  state.panelOpen = true;
  state.createMode = false;
  state.todayTasksModalOpen = true;
}

function startTaskTimer(taskId) {
  const task = state.tasks.find((item) => String(item.id) === String(taskId));
  if (!task) return;

  const status = dateStatus(task.fecha);
  if (status === 'future') {
    toast('No puedes iniciar una tarea antes de su fecha.');
    return;
  }
  if (status === 'past') {
    toast('Las tareas de días anteriores quedan como no entregadas.');
    return;
  }

  if (state.timer.taskId !== task.id) {
    state.timer.taskId = task.id;
    state.timer.remainingSeconds = Number(task.minutos) * 60;
    state.timer.doneTaskName = task.nombre;
  } else if (state.timer.remainingSeconds <= 0) {
    state.timer.remainingSeconds = Number(task.minutos) * 60;
  }

  state.timer.running = true;

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!state.timer.running) return;
    state.timer.remainingSeconds -= 1;
    if (state.timer.remainingSeconds <= 0) {
      state.timer.remainingSeconds = 0;
      state.timer.running = false;
      clearInterval(timerInterval);
      timerInterval = null;
      toast(`Tiempo terminado: ${state.timer.doneTaskName}`);
      playAlarmSound();
      notifyTimerDone(state.timer.doneTaskName);
    }
    updateTimerDisplay();
  }, 1000);

  render();
}

function pauseTaskTimer(taskId) {
  const task = state.tasks.find((item) => String(item.id) === String(taskId));
  if (task) {
    const status = dateStatus(task.fecha);
    if (status !== 'today') return;
  }

  if (state.timer.taskId && String(state.timer.taskId) === String(taskId)) {
    state.timer.running = false;
    render();
  }
}

function updateTimerDisplay() {
  if (!state.timer.taskId) return;
  const timerNode = document.getElementById(`timer-${state.timer.taskId}`);
  if (timerNode) {
    timerNode.textContent = formatSeconds(state.timer.remainingSeconds);
  }
}

async function submitTask(taskId) {
  const task = state.tasks.find((item) => String(item.id) === String(taskId));
  if (!task) return;

  const status = dateStatus(task.fecha);
  if (status === 'future') {
    toast('Solo puedes entregar tareas el día que toca.');
    return;
  }
  if (status === 'past') {
    toast('Las tareas de días anteriores quedan como no entregadas.');
    return;
  }

  const isCurrentTimerTask = state.timer.taskId && String(state.timer.taskId) === String(taskId);
  if (isCurrentTimerTask) {
    resetTimer();
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', state.session.user.id);

  if (error) {
    toast(error.message);
    return;
  }

  await fetchTasks();
  render();
  toast(`Tarea entregada: ${task.nombre}`);
}

function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  state.timer.taskId = null;
  state.timer.remainingSeconds = 0;
  state.timer.running = false;
  state.timer.doneTaskName = '';
}

function bindEvents() {
  const authForm = document.getElementById('auth-form');
  if (authForm) authForm.addEventListener('submit', handleAuth);

  const registerForm = document.getElementById('register-form');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  const openLoginPanelBtn = document.getElementById('open-login-panel');
  if (openLoginPanelBtn) {
    openLoginPanelBtn.addEventListener('click', () => {
      state.loginPanelOpen = true;
      state.registerPanelOpen = false;
      state.authError = '';
      render();
    });
  }

  const openRegisterPanelBtn = document.getElementById('open-register-panel');
  if (openRegisterPanelBtn) {
    openRegisterPanelBtn.addEventListener('click', () => {
      state.registerPanelOpen = true;
      state.loginPanelOpen = false;
      state.authError = '';
      state.registerError = '';
      render();
    });
  }


  const closeLoginPanelBtn = document.getElementById('close-login-panel');
  if (closeLoginPanelBtn) {
    closeLoginPanelBtn.addEventListener('click', () => {
      state.loginPanelOpen = false;
      state.authError = '';
      render();
    });
  }

  const loginOverlay = document.getElementById('login-overlay');
  if (loginOverlay) {
    loginOverlay.addEventListener('click', () => {
      state.loginPanelOpen = false;
      state.authError = '';
      render();
    });
  }

  const goRegisterFromLogin = document.getElementById('go-register-from-login');
  if (goRegisterFromLogin) {
    goRegisterFromLogin.addEventListener('click', () => {
      state.loginPanelOpen = false;
      state.registerPanelOpen = true;
      state.authError = '';
      state.registerError = '';
      render();
    });
  }

  const closeRegisterPanelBtn = document.getElementById('close-register-panel');
  if (closeRegisterPanelBtn) {
    closeRegisterPanelBtn.addEventListener('click', () => {
      state.registerPanelOpen = false;
      state.registerError = '';
      render();
    });
  }

  const registerOverlay = document.getElementById('register-overlay');
  if (registerOverlay) {
    registerOverlay.addEventListener('click', () => {
      state.registerPanelOpen = false;
      state.registerError = '';
      render();
    });
  }

  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
    });
  }

  document.querySelectorAll('[data-date]').forEach((el) => {
    el.addEventListener('click', () => {
      state.selectedDate = el.dataset.date;
      state.createMode = false;
      state.editTaskId = null;
      state.panelOpen = true;
      render();
    });
  });

  const prev = document.getElementById('prev-month');
  if (prev) prev.addEventListener('click', () => shiftMonth(-1));

  const next = document.getElementById('next-month');
  if (next) next.addEventListener('click', () => shiftMonth(1));

  const panelBtn = document.getElementById('open-panel');
  if (panelBtn) panelBtn.addEventListener('click', () => {
    state.createMode = false;
    state.editTaskId = null;
    setPanel(true);
    render();
  });

  const fab = document.getElementById('fab');
  if (fab) {
    fab.addEventListener('click', () => {
      state.panelOpen = true;
      state.createMode = true;
      render();
      document.querySelector('#task-form input[name="nombre"]')?.focus();
    });
  }

  const closePanel = document.getElementById('close-panel');
  if (closePanel) closePanel.addEventListener('click', () => setPanel(false));

  const overlay = document.getElementById('overlay');
  if (overlay) overlay.addEventListener('click', () => setPanel(false));

  const todayTasksOverlay = document.getElementById('today-tasks-overlay');
  if (todayTasksOverlay) {
    todayTasksOverlay.addEventListener('click', () => {
      state.todayTasksModalOpen = false;
      render();
    });
  }

  const closeTodayTasksModal = document.getElementById('close-today-tasks-modal');
  if (closeTodayTasksModal) {
    closeTodayTasksModal.addEventListener('click', () => {
      state.todayTasksModalOpen = false;
      render();
    });
  }

  const notificationPrompt = document.getElementById('request-notification-permission');
  if (notificationPrompt) {
    notificationPrompt.addEventListener('click', () => {
      requestNotificationPermission();
    });
  }

  const dismissNotificationPrompt = document.getElementById('dismiss-notification-prompt');
  if (dismissNotificationPrompt) {
    dismissNotificationPrompt.addEventListener('click', () => {
      state.notificationPromptDismissed = true;
      sessionStorage.setItem('focusflow-notification-prompt-dismissed', '1');
      render();
    });
  }

  const taskForm = document.getElementById('task-form');
  if (taskForm) taskForm.addEventListener('submit', upsertTask);

  const examForm = document.getElementById('exam-form');
  if (examForm) examForm.addEventListener('submit', createExamPlan);

  const cancelEdit = document.getElementById('cancel-edit');
  if (cancelEdit) {
    cancelEdit.addEventListener('click', () => {
      state.editTaskId = null;
      render();
    });
  }

  document.querySelectorAll('[data-edit-task]').forEach((el) => {
    el.addEventListener('click', () => {
      const task = state.tasks.find((item) => String(item.id) === String(el.dataset.editTask));
      if (task && dateStatus(task.fecha) === 'past') {
        toast('No puedes editar tareas de días anteriores.');
        return;
      }
      state.editTaskId = el.dataset.editTask;
      state.createMode = true;
      render();
    });
  });

  document.querySelectorAll('[data-delete-task]').forEach((el) => {
    el.addEventListener('click', () => deleteTask(el.dataset.deleteTask));
  });

  document.querySelectorAll('[data-start-timer]').forEach((el) => {
    el.addEventListener('click', () => startTaskTimer(el.dataset.startTimer));
  });

  document.querySelectorAll('[data-pause-timer]').forEach((el) => {
    el.addEventListener('click', () => pauseTaskTimer(el.dataset.pauseTimer));
  });

  document.querySelectorAll('[data-submit-task]').forEach((el) => {
    el.addEventListener('click', () => submitTask(el.dataset.submitTask));
  });

}

initSession();
