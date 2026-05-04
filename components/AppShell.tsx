'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { FolderOpen, LayoutGrid, ChevronRight, Hexagon, Sun, Moon, LogOut, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '@/components/ThemeProvider';

export function AppShell({ children, breadcrumbs }: {
  children: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="flex h-screen w-full relative overflow-hidden">
      {/* Futuristic Backgrounds */}
      <div className="dot-matrix" />
      <div className="cyber-grid" />

      {/* Sidebar */}
      <aside className="hidden sm:flex relative z-10 w-16 shrink-0 border-r border-[var(--border)] bg-[var(--surface-1)]/80 backdrop-blur-md flex-col items-center py-6 gap-8 overflow-hidden">
        {/* Geometric Accent Decoration */}
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-[var(--amber)]/20 to-transparent" />
        
        {/* Logo mark */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_15px_rgba(255,92,0,0.4)]">
          <Hexagon size={18} className="text-black fill-black/20" strokeWidth={2.5} />
        </div>

        <nav className="flex flex-col items-center gap-2 mt-2">
          <NavIcon href="/" icon={<LayoutGrid size={18} />} active={pathname === '/'} label="Projects" />
        </nav>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 max-w-[80vw] h-full bg-[var(--surface-1)] border-r border-[var(--border)] p-6 flex flex-col shadow-2xl animate-slide-right">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_15px_rgba(255,92,0,0.4)]">
                  <Hexagon size={18} className="text-black fill-black/20" strokeWidth={2.5} />
                </div>
                <span className="font-bold text-[var(--text)] tracking-tight">ResearchFox</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 -mr-2 text-[var(--text-dim)] hover:text-[var(--text)]">
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors', pathname === '/' ? 'bg-amber-500/15 text-amber-500' : 'text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]')}>
                <LayoutGrid size={20} /> Projects
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 min-h-0 bg-transparent">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b border-[var(--border)] bg-[var(--surface-1)]/50 backdrop-blur-lg flex items-center px-4 sm:px-6 gap-3 sm:gap-5">
          <button onClick={() => setMobileMenuOpen(true)} className="sm:hidden p-2 text-[var(--text-dim)] hover:text-[var(--text)]">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-4 border-r-0 sm:border-r border-[var(--border)] pr-3 sm:pr-5">
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
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-dim)] hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
              <span className="text-xs font-medium hidden sm:inline">Logout</span>
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
