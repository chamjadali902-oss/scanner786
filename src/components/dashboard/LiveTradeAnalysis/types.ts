export interface TFData {
  tf: string;
  rsi: number;
  macd: number;
  ema20: number;
  ema50: number;
  currentPrice: number;
  trend: 'up' | 'down' | 'sideways';
  lastCandles: { open: number; high: number; low: number; close: number; volume: number }[];
}

export interface Analysis {
  decision: string;
  urgency: string;
  confidence: number;
  currentBias: string;
  shortTermOutlook: string;
  longTermOutlook: string;
  recommendation: string;
  riskLevel: string;
  slSuggestion: number | null;
  tpSuggestion: number | null;
  keyLevels: { support: number; resistance: number };
  reasons: string[];
  warning: string | null;
  // Enhanced fields
  trapWarning: string | null;
  targetAchievable: boolean;
  targetAnalysis: string;
  priceRange: {
    shortTerm: { min: number; max: number; timeframe: string };
    longTerm: { min: number; max: number; timeframe: string };
  };
  timeframeSummary: { tf: string; signal: string; strength: string }[];
  conflictingSignals: string[];
}

export const DECISION_COLOR: Record<string, string> = {
  HOLD: 'text-primary bg-primary/10 border-primary/30',
  EXIT_NOW: 'text-bearish bg-bearish/10 border-bearish/30',
  EXIT_PARTIAL: 'text-warning bg-warning/10 border-warning/30',
  ADD_POSITION: 'text-bullish bg-bullish/10 border-bullish/30',
};

export const URGENCY_COLOR: Record<string, string> = {
  HIGH: 'text-bearish border-bearish/40',
  MEDIUM: 'text-warning border-warning/40',
  LOW: 'text-muted-foreground border-border',
};
