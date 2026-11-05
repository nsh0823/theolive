import type { ReactNode } from 'react';
import { Logo } from '@/ui/Logo';

/** Centered card layout shared by the login, set-password, loading and no-access screens. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl bg-card p-8 shadow-card">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
