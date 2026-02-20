import { Candle, ScanCondition, ScanResult, FEATURES } from '@/types/scanner';
import * as indicators from './indicators';
import * as patterns from './patterns';
import * as smc from './smc';

interface IndicatorValues {
  [key: string]: number | boolean | string | number[];
}

export function calculateAllIndicators(candles: Candle[], condition?: ScanCondition): IndicatorValues {
  const values: IndicatorValues = {};
  const lastIndex = candles.length - 1;
  
  // Technical Indicators
  const rsi = indicators.calculateRSI(candles);
  values.rsi = rsi[lastIndex];
  values.rsi_array = rsi;
  
  const ema20 = indicators.calculateEMA(candles, 20);
  const ema50 = indicators.calculateEMA(candles, 50);
  const ema200 = indicators.calculateEMA(candles, 200);
  values.ema_20 = ema20[lastIndex];
  values.ema_50 = ema50[lastIndex];
  values.ema_200 = ema200[lastIndex];
  values.ema_20_array = ema20;
  values.ema_50_array = ema50;
  values.ema_200_array = ema200;
  
  // Calculate custom EMA periods based on condition
  if (condition?.emaConfigs) {
    for (const config of condition.emaConfigs) {
      if (config.enabled) {
        const ema = indicators.calculateEMA(candles, config.period);
        values[`ema_${config.period}`] = ema[lastIndex];
        values[`ema_${config.period}_array`] = ema;
      }
    }
  }
  
  // Calculate crossover EMAs
  if (condition?.emaCrossover && condition.emaCrossoverFast && condition.emaCrossoverSlow) {
    const fastEMA = indicators.calculateEMA(candles, condition.emaCrossoverFast);
    const slowEMA = indicators.calculateEMA(candles, condition.emaCrossoverSlow);
    values[`ema_${condition.emaCrossoverFast}`] = fastEMA[lastIndex];
    values[`ema_${condition.emaCrossoverSlow}`] = slowEMA[lastIndex];
    values[`ema_${condition.emaCrossoverFast}_array`] = fastEMA;
    values[`ema_${condition.emaCrossoverSlow}_array`] = slowEMA;
  }
  
  const sma20 = indicators.calculateSMA(candles, 20);
  const sma50 = indicators.calculateSMA(candles, 50);
  values.sma_20 = sma20[lastIndex];
  values.sma_50 = sma50[lastIndex];
  values.sma_20_array = sma20;
  values.sma_50_array = sma50;
  
  const macd = indicators.calculateMACD(candles);
  values.macd_line = macd.macdLine[lastIndex];
  values.macd_signal = macd.signalLine[lastIndex];
  values.macd_histogram = macd.histogram[lastIndex];
  values.macd_line_array = macd.macdLine;
  values.macd_signal_array = macd.signalLine;
  values.macd_histogram_array = macd.histogram;
  
  const bb = indicators.calculateBollingerBands(candles);
  values.bb_upper = bb.upper[lastIndex];
  values.bb_lower = bb.lower[lastIndex];
  values.bb_basis = bb.middle[lastIndex];
  values.bb_bandwidth = bb.bandwidth[lastIndex];
  
  const stoch = indicators.calculateStochastic(candles);
  values.stoch_k = stoch.k[lastIndex];
  values.stoch_d = stoch.d[lastIndex];
  values.stoch_k_array = stoch.k;
  values.stoch_d_array = stoch.d;
  
  const adx = indicators.calculateADX(candles);
  values.adx = adx[lastIndex];
  
  const cci = indicators.calculateCCI(candles);
  values.cci = cci[lastIndex];

  const atr = indicators.calculateATR(candles);
  values.atr = atr[lastIndex];

  const vwap = indicators.calculateVWAP(candles);
  values.vwap = vwap[lastIndex];

  const mfi = indicators.calculateMFI(candles);
  values.mfi = mfi[lastIndex];

  const williamsR = indicators.calculateWilliamsR(candles);
  values.williams_r = williamsR[lastIndex];

  const roc = indicators.calculateROC(candles);
  values.roc = roc[lastIndex];

  const psar = indicators.calculateParabolicSAR(candles);
  values.psar = psar[lastIndex];

  // Current price
  values.price = candles[lastIndex].close;
  values.prev_price = lastIndex > 0 ? candles[lastIndex - 1].close : candles[lastIndex].close;

  // Price action for crosses
  values.price_vs_ema20 = candles[lastIndex].close > ema20[lastIndex] ? 'above' : 'below';
  values.price_vs_sma20 = candles[lastIndex].close > sma20[lastIndex] ? 'above' : 'below';
  values.price_vs_bb_upper = candles[lastIndex].close > bb.upper[lastIndex] ? 'above' : 'below';
  values.price_vs_bb_lower = candles[lastIndex].close > bb.lower[lastIndex] ? 'above' : 'below';
  values.price_vs_vwap = candles[lastIndex].close > vwap[lastIndex] ? 'above' : 'below';
  values.price_vs_psar = candles[lastIndex].close > psar[lastIndex] ? 'above' : 'below';

  // Cross detection (compare current vs previous)
  if (lastIndex > 0) {
    // MACD Cross Detection
    const macdCrossedAbove = macd.macdLine[lastIndex] > macd.signalLine[lastIndex] &&
                              macd.macdLine[lastIndex - 1] <= macd.signalLine[lastIndex - 1];
    const macdCrossedBelow = macd.macdLine[lastIndex] < macd.signalLine[lastIndex] &&
                              macd.macdLine[lastIndex - 1] >= macd.signalLine[lastIndex - 1];
    values.macd_cross = macdCrossedAbove ? 'bullish' : macdCrossedBelow ? 'bearish' : 'none';

    // Stochastic Cross Detection
    const stochCrossedAbove = stoch.k[lastIndex] > stoch.d[lastIndex] &&
                               stoch.k[lastIndex - 1] <= stoch.d[lastIndex - 1];
    const stochCrossedBelow = stoch.k[lastIndex] < stoch.d[lastIndex] &&
                               stoch.k[lastIndex - 1] >= stoch.d[lastIndex - 1];
    values.stoch_cross = stochCrossedAbove ? 'bullish' : stochCrossedBelow ? 'bearish' : 'none';

    // Price crossed above/below indicators
    const prevPrice = candles[lastIndex - 1].close;
    const currPrice = candles[lastIndex].close;

    values.price_cross_vwap = (currPrice > vwap[lastIndex] && prevPrice <= vwap[lastIndex - 1]) ? 'bullish' :
                               (currPrice < vwap[lastIndex] && prevPrice >= vwap[lastIndex - 1]) ? 'bearish' : 'none';

    values.price_cross_psar = (currPrice > psar[lastIndex] && prevPrice <= psar[lastIndex - 1]) ? 'bullish' :
                               (currPrice < psar[lastIndex] && prevPrice >= psar[lastIndex - 1]) ? 'bearish' : 'none';

    values.price_cross_bb_upper = (currPrice > bb.upper[lastIndex] && prevPrice <= bb.upper[lastIndex - 1]) ? 'bullish' :
                                   (currPrice < bb.upper[lastIndex] && prevPrice >= bb.upper[lastIndex - 1]) ? 'bearish' : 'none';

    values.price_cross_bb_lower = (currPrice > bb.lower[lastIndex] && prevPrice <= bb.lower[lastIndex - 1]) ? 'bullish' :
                                   (currPrice < bb.lower[lastIndex] && prevPrice >= bb.lower[lastIndex - 1]) ? 'bearish' : 'none';
  }

  // Candlestick Patterns
  values.doji = patterns.detectDoji(candles);
  values.hammer = patterns.detectHammer(candles);
  values.shooting_star = patterns.detectShootingStar(candles);
  values.bullish_engulfing = patterns.detectBullishEngulfing(candles);
  values.bearish_engulfing = patterns.detectBearishEngulfing(candles);
  values.morning_star = patterns.detectMorningStar(candles);
  values.evening_star = patterns.detectEveningStar(candles);
  values.marubozu = patterns.detectMarubozu(candles);
  values.bullish_harami = patterns.detectBullishHarami(candles);
  values.bearish_harami = patterns.detectBearishHarami(candles);
  values.inverted_hammer = patterns.detectInvertedHammer(candles);
  values.three_white_soldiers = patterns.detectThreeWhiteSoldiers(candles);
  values.three_black_crows = patterns.detectThreeBlackCrows(candles);
  values.inside_bar = patterns.detectInsideBar(candles);
  values.spinning_top = patterns.detectSpinningTop(candles);
  
  // SMC Concepts
  values.bos_bullish = smc.detectBullishBOS(candles);
  values.bos_bearish = smc.detectBearishBOS(candles);
  values.choch_bullish = smc.detectBullishChoCH(candles);
  values.choch_bearish = smc.detectBearishChoCH(candles);
  values.bullish_ob = smc.detectBullishOrderBlock(candles);
  values.bearish_ob = smc.detectBearishOrderBlock(candles);
  values.bullish_fvg = smc.detectBullishFVG(candles);
  values.bearish_fvg = smc.detectBearishFVG(candles);
  values.liquidity_sweep_high = smc.detectLiquiditySweepHigh(candles);
  values.liquidity_sweep_low = smc.detectLiquiditySweepLow(candles);
  values.equal_highs = smc.detectEqualHighs(candles);
  values.equal_lows = smc.detectEqualLows(candles);
  values.premium_zone = smc.detectPremiumZone(candles);
  values.discount_zone = smc.detectDiscountZone(candles);
  values.breaker_block = smc.detectBreakerBlock(candles);
  
  return values;
}

// Helper function to detect EMA crossover
function detectCrossover(
  fastArray: number[],
  slowArray: number[],
  lastIndex: number
): 'bullish' | 'bearish' | 'none' {
  if (lastIndex < 1) return 'none';

  const fastCurr = fastArray[lastIndex];
  const fastPrev = fastArray[lastIndex - 1];
  const slowCurr = slowArray[lastIndex];
  const slowPrev = slowArray[lastIndex - 1];

  if (fastCurr > slowCurr && fastPrev <= slowPrev) return 'bullish';
  if (fastCurr < slowCurr && fastPrev >= slowPrev) return 'bearish';
  return 'none';
}

function evaluateCondition(
  condition: ScanCondition,
  values: IndicatorValues,
  candles: Candle[]
): { matched: boolean; reason: string } {
  const feature = FEATURES.find(f => f.id === condition.feature);
  if (!feature) return { matched: false, reason: '' };

  const lastIndex = candles.length - 1;
  const price = candles[lastIndex].close;

  // Handle different settings types
  switch (feature.settingsType) {
    case 'rsi': {
      const rsiValue = values.rsi;
      if (typeof rsiValue !== 'number' || isNaN(rsiValue)) return { matched: false, reason: '' };

      // Range check
      const minVal = condition.minValue ?? 0;
      const maxVal = condition.maxValue ?? 100;
      const inRange = rsiValue >= minVal && rsiValue <= maxVal;

      if (inRange) {
        return { matched: true, reason: `RSI = ${rsiValue.toFixed(2)} (Range: ${minVal}-${maxVal})` };
      }
      return { matched: false, reason: '' };
    }

    case 'ema': {
      const reasons: string[] = [];
      let allMatched = true;

      // Check EMA configs (price position relative to each EMA)
      if (condition.emaConfigs && condition.emaConfigs.length > 0) {
        for (const config of condition.emaConfigs) {
          if (!config.enabled) continue;

          const emaValue = values[`ema_${config.period}`];
          if (typeof emaValue !== 'number' || isNaN(emaValue)) {
            allMatched = false;
            continue;
          }

          if (config.pricePosition === 'above') {
            if (price > emaValue) {
              reasons.push(`Price > EMA${config.period} (${emaValue.toFixed(2)})`);
            } else {
              allMatched = false;
            }
          } else if (config.pricePosition === 'below') {
            if (price < emaValue) {
              reasons.push(`Price < EMA${config.period} (${emaValue.toFixed(2)})`);
            } else {
              allMatched = false;
            }
          } else {
            // No position requirement, just show the value
            reasons.push(`EMA${config.period} = ${emaValue.toFixed(2)}`);
          }
        }
      }

      // Check EMA crossover
      if (condition.emaCrossover && condition.emaCrossoverFast && condition.emaCrossoverSlow) {
        const fastArray = values[`ema_${condition.emaCrossoverFast}_array`] as number[];
        const slowArray = values[`ema_${condition.emaCrossoverSlow}_array`] as number[];

        if (Array.isArray(fastArray) && Array.isArray(slowArray)) {
          const cross = detectCrossover(fastArray, slowArray, lastIndex);

          if (condition.crossType === 'crossover' && cross === 'bullish') {
            reasons.push(`EMA${condition.emaCrossoverFast} crossed above EMA${condition.emaCrossoverSlow}`);
          } else if (condition.crossType === 'crossunder' && cross === 'bearish') {
            reasons.push(`EMA${condition.emaCrossoverFast} crossed below EMA${condition.emaCrossoverSlow}`);
          } else {
            allMatched = false;
          }
        } else {
          allMatched = false;
        }
      }

      if (reasons.length > 0 && allMatched) {
        return { matched: true, reason: reasons.join(', ') };
      }
      return { matched: false, reason: '' };
    }

    case 'macd': {
      const macdCross = values.macd_cross as string;
      const histogram = values.macd_histogram as number;

      // Check crossover
      if (condition.crossType === 'crossover') {
        if (macdCross !== 'bullish') return { matched: false, reason: '' };
      } else if (condition.crossType === 'crossunder') {
        if (macdCross !== 'bearish') return { matched: false, reason: '' };
      }

      // Check histogram filter if set
      if (condition.operator && condition.compareValue !== undefined) {
        let histMatch = false;
        switch (condition.operator) {
          case '>': histMatch = histogram > condition.compareValue; break;
          case '<': histMatch = histogram < condition.compareValue; break;
          case '>=': histMatch = histogram >= condition.compareValue; break;
          case '<=': histMatch = histogram <= condition.compareValue; break;
          default: histMatch = true;
        }
        if (!histMatch) return { matched: false, reason: '' };
      }

      const direction = condition.crossType === 'crossover' ? 'Bullish' : 'Bearish';
      return { matched: true, reason: `MACD ${direction} Cross (Hist: ${histogram.toFixed(4)})` };
    }

    case 'bollinger': {
      const bbUpper = values.bb_upper as number;
      const bbLower = values.bb_lower as number;
      const bbBasis = values.bb_basis as number;

      if (condition.pricePosition === 'above') {
        // Price above upper band
        if (condition.crossType === 'crossover') {
          if (values.price_cross_bb_upper === 'bullish') {
            return { matched: true, reason: `Price crossed above BB Upper (${bbUpper.toFixed(2)})` };
          }
        } else {
          if (price > bbUpper) {
            return { matched: true, reason: `Price above BB Upper (${bbUpper.toFixed(2)})` };
          }
        }
      } else if (condition.pricePosition === 'below') {
        // Price below lower band
        if (condition.crossType === 'crossunder') {
          if (values.price_cross_bb_lower === 'bearish') {
            return { matched: true, reason: `Price crossed below BB Lower (${bbLower.toFixed(2)})` };
          }
        } else {
          if (price < bbLower) {
            return { matched: true, reason: `Price below BB Lower (${bbLower.toFixed(2)})` };
          }
        }
      }
      return { matched: false, reason: '' };
    }

    case 'stochastic': {
      const stochK = values.stoch_k as number;
      const stochD = values.stoch_d as number;
      const stochCross = values.stoch_cross as string;

      if (typeof stochK !== 'number' || isNaN(stochK)) return { matched: false, reason: '' };

      if (condition.mode === 'range') {
        // Check if K is in oversold/overbought zone
        const overbought = condition.stochOverbought ?? 80;
        const oversold = condition.stochOversold ?? 20;

        if (stochK >= overbought) {
          return { matched: true, reason: `Stochastic K = ${stochK.toFixed(2)} (Overbought > ${overbought})` };
        }
        if (stochK <= oversold) {
          return { matched: true, reason: `Stochastic K = ${stochK.toFixed(2)} (Oversold < ${oversold})` };
        }
      } else if (condition.mode === 'cross') {
        if (condition.crossType === 'crossover' && stochCross === 'bullish') {
          return { matched: true, reason: `Stochastic K crossed above D (${stochK.toFixed(2)})` };
        }
        if (condition.crossType === 'crossunder' && stochCross === 'bearish') {
          return { matched: true, reason: `Stochastic K crossed below D (${stochK.toFixed(2)})` };
        }
      }
      return { matched: false, reason: '' };
    }

    case 'oscillator': {
      // ADX, CCI, ATR, MFI, Williams %R, ROC
      const value = values[condition.feature];
      if (typeof value !== 'number' || isNaN(value)) return { matched: false, reason: '' };

      if (condition.mode === 'range') {
        const minVal = condition.minValue ?? 0;
        const maxVal = condition.maxValue ?? 100;
        if (value >= minVal && value <= maxVal) {
          return { matched: true, reason: `${feature.name} = ${value.toFixed(2)} (Range: ${minVal}-${maxVal})` };
        }
      } else if (condition.mode === 'comparison') {
        let matched = false;
        switch (condition.operator) {
          case '>': matched = value > (condition.compareValue ?? 0); break;
          case '<': matched = value < (condition.compareValue ?? 0); break;
          case '=': matched = Math.abs(value - (condition.compareValue ?? 0)) < 0.01; break;
          case '>=': matched = value >= (condition.compareValue ?? 0); break;
          case '<=': matched = value <= (condition.compareValue ?? 0); break;
        }
        if (matched) {
          return { matched: true, reason: `${feature.name} = ${value.toFixed(2)} (${condition.operator} ${condition.compareValue ?? 0})` };
        }
      }
      return { matched: false, reason: '' };
    }

    case 'price-cross': {
      // VWAP, Parabolic SAR
      const indicatorValue = values[condition.feature];
      if (typeof indicatorValue !== 'number' || isNaN(indicatorValue)) return { matched: false, reason: '' };

      const crossKey = condition.feature === 'vwap' ? 'price_cross_vwap' : 'price_cross_psar';
      const posKey = condition.feature === 'vwap' ? 'price_vs_vwap' : 'price_vs_psar';

      if (condition.crossType === 'crossover') {
        if (values[crossKey] === 'bullish') {
          return { matched: true, reason: `Price crossed above ${feature.name} (${indicatorValue.toFixed(2)})` };
        }
      } else if (condition.crossType === 'crossunder') {
        if (values[crossKey] === 'bearish') {
          return { matched: true, reason: `Price crossed below ${feature.name} (${indicatorValue.toFixed(2)})` };
        }
      } else if (condition.pricePosition === 'above') {
        if (values[posKey] === 'above') {
          return { matched: true, reason: `Price above ${feature.name} (${indicatorValue.toFixed(2)})` };
        }
      } else if (condition.pricePosition === 'below') {
        if (values[posKey] === 'below') {
          return { matched: true, reason: `Price below ${feature.name} (${indicatorValue.toFixed(2)})` };
        }
      }
      return { matched: false, reason: '' };
    }

    case 'pattern':
    case 'smc': {
      // Boolean patterns
      const value = values[condition.feature];
      if (value === true) {
        return { matched: true, reason: `${feature.name} detected` };
      }
      return { matched: false, reason: '' };
    }

    default:
      // Fallback for unknown types
      const value = values[condition.feature];
      if (typeof value === 'boolean' && value === true) {
        return { matched: true, reason: `${feature.name} detected` };
      }
      if (typeof value === 'number' && !isNaN(value)) {
        return { matched: true, reason: `${feature.name} = ${value.toFixed(2)}` };
      }
      return { matched: false, reason: '' };
  }
}

export function evaluateConditions(
  conditions: ScanCondition[],
  values: IndicatorValues,
  candles: Candle[]
): { matched: boolean; reasons: string[] } {
  const enabledConditions = conditions.filter(c => c.enabled);

  if (enabledConditions.length === 0) {
    return { matched: false, reasons: [] };
  }

  const reasons: string[] = [];
  let allMatched = true;

  for (const condition of enabledConditions) {
    const result = evaluateCondition(condition, values, candles);
    if (result.matched) {
      reasons.push(result.reason);
    } else {
      allMatched = false;
    }
  }

  // All enabled conditions must match
  return { matched: allMatched && reasons.length > 0, reasons };
}

export function determineBullishness(values: IndicatorValues): boolean {
  let bullishScore = 0;
  let bearishScore = 0;
  
  // RSI
  if (typeof values.rsi === 'number') {
    if (values.rsi < 30) bullishScore++;
    if (values.rsi > 70) bearishScore++;
  }
  
  // Price vs EMA
  if (values.price_vs_ema20 === 'above') bullishScore++;
  else bearishScore++;
  
  // MACD
  if (typeof values.macd_histogram === 'number') {
    if (values.macd_histogram > 0) bullishScore++;
    else bearishScore++;
  }
  
  // Patterns
  if (values.hammer || values.bullish_engulfing || values.morning_star) bullishScore += 2;
  if (values.shooting_star || values.bearish_engulfing || values.evening_star) bearishScore += 2;
  
  // SMC
  if (values.bos_bullish || values.choch_bullish || values.bullish_ob) bullishScore++;
  if (values.bos_bearish || values.choch_bearish || values.bearish_ob) bearishScore++;
  
  return bullishScore >= bearishScore;
}
