import { useEffect } from 'react';
import { AppHeader } from './AppSidebar';
import { SessionBar } from './SessionBar';
import { useAuth } from '@/hooks/useAuth';
import { startTriggerMonitor, stopTriggerMonitor } from '@/lib/trigger-monitor';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  const { user, loading } = useAuth();

  // Entry trigger alert monitor: runs once a signed-in session exists.
  useEffect(() => {
    if (loading) return;
    if (user) {
      startTriggerMonitor(user.id);
      return () => stopTriggerMonitor();
    }
  }, [user, loading]);

  return (
    <div className="min-h-screen bg-background terminal-bg flex flex-col">
      <SessionBar />
      <AppHeader />
      <main className={className}>
        {children}
      </main>
    </div>
  );
}
