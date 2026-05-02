'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { FolderOpen, LayoutGrid, ChevronRight, Hexagon, Sun, Moon, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '@/components/ThemeProvider';

export function AppShell({ children, breadcrumbs }: {
  children: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="flex h-screen w-full relative overflow-hidden">
      {/* Futuristic Backgrounds */}
      <div className="cyber-grid" />
      <div className="ambient-orb orb-1" />
      <div className="ambient-orb orb-2" />

      {/* Sidebar */}
      <aside className="relative z-10 w-14 shrink-0 border-r border-[var(--border)] bg-[var(--surface-1)] flex flex-col items-center py-5 gap-6">
        {/* Logo mark */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_15px_rgba(255,92,0,0.4)]">
          <Hexagon size={18} className="text-black fill-black/20" strokeWidth={2.5} />
        </div>

        <nav className="flex flex-col items-center gap-2 mt-2">
          <NavIcon href="/" icon={<LayoutGrid size={18} />} active={pathname === '/'} label="Projects" />
        </nav>
      </aside>

      {/* Main */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <header className="h-12 border-b border-[var(--border)] bg-[var(--surface-1)] flex items-center px-5 gap-4">
          <div className="flex items-center gap-3 border-r border-[var(--border)] pr-4">
            {/* Dark Mode Logo (White SVG) */}
            <img src="https://researchfox.com/wp-content/uploads/2021/12/footer-logo.svg" alt="ResearchFox" className="h-4 opacity-90 hidden dark:block" />
            {/* Light Mode Logo (Colored) */}
            <img src="https://researchfox.com/wp-content/uploads/2024/11/logo_researchfox.png" alt="ResearchFox" className="h-4 dark:hidden" />
          </div>
          
          {breadcrumbs?.map((b, i) => (
            <span key={i} className="flex items-center gap-2 text-xs">
              {i > 0 && <ChevronRight size={12} className="text-[var(--text-faint)]" />}
              {b.href ? (
                <Link href={b.href} className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">{b.label}</Link>
              ) : (
                <span className="text-[var(--text)]">{b.label}</span>
              )}
            </span>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] text-[var(--text-faint)] font-mono uppercase tracking-wider hidden sm:block">AI Platform</span>
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse-slow shadow-[0_0_8px_rgba(0,229,255,0.6)] hidden sm:block" />
            <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />
            <button 
              onClick={toggleTheme}
              className="p-1.5 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="h-4 w-px bg-[var(--border)]" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-dim)] hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
              <span className="text-xs font-medium">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavIcon({ href, icon, active, label }: { href: string; icon: ReactNode; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      title={label}
      className={clsx(
        'w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150',
        active
          ? 'bg-amber-500/20 text-amber-400'
          : 'text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text-dim)]'
      )}
    >
      {icon}
    </Link>
  );
}
