import { Candle, ScanCondition, Timeframe } from '@/types/scanner';
import { calculateAllIndicators, evaluateConditions, determineBullishness } from './scanner';

export interface BacktestConfig {
  conditions: ScanCondition[];
  entryMode: 'long' | 'short' | 'auto'; // auto = bullish->long, bearish->short
  takeProfitPercent: number;
  stopLossPercent: number;
  positionSizePercent: number; // % of capital per trade
  initialCapital: number;
}

export interface BacktestTrade {
  entryIndex: number;
  exitIndex: number;
  entryPrice: number;
  exitPrice: number;
  side: 'long' | 'short';
  pnl: number;
  pnlPercent: number;
  exitReason: 'tp' | 'sl' | 'end';
  entryTime: number;
  exitTime: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  equityCurve: { time: number; equity: number; drawdown: number }[];
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldingBars: number;
  finalEquity: number;
}

export function runBacktest(
  candles: Candle[],
  config: BacktestConfig
): BacktestResult {
  const trades: BacktestTrade[] = [];
  let capital = config.initialCapital;
  let peakCapital = capital;
  const equityCurve: { time: number; equity: number; drawdown: number }[] = [];
  
  let inPosition = false;
  let entryIndex = 0;
  let entryPrice = 0;
  let side: 'long' | 'short' = 'long';
  let positionSize = 0;

  const enabledConditions = config.conditions.filter(c => c.enabled);
  if (enabledConditions.length === 0) {
    return emptyResult(config.initialCapital);
  }

  // Need at least 50 candles for indicators to stabilize
  const startIndex = Math.min(50, Math.floor(candles.length * 0.3));

  for (let i = startIndex; i < candles.length; i++) {
    const slice = candles.slice(0, i + 1);
    
    // Record equity
    let currentEquity = capital;
    if (inPosition) {
      const unrealizedPnl = side === 'long'
        ? (candles[i].close - entryPrice) * positionSize
        : (entryPrice - candles[i].close) * positionSize;
      currentEquity = capital + unrealizedPnl;
    }
    peakCapital = Math.max(peakCapital, currentEquity);
    const drawdown = peakCapital > 0 ? ((peakCapital - currentEquity) / peakCapital) * 100 : 0;
    
    equityCurve.push({
      time: candles[i].closeTime,
      equity: currentEquity,
      drawdown,
    });

    if (inPosition) {
      // Check TP/SL
      const currentPrice = candles[i].close;
      const pnlPercent = side === 'long'
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100;

      let exitReason: 'tp' | 'sl' | 'end' | null = null;

      if (pnlPercent >= config.takeProfitPercent) exitReason = 'tp';
      else if (pnlPercent <= -config.stopLossPercent) exitReason = 'sl';
      else if (i === candles.length - 1) exitReason = 'end';

      if (exitReason) {
        const pnl = side === 'long'
          ? (currentPrice - entryPrice) * positionSize
          : (entryPrice - currentPrice) * positionSize;
        
        capital += pnl;
        trades.push({
          entryIndex,
          exitIndex: i,
          entryPrice,
          exitPrice: currentPrice,
          side,
          pnl,
          pnlPercent,
          exitReason,
          entryTime: candles[entryIndex].closeTime,
          exitTime: candles[i].closeTime,
        });
        inPosition = false;
      }
    } else {
      // Check for entry signal
      if (slice.length < 20) continue;
      
      let indicatorValues: Record<string, number | boolean | string | number[]> = {};
      for (const condition of enabledConditions) {
        const values = calculateAllIndicators(slice, condition);
        indicatorValues = { ...indicatorValues, ...values };
      }

      const { matched } = evaluateConditions(enabledConditions, indicatorValues, slice);

      if (matched && capital > 0) {
        inPosition = true;
        entryIndex = i;
        entryPrice = candles[i].close;
        
        if (config.entryMode === 'auto') {
          side = determineBullishness(indicatorValues) ? 'long' : 'short';
        } else {
          side = config.entryMode;
        }
        
        const positionCapital = capital * (config.positionSizePercent / 100);
        positionSize = positionCapital / entryPrice;
      }
    }
  }

  return calculateStats(trades, equityCurve, config.initialCapital, capital);
}

function calculateStats(
  trades: BacktestTrade[],
  equityCurve: { time: number; equity: number; drawdown: number }[],
  initialCapital: number,
  finalCapital: number
): BacktestResult {
  if (trades.length === 0) return emptyResult(initialCapital);

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  
  const returns = trades.map(t => t.pnlPercent / 100);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length);
  
  const maxDD = equityCurve.length > 0 ? Math.max(...equityCurve.map(e => e.drawdown)) : 0;

  return {
    trades,
    equityCurve,
    totalTrades: trades.length,
    winRate: (wins.length / trades.length) * 100,
    totalPnl: finalCapital - initialCapital,
    totalPnlPercent: ((finalCapital - initialCapital) / initialCapital) * 100,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    maxDrawdown: maxDD,
    maxDrawdownPercent: maxDD,
    sharpeRatio: stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.pnlPercent)) : 0,
    worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.pnlPercent)) : 0,
    avgHoldingBars: trades.reduce((s, t) => s + (t.exitIndex - t.entryIndex), 0) / trades.length,
    finalEquity: finalCapital,
  };
}

function emptyResult(initialCapital: number): BacktestResult {
  return {
    trades: [],
    equityCurve: [],
    totalTrades: 0,
    winRate: 0,
    totalPnl: 0,
    totalPnlPercent: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    sharpeRatio: 0,
    avgWin: 0,
    avgLoss: 0,
    bestTrade: 0,
    worstTrade: 0,
    avgHoldingBars: 0,
    finalEquity: initialCapital,
  };
}
