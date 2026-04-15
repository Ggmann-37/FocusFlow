import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'REEMPLAZA_CON_TU_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'REEMPLAZA_CON_TU_SUPABASE_ANON_KEY';

if (SUPABASE_URL.includes('REEMPLAZA_') || SUPABASE_ANON_KEY.includes('REEMPLAZA_')) {
  document.getElementById('app').innerHTML = `
    <main class="mx-auto max-w-2xl p-6">
      <section class="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-800 shadow-soft">
        <h1 class="text-xl font-semibold">Configura Supabase</h1>
        <p class="mt-2 text-sm">
          Edita <code>app.js</code> y reemplaza <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code>.
        </p>
      </section>
    </main>
  `;
  throw new Error('Supabase no configurado');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  session: null,
  tasks: [],
  selectedDate: formatDate(new Date()),
  currentMonth: monthKey(new Date()),
  panelOpen: false,
  editTaskId: null,
  mode: localStorage.getItem('focusflow-theme') || 'system',
  loading: true,
  toast: '',
};

const app = document.getElementById('app');

const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function applyTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = state.mode === 'system' ? (prefersDark ? 'dark' : 'light') : state.mode;
  document.documentElement.classList.toggle('dark', effective === 'dark');
}

function setTheme(mode) {
  state.mode = mode;
  localStorage.setItem('focusflow-theme', mode);
  applyTheme();
  render();
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.mode === 'system') {
    applyTheme();
  }
});

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

async function initSession() {
  applyTheme();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    toast(error.message);
  }
  state.session = data.session;
  state.loading = false;

  if (state.session) {
    await fetchTasks();
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.editTaskId = null;
    if (session) {
      await fetchTasks();
    } else {
      state.tasks = [];
    }
    render();
  });

  render();
}

function authView() {
  return `
    <main class="flex min-h-screen items-center justify-center p-5">
      <section class="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 fade-in">
        <h1 class="text-2xl font-semibold">FocusFlow</h1>
        <p class="mt-1 text-sm text-zinc-500">Productividad, tareas y estudio inteligente.</p>

        <form id="auth-form" class="mt-6 space-y-3">
          <input required name="email" type="email" placeholder="Email" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700" />
          <input required name="password" type="password" placeholder="Contraseña" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700" />
          <button data-mode="login" class="w-full rounded-xl bg-blue-600 py-2 text-white hover:bg-blue-500">Entrar</button>
          <button data-mode="register" class="w-full rounded-xl border border-zinc-200 py-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Crear cuenta</button>
        </form>
      </section>
    </main>
  `;
}

function dayPanelView() {
  const tasks = tasksForDate(state.selectedDate);
  const editingTask = tasks.find((t) => t.id === state.editTaskId);

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
                .map(
                  (task) => `
              <article class="task-item rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="font-medium">${task.nombre}</p>
                    <p class="text-sm text-zinc-500">${task.minutos} min · ${task.tipo === 'exam' ? 'Plan examen' : 'Tarea'}</p>
                  </div>
                  <div class="flex gap-1">
                    <button data-edit-task="${task.id}" class="rounded-lg border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Editar</button>
                    <button data-delete-task="${task.id}" class="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">Eliminar</button>
                  </div>
                </div>
              </article>
            `
                )
                .join('')
            : '<p class="text-sm text-zinc-500">No hay tareas para este día.</p>'
        }
      </div>

      <form id="task-form" class="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 space-y-2">
        <h3 class="font-semibold">${editingTask ? 'Editar tarea' : 'Nueva tarea'}</h3>
        <input required name="nombre" value="${editingTask ? editingTask.nombre : ''}" placeholder="Nombre" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
        <input required min="1" name="minutos" type="number" value="${editingTask ? editingTask.minutos : 30}" placeholder="Minutos" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
        <input required name="fecha" type="date" value="${editingTask ? editingTask.fecha : state.selectedDate}" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
        <div class="flex gap-2">
          <button class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500">${editingTask ? 'Guardar cambios' : 'Crear tarea'}</button>
          ${editingTask ? '<button type="button" id="cancel-edit" class="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">Cancelar</button>' : ''}
        </div>
      </form>

      <form id="exam-form" class="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 space-y-2">
        <h3 class="font-semibold">Planificar examen</h3>
        <input required name="nombre" placeholder="Nombre examen" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
        <input required name="fecha_examen" type="date" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
        <input required name="fecha_inicio" type="date" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
        <input required min="1" name="minutos_diarios" type="number" value="60" class="w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-700" />
        <button class="rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500">Generar plan automático</button>
      </form>
    </div>
  `;
}

function appView() {
  const monthDays = getMonthDays(state.currentMonth);
  const dailyMinutes = minutesForDate(state.selectedDate);
  const weekTotal = weekMinutes(state.selectedDate);
  const { start, end } = getWeekBounds(state.selectedDate);

  return `
    <main class="mx-auto max-w-7xl p-4 md:p-8 space-y-5">
      <header class="rounded-3xl border border-zinc-200 bg-white p-4 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold">FocusFlow</h1>
          <p class="text-sm text-zinc-500">Calendario, tareas y estudio automático para exámenes</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="rounded-2xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
            ${['light', 'dark', 'system']
              .map(
                (mode) => `
                <button data-theme="${mode}" class="rounded-xl px-3 py-1.5 text-sm ${
                  state.mode === mode ? 'bg-white dark:bg-zinc-900 shadow-soft' : ''
                }">${mode === 'light' ? 'Claro' : mode === 'dark' ? 'Oscuro' : 'Sistema'}</button>`
              )
              .join('')}
          </div>
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

          <button id="open-panel" class="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">Abrir panel de día</button>
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
  const button = event.submitter;
  const mode = button?.dataset?.mode;
  if (!mode) return;

  const formData = new FormData(event.target);
  const email = String(formData.get('email')).trim();
  const password = String(formData.get('password')).trim();

  const action = mode === 'login' ? 'signInWithPassword' : 'signUp';
  const { error } = await supabase.auth[action]({ email, password });

  if (error) {
    toast(error.message);
  } else if (mode === 'register') {
    toast('Cuenta creada. Revisa tu correo si la confirmación está habilitada.');
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

  if (state.editTaskId) {
    const { error } = await supabase
      .from('tasks')
      .update({ nombre: payload.nombre, minutos: payload.minutos, fecha: payload.fecha })
      .eq('id', state.editTaskId)
      .eq('user_id', state.session.user.id);

    if (error) return toast(error.message);
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

function bindEvents() {
  const authForm = document.getElementById('auth-form');
  if (authForm) authForm.addEventListener('submit', handleAuth);

  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
    });
  }

  document.querySelectorAll('[data-theme]').forEach((el) => {
    el.addEventListener('click', () => setTheme(el.dataset.theme));
  });

  document.querySelectorAll('[data-date]').forEach((el) => {
    el.addEventListener('click', () => {
      state.selectedDate = el.dataset.date;
      state.panelOpen = true;
      render();
    });
  });

  const prev = document.getElementById('prev-month');
  if (prev) prev.addEventListener('click', () => shiftMonth(-1));

  const next = document.getElementById('next-month');
  if (next) next.addEventListener('click', () => shiftMonth(1));

  const panelBtn = document.getElementById('open-panel');
  if (panelBtn) panelBtn.addEventListener('click', () => setPanel(true));

  const fab = document.getElementById('fab');
  if (fab) {
    fab.addEventListener('click', () => {
      state.panelOpen = true;
      render();
      document.querySelector('#task-form input[name="nombre"]')?.focus();
    });
  }

  const closePanel = document.getElementById('close-panel');
  if (closePanel) closePanel.addEventListener('click', () => setPanel(false));

  const overlay = document.getElementById('overlay');
  if (overlay) overlay.addEventListener('click', () => setPanel(false));

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
      state.editTaskId = el.dataset.editTask;
      render();
    });
  });

  document.querySelectorAll('[data-delete-task]').forEach((el) => {
    el.addEventListener('click', () => deleteTask(el.dataset.deleteTask));
  });
}

initSession();
