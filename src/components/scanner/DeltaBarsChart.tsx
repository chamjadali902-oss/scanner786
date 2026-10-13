import { cn } from '@/lib/utils';
import type { DeltaRangeResult } from '@/lib/delta-range';

interface Props {
  values: Record<string, unknown>;
  large?: boolean;
}

const fmt = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(2);
};

/** Per-candle buy/sell delta bars + CVD line for Range Delta setups. */
export function DeltaBarsChart({ values, large }: Props) {
  const r = (['delta_accumulation_range_result', 'delta_distribution_range_result'] as const)
    .map(k => values[k] as DeltaRangeResult | undefined)
    .find(x => x?.detected && x.bars?.length);
  if (!r) return null;

  const bars = r.bars;
  const acc = r.side === 'accumulation';
  const W = 300, H = large ? 160 : 90, mid = H * 0.62;
  const maxD = Math.max(...bars.map(b => Math.abs(b.delta)), 1e-12);
  const cvds = bars.map(b => b.cvd);
  const cMin = Math.min(...cvds), cMax = Math.max(...cvds);
  const bw = W / bars.length;
  const barH = mid * 0.9;
  const cvdY = (v: number) => (cMax === cMin ? mid / 2 : mid * 0.9 - ((v - cMin) / (cMax - cMin)) * mid * 0.8);
  const line = bars.map((b, i) => `${(i + 0.5) * bw},${cvdY(b.cvd)}`).join(' ');
  const totalBuy = bars.reduce((s, b) => s + b.buy, 0);
  const totalSell = bars.reduce((s, b) => s + b.sell, 0);
  const buyPct = (totalBuy / (totalBuy + totalSell || 1)) * 100;

  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/30 p-2" onClick={e => e.stopPropagation()}>
      <div className="mb-1 flex items-center justify-between text-[10px] sm:text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">
          {acc ? 'Range Buying Delta' : 'Range Selling Delta'} · {bars.length} candles
        </span>
        <span className={cn('font-mono font-semibold', acc ? 'text-bullish' : 'text-bearish')}>
          Net {r.cvdChange >= 0 ? '+' : ''}{fmt(r.cvdChange)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: large ? 180 : 96 }} preserveAspectRatio="none">
        <line x1={0} x2={W} y1={mid} y2={mid} className="stroke-border" strokeWidth={0.5} />
        {bars.map((b, i) => {
          const h = (Math.abs(b.delta) / maxD) * (H - mid) * 0.95;
          const pos = b.delta >= 0;
          return (
            <rect
              key={i}
              x={i * bw + bw * 0.15}
              width={bw * 0.7}
              y={pos ? mid - h : mid}
              height={Math.max(h, 0.5)}
              className={pos ? 'fill-bullish' : 'fill-bearish'}
              opacity={i === bars.length - 1 ? 1 : 0.75}
            >
              <title>{`Candle ${i + 1}: buy ${fmt(b.buy)} / sell ${fmt(b.sell)} / delta ${fmt(b.delta)}`}</title>
            </rect>
          );
        })}
        <polyline points={line} fill="none" className="stroke-primary" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>Bars = per-candle delta (buy − sell) · Line = cumulative delta</span>
        <span className="font-mono">
          Buy <span className="text-bullish">{fmt(totalBuy)}</span> / Sell <span className="text-bearish">{fmt(totalSell)}</span> ({buyPct.toFixed(0)}% buy)
        </span>
      </div>
      {large && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] sm:grid-cols-6">
          {[
            ['Range', `${r.rangeLow.toPrecision(5)} - ${r.rangeHigh.toPrecision(5)}`],
            ['Width', `${r.widthPct.toFixed(1)}%`],
            [acc ? 'Buy candles' : 'Sell candles', `${r.dominancePct.toFixed(0)}%`],
            ['CVD R²', r.cvdR2.toFixed(2)],
            ['Position', `${r.positionPct.toFixed(0)}% of range`],
            ['Score', String(r.score)],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
              <p className="font-mono font-medium">{v}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
