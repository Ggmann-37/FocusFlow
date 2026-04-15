import { useEffect, useState } from 'react';
import { format } from 'date-fns';

const initialState = { nombre: '', minutos: 25, fecha: format(new Date(), 'yyyy-MM-dd') };

export function TaskForm({ selectedDate, onSubmit, editingTask, onCancelEdit }) {
  const [form, setForm] = useState(initialState);

  useEffect(() => {
    setForm((prev) => ({ ...prev, fecha: format(selectedDate, 'yyyy-MM-dd') }));
  }, [selectedDate]);

  useEffect(() => {
    if (editingTask) {
      setForm({ nombre: editingTask.nombre, minutos: editingTask.minutos, fecha: editingTask.fecha });
    }
  }, [editingTask]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
    setForm({ ...initialState, fecha: form.fecha });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="font-semibold">{editingTask ? 'Editar tarea' : 'Nueva tarea'}</h3>
      <input
        required
        placeholder="Nombre"
        value={form.nombre}
        onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
        className="w-full rounded-xl border bg-transparent px-3 py-2"
      />
      <input
        required
        type="number"
        min={1}
        placeholder="Minutos"
        value={form.minutos}
        onChange={(e) => setForm((p) => ({ ...p, minutos: Number(e.target.value) }))}
        className="w-full rounded-xl border bg-transparent px-3 py-2"
      />
      <input
        required
        type="date"
        value={form.fecha}
        onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
        className="w-full rounded-xl border bg-transparent px-3 py-2"
      />
      <div className="flex gap-2">
        <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500" type="submit">
          {editingTask ? 'Guardar cambios' : 'Crear tarea'}
        </button>
        {editingTask ? (
          <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={onCancelEdit}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
