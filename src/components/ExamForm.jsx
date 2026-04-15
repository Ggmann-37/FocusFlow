import { eachDayOfInterval, format, isAfter, parseISO, subDays } from 'date-fns';
import { useState } from 'react';

const initialState = {
  nombre: '',
  fecha_examen: '',
  fecha_inicio: '',
  minutos_diarios: 60,
};

export function ExamForm({ onCreateExamPlan }) {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    const examDate = parseISO(form.fecha_examen);
    const startDate = parseISO(form.fecha_inicio);

    if (isAfter(startDate, examDate)) {
      setError('La fecha de inicio no puede ser posterior al examen.');
      return;
    }

    const studyRange = eachDayOfInterval({ start: startDate, end: subDays(examDate, 1) });
    const generatedTasks = studyRange.map((date) => ({
      nombre: `Estudio: ${form.nombre}`,
      fecha: format(date, 'yyyy-MM-dd'),
      minutos: Number(form.minutos_diarios),
      tipo: 'exam',
    }));

    onCreateExamPlan({ ...form, minutos_diarios: Number(form.minutos_diarios), generatedTasks });
    setForm(initialState);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="font-semibold">Planificación de examen</h3>
      <input
        required
        placeholder="Nombre examen"
        className="w-full rounded-xl border bg-transparent px-3 py-2"
        value={form.nombre}
        onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
      />
      <input
        required
        type="date"
        className="w-full rounded-xl border bg-transparent px-3 py-2"
        value={form.fecha_examen}
        onChange={(e) => setForm((p) => ({ ...p, fecha_examen: e.target.value }))}
      />
      <input
        required
        type="date"
        className="w-full rounded-xl border bg-transparent px-3 py-2"
        value={form.fecha_inicio}
        onChange={(e) => setForm((p) => ({ ...p, fecha_inicio: e.target.value }))}
      />
      <input
        required
        type="number"
        min={1}
        className="w-full rounded-xl border bg-transparent px-3 py-2"
        value={form.minutos_diarios}
        onChange={(e) => setForm((p) => ({ ...p, minutos_diarios: Number(e.target.value) }))}
      />
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
      <button className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500" type="submit">
        Generar plan automático
      </button>
    </form>
  );
}
