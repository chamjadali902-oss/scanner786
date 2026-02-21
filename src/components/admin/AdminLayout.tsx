import { useAdmin } from '@/hooks/useAdmin';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Shield, Users, BarChart3, Settings, Globe, ArrowLeft, LogOut, Database, TrendingUp, Brain, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const ADMIN_NAV = [
  { title: 'Dashboard', path: '/admin', icon: BarChart3 },
  { title: 'Users', path: '/admin/users', icon: Users },
  { title: 'Strategies', path: '/admin/strategies', icon: Globe },
  { title: 'Trades', path: '/admin/trades', icon: TrendingUp },
  { title: 'AI Prompts', path: '/admin/prompts', icon: Brain },
  { title: 'Database', path: '/admin/database', icon: Database },
  { title: 'Settings', path: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const { isAdmin, loading } = useAdmin();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/auth');
    }
  }, [isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Shield className="w-6 h-6 animate-pulse text-primary" />
          <span>Verifying admin access...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">Admin Panel</h1>
            <p className="text-[10px] text-muted-foreground">CryptoScanner Pro</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {ADMIN_NAV.map(item => (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              onNavigate?.();
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              location.pathname === item.path
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.title}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={() => {
            navigate('/');
            onNavigate?.();
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to App
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs text-destructive hover:text-destructive"
          onClick={() => {
            signOut();
            onNavigate?.();
          }}
        >
          <LogOut className="w-3.5 h-3.5" /> Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-60 border-r border-border bg-card/50 flex-col">
        <SidebarContent />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-40 border-b border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-sm font-bold text-foreground">Admin Panel</h1>
            </div>

            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-card border-border p-0">
                <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
                <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
