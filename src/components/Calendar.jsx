import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';

export function Calendar({ currentMonth, setCurrentMonth, selectedDate, onSelectDate, tasks }) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const countByDate = tasks.reduce((acc, task) => {
    acc[task.fecha] = (acc[task.fecha] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold capitalize">{format(currentMonth, 'MMMM yyyy', { locale: es })}</h2>
        <div className="flex gap-2">
          <button className="rounded-xl border px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>←</button>
          <button className="rounded-xl border px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>→</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-xs text-zinc-500">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <span key={d} className="px-2">{d}</span>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={format(currentMonth, 'yyyy-MM')}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="mt-2 grid grid-cols-7 gap-2"
        >
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

            return (
              <button
                key={dateKey}
                onClick={() => onSelectDate(day)}
                className={`min-h-20 rounded-2xl border p-2 text-left ${
                  isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                } ${isCurrentMonth ? '' : 'opacity-40'}`}
              >
                <p className="text-sm font-medium">{format(day, 'd')}</p>
                {countByDate[dateKey] ? (
                  <p className="mt-2 text-xs text-zinc-500">{countByDate[dateKey]} tareas</p>
                ) : null}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
