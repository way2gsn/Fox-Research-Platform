'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hexagon, Lock, User, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh(); // Force refresh to update middleware state
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] relative overflow-hidden">
      {/* Ambient glowing orbs */}
      <div className="ambient-orb orb-1 opacity-60" />
      <div className="ambient-orb orb-2 opacity-60" />
      <div className="cyber-grid" />

      <div className="w-full max-w-md p-8 bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl shadow-2xl relative z-10 fade-up">
        <div className="flex flex-col items-center mb-8">
          <img src="https://researchfox.com/wp-content/uploads/2021/12/footer-logo.svg" alt="ResearchFox" className="h-10 opacity-90 hidden dark:block mb-2" />
          <img src="https://researchfox.com/wp-content/uploads/2024/11/logo_researchfox.png" alt="ResearchFox" className="h-10 dark:hidden mb-2" />
          <h1 className="sr-only">ResearchFox</h1>
          <p className="text-[var(--text-dim)] text-sm">
            AI Intelligence Platform
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-dim)] mb-1.5 ml-1">
              USERNAME
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={16} className="text-[var(--text-faint)]" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-[var(--border)] rounded-xl bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-dim)] mb-1.5 ml-1">
              PASSWORD
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={16} className="text-[var(--text-faint)]" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-[var(--border)] rounded-xl bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center fade-up">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-6"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
