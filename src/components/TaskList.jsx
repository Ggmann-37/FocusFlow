import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';

export function TaskList({ selectedDate, tasks, onDeleteTask, onEditTask }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">
        {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
      </h3>
      <AnimatePresence>
        {tasks.map((task) => (
          <motion.article
            key={task.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{task.nombre}</p>
                <p className="text-sm text-zinc-500">{task.minutos} min · {task.tipo === 'exam' ? 'Plan examen' : 'Tarea'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onEditTask(task)}
                  className="rounded-lg border px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </motion.article>
        ))}
      </AnimatePresence>
      {!tasks.length && <p className="text-sm text-zinc-500">Sin tareas para este día.</p>}
    </div>
  );
}
