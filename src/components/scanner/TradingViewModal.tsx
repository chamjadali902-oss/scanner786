import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';
import { getTradingViewLink } from '@/lib/binance';
import { Timeframe } from '@/types/scanner';

interface TradingViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  timeframe: Timeframe;
}

export function TradingViewModal({ isOpen, onClose, symbol, timeframe }: TradingViewModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  const tvTimeframe = {
    '1m': '1',
    '3m': '3',
    '5m': '5',
    '15m': '15',
    '1h': '60',
    '4h': '240',
    '1d': 'D',
  }[timeframe] || '15';

  const tvSymbol = `BINANCE:${symbol}`;
  const externalUrl = getTradingViewLink(symbol, timeframe);

  const widgetConfig = {
    autosize: true,
    symbol: tvSymbol,
    interval: tvTimeframe,
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    enable_publishing: false,
    allow_symbol_change: true,
    calendar: false,
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    hide_volume: false,
    backgroundColor: "rgba(15, 23, 42, 1)",
    gridColor: "rgba(30, 41, 59, 0.5)",
  };

  const embedUrl = `https://s.tradingview.com/widgetembed/?hideideas=1&overrides=&preventMouseWheelZoom=0&studies=&theme=dark&style=1&timezone=Etc%2FUTC&locale=en&utm_source=localhost&utm_medium=widget_new&utm_campaign=chart&symbol=${encodeURIComponent(tvSymbol)}&interval=${tvTimeframe}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setIsLoading(true); } }}>
      <DialogContent 
        className="max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 bg-background border-border flex flex-col"
        aria-describedby={undefined}
      >
        <DialogHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span className="font-bold">{symbol.replace('USDT', '')}</span>
            <span className="text-muted-foreground font-normal">/USDT</span>
            <span className="text-xs text-muted-foreground ml-2 px-2 py-0.5 rounded bg-muted">
              {timeframe}
            </span>
          </DialogTitle>
          <div className="flex items-center gap-2 mr-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(externalUrl, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open on TradingView
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 p-2 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/80">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <iframe
            src={embedUrl}
            className="w-full h-full rounded-lg border-0"
            allow="autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
