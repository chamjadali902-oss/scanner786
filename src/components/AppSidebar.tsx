import { LineChart, Brain, BarChart3, Beaker, Globe, LogIn, LogOut, User, Activity, Zap, Menu, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useState } from 'react';
import { AlertsPanel } from './scanner/AlertsPanel';

const NAV_ITEMS = [
  { title: 'Scanner', url: '/', icon: LineChart },
  { title: 'Smart Signals', url: '/signals', icon: Sparkles },
  { title: 'AI Chat', url: '/chat', icon: Brain },
  { title: 'Journal', url: '/journal', icon: BookOpen },
  { title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
  { title: 'Backtest', url: '/backtest', icon: Beaker },
  { title: 'Marketplace', url: '/marketplace', icon: Globe },
];

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo + Mobile menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile hamburger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-card border-border p-0">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex flex-col h-full">
                  {/* Sidebar header */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary">
                        <LineChart className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div>
                        <h1 className="text-sm font-extrabold">
                          <span className="text-gradient-primary">CryptoScanner</span>
                          <span className="text-primary ml-1 text-[10px] font-bold">PRO</span>
                        </h1>
                      </div>
                    </div>
                  </div>

                  {/* Nav links */}
                  <nav className="flex-1 p-3 space-y-1">
                    {NAV_ITEMS.map(item => {
                      const authRequired = item.url !== '/';
                      if (authRequired && !user) return null;
                      return (
                        <button
                          key={item.url}
                          onClick={() => { navigate(item.url); setOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                            isActive(item.url)
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.title}
                        </button>
                      );
                    })}
                  </nav>

                  {/* User section */}
                  <div className="p-4 border-t border-border">
                    {user ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="w-3.5 h-3.5" />
                          <span className="truncate">{user.email?.split('@')[0]}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { signOut(); setOpen(false); }} className="w-full gap-1.5 text-xs">
                          <LogOut className="w-3.5 h-3.5" /> Logout
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => { navigate('/auth'); setOpen(false); }} className="w-full gap-1.5 text-xs">
                        <LogIn className="w-3.5 h-3.5" /> Login
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <div className="relative">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg glow-primary">
                  <LineChart className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-bullish rounded-full animate-pulse" />
              </div>
              <div className="hidden xs:block">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight leading-tight">
                  <span className="text-gradient-primary">CryptoScanner</span>
                  <span className="text-primary ml-1 text-[10px] sm:text-xs font-bold">PRO</span>
                </h1>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:block">Real-time market intelligence</p>
              </div>
            </div>
          </div>

          {/* Center: Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const authRequired = item.url !== '/';
              if (authRequired && !user) return null;
              return (
                <button
                  key={item.url}
                  onClick={() => navigate(item.url)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                    isActive(item.url)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{item.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Status + Auth + Alerts */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {user && <AlertsPanel />}

            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 text-[10px]">
              <Zap className="w-3 h-3 text-primary" />
              <span className="text-muted-foreground">Binance</span>
            </div>

            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-bullish/10 text-[10px] text-bullish">
              <Activity className="w-3 h-3" />
              <span className="font-medium">Live</span>
            </div>

            {user ? (
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground hidden md:flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {user.email?.split('@')[0]}
                </span>
                <Button variant="outline" size="sm" onClick={signOut} className="gap-1 h-7 px-2 text-[10px]">
                  <LogOut className="w-3 h-3" />
                  <span className="hidden md:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="gap-1 h-7 px-2 text-[10px]">
                <LogIn className="w-3 h-3" />
                <span className="hidden sm:inline">Login</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
