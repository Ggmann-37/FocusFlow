import { useEffect, useMemo, useState } from 'react';
import { endOfWeek, format, isSameDay, parseISO, startOfWeek } from 'date-fns';
import { supabase } from './lib/supabase';
import { useTheme } from './hooks/useTheme';
import { Auth } from './components/Auth';
import { Calendar } from './components/Calendar';
import { TaskList } from './components/TaskList';
import { TaskForm } from './components/TaskForm';
import { ExamForm } from './components/ExamForm';
import { SidePanel } from './components/SidePanel';
import { ThemeToggle } from './components/ThemeToggle';

const formatDate = (date) => format(date, 'yyyy-MM-dd');

export default function App() {
  const { mode, setMode } = useTheme();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    fetchUserData(session.user.id);
  }, [session?.user?.id]);

  const fetchUserData = async (userId) => {
    setLoading(true);
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('fecha', { ascending: true });

    if (taskError) {
      setError(taskError.message);
      setLoading(false);
      return;
    }

    setTasks(taskData || []);
    setLoading(false);
  };

  const dayTasks = useMemo(
    () => tasks.filter((task) => isSameDay(parseISO(task.fecha), selectedDate)),
    [tasks, selectedDate]
  );

  const weeklyMinutes = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });

    return tasks
      .filter((task) => {
        const date = parseISO(task.fecha);
        return date >= start && date <= end;
      })
      .reduce((sum, task) => sum + task.minutos, 0);
  }, [tasks, selectedDate]);

  const dailyMinutes = dayTasks.reduce((sum, task) => sum + task.minutos, 0);

  const handleSaveTask = async (formData) => {
    setError('');

    if (editingTask) {
      const { data, error: updateError } = await supabase
        .from('tasks')
        .update({ nombre: formData.nombre, minutos: formData.minutos, fecha: formData.fecha })
        .eq('id', editingTask.id)
        .select()
        .single();

      if (updateError) return setError(updateError.message);

      setTasks((prev) => prev.map((task) => (task.id === data.id ? data : task)));
      setEditingTask(null);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({
        user_id: session.user.id,
        nombre: formData.nombre,
        minutos: formData.minutos,
        fecha: formData.fecha,
        tipo: 'task',
      })
      .select()
      .single();

    if (insertError) return setError(insertError.message);
    setTasks((prev) => [...prev, data]);
  };

  const handleDeleteTask = async (taskId) => {
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId);
    if (deleteError) return setError(deleteError.message);
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  const handleCreateExamPlan = async ({ generatedTasks, ...examPayload }) => {
    const { error: examError } = await supabase.from('exams').insert({
      ...examPayload,
      user_id: session.user.id,
    });

    if (examError) return setError(examError.message);

    const payload = generatedTasks.map((task) => ({ ...task, user_id: session.user.id }));
    const { data: createdTasks, error: taskError } = await supabase.from('tasks').insert(payload).select();

    if (taskError) return setError(taskError.message);
    setTasks((prev) => [...prev, ...(createdTasks || [])]);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setTasks([]);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-500">Cargando FocusFlow...</div>;
  }

  if (!session) {
    return <Auth supabase={supabase} onAuthSuccess={() => null} />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl space-y-5 p-4 md:p-8">
      <header className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">FocusFlow</h1>
          <p className="text-sm text-zinc-500">Planifica tareas y estudio automático para exámenes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle mode={mode} setMode={setMode} />
          <button onClick={logout} className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Logout
          </button>
        </div>
      </header>

      {error ? <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Calendar
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setSidePanelOpen(true);
          }}
          tasks={tasks}
        />

        <div className="space-y-4">
          <TaskForm
            selectedDate={selectedDate}
            onSubmit={handleSaveTask}
            editingTask={editingTask}
            onCancelEdit={() => setEditingTask(null)}
          />
          <ExamForm onCreateExamPlan={handleCreateExamPlan} />

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="font-semibold">Carga diaria</h3>
            <p className="mt-1 text-sm text-zinc-500">{format(selectedDate, 'yyyy-MM-dd')}</p>
            <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min((dailyMinutes / 240) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-sm">{dailyMinutes} minutos planificados</p>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="font-semibold">Resumen semanal</h3>
            <p className="mt-2 text-sm text-zinc-500">Semana de {formatDate(startOfWeek(selectedDate, { weekStartsOn: 1 }))} a {formatDate(endOfWeek(selectedDate, { weekStartsOn: 1 }))}</p>
            <p className="mt-2 text-xl font-semibold">{weeklyMinutes} min</p>
          </article>
        </div>
      </section>

      <button
        onClick={() => setSidePanelOpen(true)}
        className="fixed bottom-6 right-6 rounded-full bg-blue-600 p-4 text-xl text-white shadow-soft hover:scale-105 hover:bg-blue-500"
        aria-label="Abrir panel de tareas"
      >
        +
      </button>

      <SidePanel open={sidePanelOpen} onClose={() => setSidePanelOpen(false)}>
        <TaskList selectedDate={selectedDate} tasks={dayTasks} onDeleteTask={handleDeleteTask} onEditTask={setEditingTask} />
      </SidePanel>
    </main>
  );
}
