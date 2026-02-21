// Core types for the Crypto Scanner

export type ScanPool = 'losers' | 'gainers' | 'volume' | 'favorites';

export type Timeframe = '1m' | '3m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type ConditionMode = 'range' | 'comparison' | 'cross' | 'value';

export type ComparisonOperator = '>' | '<' | '=' | '>=' | '<=';

export type CrossType = 'crossover' | 'crossunder';

export type PricePosition = 'above' | 'below';

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
}

export interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
}

// EMA Instance for multiple EMA configurations
export interface EMAConfig {
  id: string;
  period: number;
  enabled: boolean;
  pricePosition?: PricePosition; // Price above or below this EMA
}

// Extended ScanCondition with feature-specific settings
export interface ScanCondition {
  id: string;
  feature: string;
  category: 'indicator' | 'pattern' | 'smc';
  mode: ConditionMode;
  enabled: boolean;
  
  // Range mode
  minValue?: number;
  maxValue?: number;
  
  // Comparison mode
  operator?: ComparisonOperator;
  compareValue?: number;
  
  // Cross mode
  crossType?: CrossType;
  
  // Period (for MA-based indicators)
  period?: number;
  
  // RSI-specific settings
  rsiRegularDivergence?: boolean;
  rsiHiddenDivergence?: boolean;
  
  // EMA-specific settings
  emaConfigs?: EMAConfig[];
  emaCrossover?: boolean;
  emaCrossoverFast?: number;
  emaCrossoverSlow?: number;
  
  // Stochastic settings
  stochOverbought?: number;
  stochOversold?: number;
  
  // MACD settings
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
  
  // Bollinger settings
  bbPeriod?: number;
  bbStdDev?: number;
  
  // Price position relative to indicator
  pricePosition?: PricePosition;
}

export interface ScanResult {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  matchReasons: string[];
  indicatorValues: Record<string, number | string>;
  timestamp: number;
  isBullish: boolean;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  category: 'indicator' | 'pattern' | 'smc';
  description: string;
  defaultMode: ConditionMode;
  hasPeriod?: boolean;
  defaultPeriod?: number;
  minPeriod?: number;
  maxPeriod?: number;
  valueRange?: { min: number; max: number };
  // New: defines which settings panel to show
  settingsType?: 'rsi' | 'ema' | 'macd' | 'bollinger' | 'stochastic' | 'oscillator' | 'price-cross' | 'pattern' | 'smc';
}

// All available features
export const FEATURES: FeatureDefinition[] = [
  // Category A: Technical Indicators
  { id: 'rsi', name: 'RSI', category: 'indicator', description: 'Relative Strength Index', defaultMode: 'range', valueRange: { min: 0, max: 100 }, settingsType: 'rsi' },
  { id: 'ema', name: 'EMA', category: 'indicator', description: 'Exponential Moving Average', defaultMode: 'cross', hasPeriod: true, defaultPeriod: 20, minPeriod: 5, maxPeriod: 200, settingsType: 'ema' },
  { id: 'sma', name: 'SMA', category: 'indicator', description: 'Simple Moving Average', defaultMode: 'cross', hasPeriod: true, defaultPeriod: 20, minPeriod: 5, maxPeriod: 200, settingsType: 'ema' },
  { id: 'macd_line', name: 'MACD', category: 'indicator', description: 'Moving Average Convergence Divergence', defaultMode: 'comparison', settingsType: 'macd' },
  { id: 'bb_upper', name: 'Bollinger Bands', category: 'indicator', description: 'Bollinger Bands', defaultMode: 'cross', settingsType: 'bollinger' },
  { id: 'stoch_k', name: 'Stochastic', category: 'indicator', description: 'Stochastic Oscillator', defaultMode: 'range', valueRange: { min: 0, max: 100 }, settingsType: 'stochastic' },
  { id: 'adx', name: 'ADX', category: 'indicator', description: 'Average Directional Index', defaultMode: 'range', valueRange: { min: 0, max: 100 }, settingsType: 'oscillator' },
  { id: 'cci', name: 'CCI', category: 'indicator', description: 'Commodity Channel Index', defaultMode: 'range', settingsType: 'oscillator' },
  { id: 'atr', name: 'ATR', category: 'indicator', description: 'Average True Range', defaultMode: 'comparison', settingsType: 'oscillator' },
  { id: 'vwap', name: 'VWAP', category: 'indicator', description: 'Volume Weighted Average Price', defaultMode: 'cross', settingsType: 'price-cross' },
  { id: 'mfi', name: 'MFI', category: 'indicator', description: 'Money Flow Index', defaultMode: 'range', valueRange: { min: 0, max: 100 }, settingsType: 'oscillator' },
  { id: 'williams_r', name: 'Williams %R', category: 'indicator', description: 'Williams Percent Range', defaultMode: 'range', valueRange: { min: -100, max: 0 }, settingsType: 'oscillator' },
  { id: 'roc', name: 'ROC', category: 'indicator', description: 'Rate of Change', defaultMode: 'comparison', settingsType: 'oscillator' },
  { id: 'psar', name: 'Parabolic SAR', category: 'indicator', description: 'Parabolic Stop and Reverse', defaultMode: 'cross', settingsType: 'price-cross' },

  // Category B: Price Action Patterns
  { id: 'doji', name: 'Doji', category: 'pattern', description: 'Indecision candle', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'hammer', name: 'Hammer', category: 'pattern', description: 'Bullish reversal', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'shooting_star', name: 'Shooting Star', category: 'pattern', description: 'Bearish reversal', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'bullish_engulfing', name: 'Bullish Engulfing', category: 'pattern', description: 'Bullish reversal pattern', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'bearish_engulfing', name: 'Bearish Engulfing', category: 'pattern', description: 'Bearish reversal pattern', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'morning_star', name: 'Morning Star', category: 'pattern', description: '3-candle bullish reversal', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'evening_star', name: 'Evening Star', category: 'pattern', description: '3-candle bearish reversal', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'marubozu', name: 'Marubozu', category: 'pattern', description: 'Strong momentum candle', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'bullish_harami', name: 'Bullish Harami', category: 'pattern', description: 'Bullish inside bar', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'bearish_harami', name: 'Bearish Harami', category: 'pattern', description: 'Bearish inside bar', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'inverted_hammer', name: 'Inverted Hammer', category: 'pattern', description: 'Bullish reversal', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'three_white_soldiers', name: 'Three White Soldiers', category: 'pattern', description: 'Strong bullish continuation', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'three_black_crows', name: 'Three Black Crows', category: 'pattern', description: 'Strong bearish continuation', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'inside_bar', name: 'Inside Bar', category: 'pattern', description: 'Consolidation pattern', defaultMode: 'value', settingsType: 'pattern' },
  { id: 'spinning_top', name: 'Spinning Top', category: 'pattern', description: 'Indecision pattern', defaultMode: 'value', settingsType: 'pattern' },

  // Category C: Smart Money Concepts
  { id: 'bos_bullish', name: 'Bullish BOS', category: 'smc', description: 'Break of Structure (Bullish)', defaultMode: 'value', settingsType: 'smc' },
  { id: 'bos_bearish', name: 'Bearish BOS', category: 'smc', description: 'Break of Structure (Bearish)', defaultMode: 'value', settingsType: 'smc' },
  { id: 'choch_bullish', name: 'Bullish ChoCH', category: 'smc', description: 'Change of Character (Bullish)', defaultMode: 'value', settingsType: 'smc' },
  { id: 'choch_bearish', name: 'Bearish ChoCH', category: 'smc', description: 'Change of Character (Bearish)', defaultMode: 'value', settingsType: 'smc' },
  { id: 'bullish_ob', name: 'Bullish Order Block', category: 'smc', description: 'Bullish Order Block detected', defaultMode: 'value', settingsType: 'smc' },
  { id: 'bearish_ob', name: 'Bearish Order Block', category: 'smc', description: 'Bearish Order Block detected', defaultMode: 'value', settingsType: 'smc' },
  { id: 'bullish_fvg', name: 'Bullish FVG', category: 'smc', description: 'Bullish Fair Value Gap', defaultMode: 'value', settingsType: 'smc' },
  { id: 'bearish_fvg', name: 'Bearish FVG', category: 'smc', description: 'Bearish Fair Value Gap', defaultMode: 'value', settingsType: 'smc' },
  { id: 'liquidity_sweep_high', name: 'Liquidity Sweep (High)', category: 'smc', description: 'Wick above previous high', defaultMode: 'value', settingsType: 'smc' },
  { id: 'liquidity_sweep_low', name: 'Liquidity Sweep (Low)', category: 'smc', description: 'Wick below previous low', defaultMode: 'value', settingsType: 'smc' },
  { id: 'equal_highs', name: 'Equal Highs (EQH)', category: 'smc', description: 'Double top liquidity', defaultMode: 'value', settingsType: 'smc' },
  { id: 'equal_lows', name: 'Equal Lows (EQL)', category: 'smc', description: 'Double bottom liquidity', defaultMode: 'value', settingsType: 'smc' },
  { id: 'premium_zone', name: 'Premium Zone', category: 'smc', description: 'Price > 0.5 Fib of range', defaultMode: 'value', settingsType: 'smc' },
  { id: 'discount_zone', name: 'Discount Zone', category: 'smc', description: 'Price < 0.5 Fib of range', defaultMode: 'value', settingsType: 'smc' },
  { id: 'breaker_block', name: 'Breaker Block', category: 'smc', description: 'Failed Order Block', defaultMode: 'value', settingsType: 'smc' },
  { id: 'volume_spike', name: 'Volume Spike', category: 'smc', description: 'Abnormally high volume (2x+ average)', defaultMode: 'value', settingsType: 'smc' },
];

export const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: '1m', label: '1 Minute' },
  { value: '3m', label: '3 Minutes' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
];

export const SCAN_POOL_OPTIONS: { value: ScanPool; label: string; description: string }[] = [
  { value: 'losers', label: 'Top 100 Losers', description: 'Biggest 24h price drops' },
  { value: 'gainers', label: 'Top 100 Gainers', description: 'Biggest 24h price gains' },
  { value: 'volume', label: 'Top 100 Volume', description: 'Highest 24h trading volume' },
  { value: 'favorites', label: 'My Favorites', description: 'Your saved favorite coins' },
];
