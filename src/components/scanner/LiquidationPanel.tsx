import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ChevronDown, Flame, Loader2, Magnet, Maximize2, TriangleAlert } from 'lucide-react';
import { Timeframe } from '@/types/scanner';
import { fetchKlines } from '@/lib/binance';
import { fetchPositioning, PositioningData } from '@/lib/liquidation-engine';

interface LiquidationPanelProps {
  symbol: string;
  timeframe: Timeframe;
  livePrice?: number;
}

const verdictStyles: Record<string, string> = {
  crowded_longs: 'bg-bearish/10 text-bearish border-bearish/30',
  long_squeeze_risk: 'bg-bearish/10 text-bearish border-bearish/30',
  crowded_shorts: 'bg-bullish/10 text-bullish border-bullish/30',
  short_squeeze_fuel: 'bg-bullish/10 text-bullish border-bullish/30',
  healthy_trend: 'bg-primary/10 text-primary border-primary/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

const verdictLabel: Record<string, string> = {
  crowded_longs: 'Crowded longs',
  long_squeeze_risk: 'Long squeeze risk',
  crowded_shorts: 'Crowded shorts',
  short_squeeze_fuel: 'Short squeeze fuel',
  healthy_trend: 'Healthy trend',
  neutral: 'Neutral positioning',
};

function Stat({ label, value, tone, big }: { label: string; value: string; tone?: 'good' | 'bad'; big?: boolean }) {
  return (
    <div className={cn('rounded-lg bg-muted/40 text-center', big ? 'p-3' : 'p-2')}>
      <p className={cn('uppercase tracking-wide text-muted-foreground', big ? 'text-[11px]' : 'text-[9px]')}>{label}</p>
      <p
        className={cn(
          'font-mono font-semibold',
          big ? 'text-base' : 'text-xs',
          tone === 'good' && 'text-bullish',
          tone === 'bad' && 'text-bearish'
        )}
      >
        {value}
      </p>
    </div>
  );
}

const fmtPrice = (v: number) => (v >= 1 ? v.toFixed(4) : v.toPrecision(4));
const fmtPct = (v: number | null, digits = 2) => (v == null ? 'N/A' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`);

export function LiquidationPanel({ symbol, timeframe, livePrice }: LiquidationPanelProps) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PositioningData | null>(null);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const candles = await fetchKlines(symbol, timeframe, 300).catch(() => []);
      const pos = await fetchPositioning(symbol, candles, livePrice);
      setData(pos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Positioning load failed');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !data && !loading) load();
  };

  const openFullscreen = () => {
    setFullscreen(true);
    if (!data && !loading) load();
  };

  const longClusters = (data?.clusters ?? []).filter(c => c.side === 'long').sort((a, b) => b.price - a.price);
  const shortClusters = (data?.clusters ?? []).filter(c => c.side === 'short').sort((a, b) => a.price - b.price);

  const body = (big = false) => (
    <div className={cn('space-y-3', big && 'space-y-5')}>
      {loading && (
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Fetching funding, open interest and leverage clusters…
        </p>
      )}
      {error && <p className="text-[11px] text-bearish">{error}</p>}

      {data && !loading && (
        <>
          {/* Positioning stats */}
          <div className={cn('grid gap-1.5', big ? 'grid-cols-3 gap-2 sm:grid-cols-5' : 'grid-cols-3')}>
            <Stat
              big={big}
              label="Funding"
              value={data.fundingRate != null ? `${(data.fundingRate * 100).toFixed(4)}%` : 'N/A'}
              tone={data.fundingRate == null ? undefined : data.fundingRate > 0.0005 ? 'bad' : data.fundingRate < -0.0002 ? 'good' : undefined}
            />
            <Stat big={big} label="Funding APR" value={data.fundingAnnualPct != null ? `${data.fundingAnnualPct.toFixed(0)}%` : 'N/A'} />
            <Stat big={big} label="OI 1h" value={fmtPct(data.oiChange1h)} tone={data.oiChange1h == null ? undefined : data.oiChange1h >= 0 ? 'good' : 'bad'} />
            <Stat big={big} label="OI 4h" value={fmtPct(data.oiChange4h)} />
            <Stat big={big} label="OI 24h" value={fmtPct(data.oiChange24h)} />
            <Stat big={big} label="Taker B/S" value={data.takerBuySellRatio != null ? data.takerBuySellRatio.toFixed(2) : 'N/A'} tone={data.takerBuySellRatio == null ? undefined : data.takerBuySellRatio >= 1 ? 'good' : 'bad'} />
            <Stat big={big} label="Top trader L/S" value={data.topTraderLongShort != null ? data.topTraderLongShort.toFixed(2) : 'N/A'} />
            <Stat big={big} label="24h price" value={fmtPct(data.priceChange24h)} tone={(data.priceChange24h ?? 0) >= 0 ? 'good' : 'bad'} />
            <Stat big={big} label="Bias score" value={`${data.biasScore >= 0 ? '+' : ''}${data.biasScore}`} tone={data.biasScore >= 0 ? 'good' : 'bad'} />
          </div>

          <p className={cn('leading-relaxed text-muted-foreground', big ? 'text-sm' : 'text-[11px]')}>{data.verdictNote}</p>

          {/* Leverage cluster heatmap proxy */}
          <div>
            <p className={cn('mb-1.5 flex items-center gap-1 font-semibold uppercase tracking-wide text-muted-foreground', big ? 'text-xs' : 'text-[10px]')}>
              <Flame className="w-3 h-3" />
              Leverage cluster heatmap (proxy)
            </p>

            {data.clusters.length === 0 ? (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <TriangleAlert className="w-3 h-3" />
                Clusters could not be calculated for this symbol.
              </p>
            ) : (
              <div className={cn('space-y-2', big && 'grid gap-4 sm:grid-cols-2 sm:space-y-0')}>
                {[
                  { title: 'Above price — short liquidations', rows: shortClusters, tone: 'bg-bullish' },
                  { title: 'Below price — long liquidations', rows: longClusters, tone: 'bg-bearish' },
                ].map(group => (
                  <div key={group.title}>
                    <p className={cn('mb-1 uppercase tracking-wide text-muted-foreground', big ? 'text-[10px]' : 'text-[9px]')}>{group.title}</p>
                    <div className="space-y-1">
                      {group.rows.length === 0 && (
                        <p className="text-[10px] text-muted-foreground">No significant clusters.</p>
                      )}
                      {group.rows.map((c, i) => (
                        <div key={`${c.side}-${i}`} className="flex items-center gap-2">
                          <span className={cn('shrink-0 font-mono', big ? 'w-24 text-xs' : 'w-20 text-[10px]')}>{fmtPrice(c.price)}</span>
                          <span className={cn('shrink-0 text-muted-foreground', big ? 'w-10 text-[10px]' : 'w-9 text-[9px]')}>{c.leverage}x</span>
                          <div className={cn('flex-1 overflow-hidden rounded-full bg-muted', big ? 'h-2' : 'h-1.5')}>
                            <div
                              className={cn('h-full rounded-full', group.tone)}
                              style={{ width: `${c.intensity}%`, opacity: 0.4 + (c.intensity / 100) * 0.6 }}
                            />
                          </div>
                          <span className={cn('shrink-0 text-right font-mono text-muted-foreground', big ? 'w-14 text-xs' : 'w-12 text-[10px]')}>
                            {c.distancePct >= 0 ? '+' : ''}{c.distancePct.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.magnet && (
              <p className={cn('mt-1.5 flex items-start gap-1.5 leading-relaxed text-muted-foreground', big ? 'text-sm' : 'text-[11px]')}>
                <Magnet className="mt-0.5 w-3 h-3 shrink-0 text-primary" />
                Nearest magnet: {fmtPrice(data.magnet.price)} ({data.magnet.leverage}x {data.magnet.side} liquidations,
                {' '}intensity {data.magnet.intensity}, {data.magnet.distancePct >= 0 ? '+' : ''}{data.magnet.distancePct.toFixed(2)}%)
              </p>
            )}
          </div>

          {/* Funding / OI divergence signals */}
          {data.signals.length > 0 && (
            <div>
              <p className={cn('mb-1.5 font-semibold uppercase tracking-wide text-muted-foreground', big ? 'text-xs' : 'text-[10px]')}>
                Funding / OI-delta divergence signals
              </p>
              <ul className="space-y-1.5">
                {data.signals.map(s => (
                  <li key={s.key} className={cn('leading-relaxed text-muted-foreground', big ? 'text-sm' : 'text-[11px]')}>
                    <span
                      className={cn(
                        'mr-1.5 rounded border px-1 py-0.5 font-medium',
                        big ? 'text-[10px]' : 'text-[9px]',
                        s.bias === 'long'
                          ? 'bg-bullish/10 text-bullish border-bullish/30'
                          : s.bias === 'short'
                          ? 'bg-bearish/10 text-bearish border-bearish/30'
                          : 'bg-muted text-muted-foreground border-border'
                      )}
                    >
                      {s.label}
                    </span>
                    {s.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="rounded-lg border border-border/60 bg-background/40">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="flex-1 h-8 justify-between px-2 text-[11px] font-semibold"
        >
          <span className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" />
            Liquidation &amp; Positioning
            {data && (
              <span className={cn('rounded border px-1 py-0.5 text-[9px] font-medium', verdictStyles[data.verdict])}>
                {verdictLabel[data.verdict]}
              </span>
            )}
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
        </Button>
        <button
          onClick={openFullscreen}
          title="Open fullscreen"
          aria-label="Open liquidation and positioning fullscreen"
          className="mr-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && <div className="border-t border-border/60 p-2.5">{body(false)}</div>}

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 left-0 top-0 grid-rows-[auto_1fr] overflow-hidden rounded-none p-4 sm:p-6 sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
              <Flame className="w-4 h-4" />
              {symbol.replace('USDT', '')}/USDT — Liquidation &amp; Positioning
              <span className="text-xs font-normal text-muted-foreground">{timeframe}</span>
              {data && (
                <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium', verdictStyles[data.verdict])}>
                  {verdictLabel[data.verdict]}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto pr-1">{body(true)}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
