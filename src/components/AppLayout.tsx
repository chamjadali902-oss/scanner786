import { AppHeader } from './AppSidebar';
import { SessionBar } from './SessionBar';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
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
