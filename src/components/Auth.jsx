import { useState } from 'react';
import { motion } from 'framer-motion';

export function Auth({ supabase, onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const method = isLogin ? 'signInWithPassword' : 'signUp';
    const { error: authError } = await supabase.auth[method]({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    onAuthSuccess();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-4 rounded-3xl border border-zinc-200 bg-white p-8 shadow-soft dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h1 className="text-2xl font-semibold">FocusFlow</h1>
        <p className="text-sm text-zinc-500">Inicia sesión para gestionar tu calendario de enfoque.</p>

        <label className="block space-y-1">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none ring-blue-500 focus:ring-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">Contraseña</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none ring-blue-500 focus:ring-2"
          />
        </label>

        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Crear cuenta'}
        </button>

        <button
          type="button"
          className="w-full text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100"
          onClick={() => setIsLogin((v) => !v)}
        >
          {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </motion.form>
    </div>
  );
}
