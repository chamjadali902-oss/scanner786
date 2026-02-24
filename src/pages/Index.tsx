import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ScanPool, Timeframe, ScanCondition } from '@/types/scanner';
import { useScanner } from '@/hooks/useScanner';
import { useAuth } from '@/hooks/useAuth';
import { useStrategies } from '@/hooks/useStrategies';
import { useFavorites } from '@/hooks/useFavorites';
import { useCommunityStrategies } from '@/hooks/useCommunityStrategies';
import { AppLayout } from '@/components/AppLayout';
import { ScanPoolSelector } from '@/components/scanner/ScanPoolSelector';
import { MultiTimeframeSelector } from '@/components/scanner/MultiTimeframeSelector';
import { LogicBuilder } from '@/components/scanner/LogicBuilder';
import { ScannerStatus } from '@/components/scanner/ScannerStatus';
import { ResultCard } from '@/components/scanner/ResultCard';
import { StrategiesList } from '@/components/scanner/StrategiesList';
import { SaveStrategyDialog } from '@/components/scanner/SaveStrategyDialog';
import { PublishStrategyDialog } from '@/components/scanner/PublishStrategyDialog';
import { FavoritesList } from '@/components/scanner/FavoritesList';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, Search, Sparkles, Save, FolderOpen, Star, LogIn, Globe } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [scanPool, setScanPool] = useState<ScanPool>('losers');
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [mtfEnabled, setMtfEnabled] = useState(false);
  const [mtfTimeframes, setMtfTimeframes] = useState<Timeframe[]>(['1h', '4h']);
  const [conditions, setConditions] = useState<ScanCondition[]>([
    { id: 'rsi-default', feature: 'rsi', category: 'indicator', mode: 'range', minValue: 5, maxValue: 30, enabled: true },
  ]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showStrategies, setShowStrategies] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  const { user } = useAuth();
  const { status, results, error, progress, waitTime, scan, clearResults, isScanning } = useScanner();
  const { strategies, loading: strategiesLoading, saveStrategy, updateStrategy, deleteStrategy } = useStrategies(user?.id);
  const { favorites, loading: favoritesLoading, addFavorite, addAllFavorites, removeFavorite, removeAllFavorites, isFavorite, getFavoriteSymbols } = useFavorites(user?.id);
  const { publishStrategy } = useCommunityStrategies(user?.id);

  useEffect(() => {
    const pool = searchParams.get('pool') as ScanPool;
    const tf = searchParams.get('timeframe') as Timeframe;
    const conds = searchParams.get('conditions');
    if (pool) setScanPool(pool);
    if (tf) setTimeframe(tf);
    if (conds) {
      try { setConditions(JSON.parse(conds)); } catch {}
    }
  }, [searchParams]);

  const handleScan = () => {
    const favSymbols = scanPool === 'favorites' ? getFavoriteSymbols() : undefined;
    const mtfTfs = mtfEnabled ? mtfTimeframes : undefined;
    scan(scanPool, timeframe, conditions, favSymbols, mtfTfs);
  };

  const handleReset = () => { clearResults(); setConditions([]); };

  const handleLoadStrategy = (pool: ScanPool, tf: Timeframe, conds: ScanCondition[]) => {
    setScanPool(pool); setTimeframe(tf); setConditions(conds); setShowStrategies(false);
  };

  const handleToggleFavorite = (symbol: string) => {
    if (isFavorite(symbol)) removeFavorite(symbol); else addFavorite(symbol);
  };

  const handlePublish = (name: string, description: string, authorName: string) => {
    publishStrategy(name, description, scanPool, timeframe, conditions, authorName);
  };

  const enabledConditionsCount = conditions.filter(c => c.enabled).length;

  return (
    <AppLayout className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
      <div className="grid lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-5">
          <div className="p-3 sm:p-5 rounded-xl border border-border bg-card card-glow">
            <ScanPoolSelector value={scanPool} onChange={setScanPool} disabled={isScanning} hasFavorites={!!user && favorites.length > 0} />
          </div>
          <div className="p-3 sm:p-5 rounded-xl border border-border bg-card card-glow">
            <MultiTimeframeSelector primaryTimeframe={timeframe} onPrimaryChange={setTimeframe} mtfEnabled={mtfEnabled} onMtfToggle={setMtfEnabled} selectedTimeframes={mtfTimeframes} onTimeframesChange={setMtfTimeframes} disabled={isScanning} />
          </div>
          <div className="p-3 sm:p-5 rounded-xl border border-border bg-card card-glow">
            <LogicBuilder conditions={conditions} onChange={setConditions} disabled={isScanning} />
          </div>

          {/* Action Buttons - Desktop */}
          <div className="hidden sm:flex gap-2 flex-wrap">
            <Button onClick={user ? handleScan : () => navigate('/auth')} disabled={user ? (isScanning || enabledConditionsCount === 0) : false} className="flex-1 h-11 text-sm font-semibold scanner-pulse" size="lg">
              {!user ? <><LogIn className="w-4 h-4 mr-2" />Login to Scan</> : isScanning ? <><Search className="w-4 h-4 mr-2 animate-pulse" />Scanning...</> : <><Play className="w-4 h-4 mr-2" />Start Scan</>}
            </Button>
            {user && (
              <>
                <Button onClick={() => setShowSaveDialog(true)} disabled={isScanning || conditions.length === 0} variant="outline" size="lg" className="h-11" title="Save Strategy"><Save className="w-4 h-4" /></Button>
                <Button onClick={() => setShowPublishDialog(true)} disabled={isScanning || conditions.length === 0} variant="outline" size="lg" className="h-11" title="Publish"><Globe className="w-4 h-4" /></Button>
                <Button onClick={() => setShowStrategies(!showStrategies)} variant="outline" size="lg" className="h-11" title="Strategies"><FolderOpen className="w-4 h-4" /></Button>
                <Button onClick={() => setShowFavorites(!showFavorites)} variant="outline" size="lg" className="h-11" title="Favorites"><Star className="w-4 h-4" /></Button>
              </>
            )}
            <Button onClick={handleReset} disabled={isScanning} variant="outline" size="lg" className="h-11"><RotateCcw className="w-4 h-4" /></Button>
          </div>

          {user && showStrategies && (
            <div className="p-3 rounded-xl border border-border bg-card card-glow">
              <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><FolderOpen className="w-4 h-4 text-primary" />My Strategies</h3>
              <StrategiesList strategies={strategies} loading={strategiesLoading} onLoad={handleLoadStrategy} onUpdate={updateStrategy} onDelete={deleteStrategy} />
            </div>
          )}

          {user && showFavorites && (
            <div className="p-3 rounded-xl border border-border bg-card card-glow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold flex items-center gap-2"><Star className="w-4 h-4 text-primary" />My Favorites ({favorites.length})</h3>
                {favorites.length > 0 && (
                  <Button onClick={removeAllFavorites} variant="ghost" size="sm" className="h-6 text-[10px] text-destructive hover:text-destructive">
                    Remove All
                  </Button>
                )}
              </div>
              <FavoritesList favorites={favorites} loading={favoritesLoading} onRemove={removeFavorite} />
            </div>
          )}

          <ScannerStatus status={status} progress={progress ?? undefined} error={error ?? undefined} waitTime={waitTime} />
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm sm:text-base font-bold">Scan Results</h2>
              {mtfEnabled && <span className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-mono">MTF</span>}
            </div>
            <div className="flex items-center gap-2">
              {results.length > 0 && user && (
                <Button
                  onClick={() => addAllFavorites(results.map(r => r.symbol))}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1"
                >
                  <Star className="w-3 h-3" /> Favorite All
                </Button>
              )}
              {results.length > 0 && <span className="text-xs text-muted-foreground font-mono">{results.length} match{results.length !== 1 ? 'es' : ''}</span>}
            </div>
          </div>

          {results.length === 0 && status === 'idle' && (
            <div className="flex flex-col items-center justify-center h-[200px] sm:h-[350px] rounded-xl border border-dashed border-border bg-card/30 card-glow">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                <Search className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-muted-foreground mb-1">No Results Yet</h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground/70 text-center max-w-xs px-4">
                Configure conditions and click "Start Scan" to find matching coins.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {results.map((result) => (
                <ResultCard key={result.symbol} result={result} timeframe={timeframe} isFavorite={isFavorite(result.symbol)} onToggleFavorite={user ? handleToggleFavorite : undefined} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="sm:hidden mobile-action-bar">
        <div className="flex gap-2">
          <Button onClick={user ? handleScan : () => navigate('/auth')} disabled={user ? (isScanning || enabledConditionsCount === 0) : false} className="flex-1 h-10 text-xs font-semibold scanner-pulse">
            {!user ? <><LogIn className="w-3.5 h-3.5 mr-1" />Login</> : isScanning ? <><Search className="w-3.5 h-3.5 mr-1 animate-pulse" />Scanning...</> : <><Play className="w-3.5 h-3.5 mr-1" />Scan</>}
          </Button>
          {user && (
            <>
              <Button onClick={() => setShowSaveDialog(true)} disabled={isScanning || conditions.length === 0} variant="outline" className="h-10 w-10 p-0"><Save className="w-3.5 h-3.5" /></Button>
              <Button onClick={() => setShowStrategies(!showStrategies)} variant="outline" className="h-10 w-10 p-0"><FolderOpen className="w-3.5 h-3.5" /></Button>
              <Button onClick={() => setShowFavorites(!showFavorites)} variant="outline" className="h-10 w-10 p-0"><Star className="w-3.5 h-3.5" /></Button>
            </>
          )}
          <Button onClick={handleReset} disabled={isScanning} variant="outline" className="h-10 w-10 p-0"><RotateCcw className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      <footer className="border-t border-border mt-8 py-4 hidden sm:block">
        <div className="text-center text-[10px] text-muted-foreground">
          <p>Market data by Binance. Educational purposes only. Not financial advice.</p>
        </div>
      </footer>

      <SaveStrategyDialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)} onSave={(name, desc) => saveStrategy(name, desc, scanPool, timeframe, conditions)} onPublish={handlePublish} showPublish={!!user} />
      <PublishStrategyDialog open={showPublishDialog} onClose={() => setShowPublishDialog(false)} onPublish={handlePublish} />
    </AppLayout>
  );
};

export default Index;
