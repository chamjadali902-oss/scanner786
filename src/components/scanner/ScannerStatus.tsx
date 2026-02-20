import { cn } from '@/lib/utils';
import { Loader2, AlertCircle, WifiOff, RefreshCw } from 'lucide-react';

interface ScannerStatusProps {
  status: 'idle' | 'scanning' | 'error' | 'rate-limited' | 'reconnecting';
  progress?: { current: number; total: number };
  error?: string;
  waitTime?: number;
}

export function ScannerStatus({ status, progress, error, waitTime }: ScannerStatusProps) {
  if (status === 'idle') return null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg border',
        status === 'scanning' && 'border-primary/30 bg-primary/5',
        status === 'error' && 'border-destructive/30 bg-destructive/5',
        status === 'rate-limited' && 'border-warning/30 bg-warning/5',
        status === 'reconnecting' && 'border-warning/30 bg-warning/5'
      )}
    >
      {status === 'scanning' && (
        <>
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <div className="flex-1">
            <p className="font-medium text-sm">Scanning...</p>
            {progress && (
              <div className="mt-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Analyzing {progress.current} of {progress.total} coins</span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="w-5 h-5 text-destructive" />
          <div className="flex-1">
            <p className="font-medium text-sm text-destructive">Scan Error</p>
            <p className="text-xs text-muted-foreground">{error || 'An unexpected error occurred'}</p>
          </div>
        </>
      )}

      {status === 'rate-limited' && (
        <>
          <WifiOff className="w-5 h-5 text-warning" />
          <div className="flex-1">
            <p className="font-medium text-sm text-warning">Rate Limited</p>
            <p className="text-xs text-muted-foreground">
              Too many requests. Waiting {waitTime ? Math.ceil(waitTime / 1000) : 60}s before retry...
            </p>
          </div>
        </>
      )}

      {status === 'reconnecting' && (
        <>
          <RefreshCw className="w-5 h-5 animate-spin text-warning" />
          <div className="flex-1">
            <p className="font-medium text-sm text-warning">Reconnecting...</p>
            <p className="text-xs text-muted-foreground">Attempting to restore connection</p>
          </div>
        </>
      )}
    </div>
  );
}
