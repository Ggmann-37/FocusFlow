import { AnimatePresence, motion } from 'framer-motion';

export function SidePanel({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
            aria-label="Cerrar panel"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 240 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <button onClick={onClose} className="mb-4 rounded-xl border px-3 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
              Cerrar
            </button>
            {children}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
