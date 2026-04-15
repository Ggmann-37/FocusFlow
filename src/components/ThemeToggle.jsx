import { motion } from 'framer-motion';

const options = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

export function ThemeToggle({ mode, setMode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className="relative z-10 rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            {mode === option.value && (
              <motion.span
                layoutId="theme-pill"
                className="absolute inset-0 -z-10 rounded-xl bg-zinc-100 dark:bg-zinc-800"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
