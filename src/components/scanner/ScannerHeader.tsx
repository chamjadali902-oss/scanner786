import { Activity, Zap, LineChart, LogIn, LogOut, User, Brain, BarChart3, Beaker, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { AlertsPanel } from './AlertsPanel';

export function ScannerHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg glow-primary">
                <LineChart className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-bullish rounded-full animate-pulse-glow" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-extrabold tracking-tight">
                <span className="text-gradient-primary">CryptoScanner</span>
                <span className="text-primary ml-1 text-xs sm:text-sm font-bold">PRO</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Real-time market intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {user && (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/chat')} className="gap-1.5 h-7 sm:h-8 px-2 sm:px-3 text-xs">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">AI Chat</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-1.5 h-7 sm:h-8 px-2 sm:px-3 text-xs">
                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/backtest')} className="gap-1.5 h-7 sm:h-8 px-2 sm:px-3 text-xs">
                  <Beaker className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Backtest</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')} className="gap-1.5 h-7 sm:h-8 px-2 sm:px-3 text-xs">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Market</span>
                </Button>
                <AlertsPanel />
              </>
            )}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-xs">
              <Zap className="w-3 h-3 text-primary" />
              <span className="text-muted-foreground">Powered by</span>
              <span className="font-medium">Binance API</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-bullish/10 text-[10px] sm:text-xs text-bullish">
              <Activity className="w-3 h-3" />
              <span className="font-medium">Live</span>
            </div>

            {user ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-xs text-muted-foreground hidden md:flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {user.email?.split('@')[0]}
                </span>
                <Button variant="outline" size="sm" onClick={signOut} className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs">
                  <LogOut className="w-3 h-3" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs">
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
