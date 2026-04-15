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
  
  // Technical Indicators - use custom RSI period if set
  const rsiPeriod = condition?.rsiPeriod ?? 14;
  const rsi = indicators.calculateRSI(candles, rsiPeriod);
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
  
  // MACD with custom params
  const macdFast = condition?.macdFast ?? 12;
  const macdSlow = condition?.macdSlow ?? 26;
  const macdSignalPeriod = condition?.macdSignal ?? 9;
  const macd = indicators.calculateMACD(candles, macdFast, macdSlow, macdSignalPeriod);
  values.macd_line = macd.macdLine[lastIndex];
  values.macd_signal = macd.signalLine[lastIndex];
  values.macd_histogram = macd.histogram[lastIndex];
  values.macd_line_array = macd.macdLine;
  values.macd_signal_array = macd.signalLine;
  values.macd_histogram_array = macd.histogram;
  
  // Bollinger Bands with custom params
  const bbPeriod = condition?.bbPeriod ?? 20;
  const bbStdDev = condition?.bbStdDev ?? 2;
  const bb = indicators.calculateBollingerBands(candles, bbPeriod, bbStdDev);
  values.bb_upper = bb.upper[lastIndex];
  values.bb_lower = bb.lower[lastIndex];
  values.bb_basis = bb.middle[lastIndex];
  values.bb_bandwidth = bb.bandwidth[lastIndex];
  
  // Stochastic with custom params
  const stochKPeriod = condition?.stochKPeriod ?? 14;
  const stochDPeriod = condition?.stochDPeriod ?? 3;
  const stochSmooth = condition?.stochSmooth ?? 3;
  const stoch = indicators.calculateStochastic(candles, stochKPeriod, stochDPeriod, stochSmooth);
  values.stoch_k = stoch.k[lastIndex];
  values.stoch_d = stoch.d[lastIndex];
  values.stoch_k_array = stoch.k;
  values.stoch_d_array = stoch.d;
  
  // ADX with custom period
  const adxPeriod = condition?.adxPeriod ?? 14;
  const adx = indicators.calculateADX(candles, adxPeriod);
  values.adx = adx[lastIndex];
  values.adx_array = adx;
  
  // CCI with custom period
  const cciPeriod = condition?.cciPeriod ?? 20;
  const cci = indicators.calculateCCI(candles, cciPeriod);
  values.cci = cci[lastIndex];

  // ATR with custom period
  const atrPeriod = condition?.atrPeriod ?? 14;
  const atr = indicators.calculateATR(candles, atrPeriod);
  values.atr = atr[lastIndex];

  const vwap = indicators.calculateVWAP(candles);
  values.vwap = vwap[lastIndex];

  // MFI with custom period
  const mfiPeriod = condition?.mfiPeriod ?? 14;
  const mfi = indicators.calculateMFI(candles, mfiPeriod);
  values.mfi = mfi[lastIndex];

  // Williams %R with custom period
  const williamsRPeriod = condition?.williamsRPeriod ?? 14;
  const williamsR = indicators.calculateWilliamsR(candles, williamsRPeriod);
  values.williams_r = williamsR[lastIndex];

  // ROC with custom period
  const rocPeriod = condition?.rocPeriod ?? 12;
  const roc = indicators.calculateROC(candles, rocPeriod);
  values.roc = roc[lastIndex];

  // Parabolic SAR with custom params
  const psarStep = condition?.psarStep ?? 0.02;
  const psarMaxStep = condition?.psarMaxStep ?? 0.2;
  const psar = indicators.calculateParabolicSAR(candles, psarStep, psarMaxStep);
  values.psar = psar[lastIndex];

  // Supertrend
  const stPeriod = condition?.supertrendPeriod ?? 10;
  const stMultiplier = condition?.supertrendMultiplier ?? 3;
  const supertrend = indicators.calculateSupertrend(candles, stPeriod, stMultiplier);
  values.supertrend = supertrend.value[lastIndex];
  values.supertrend_direction = supertrend.direction[lastIndex];
  values.supertrend_prev_direction = lastIndex > 0 ? supertrend.direction[lastIndex - 1] : 0;
  values.supertrend_array = supertrend.value;
  values.supertrend_direction_array = supertrend.direction;

  // Fibonacci Retracement
  const fibLookback = condition?.fibLookback ?? 50;
  const fib = indicators.calculateFibonacciRetracement(candles, fibLookback);
  values.fib_swing_high = fib.swingHigh;
  values.fib_swing_low = fib.swingLow;
  values.fib_trend = fib.trend;
  values.fib_level_0 = fib.levels['0'];
  values.fib_level_0236 = fib.levels['0.236'];
  values.fib_level_0382 = fib.levels['0.382'];
  values.fib_level_05 = fib.levels['0.5'];
  values.fib_level_0618 = fib.levels['0.618'];
  values.fib_level_0786 = fib.levels['0.786'];
  values.fib_level_1 = fib.levels['1'];

  // Smart-Bullish (3-Candle Bottom Pattern)
  const sbLookback = condition?.smartBullishLookback ?? 30;
  const smartBullish = indicators.calculateSmartBullish(candles, sbLookback);
  values.smart_bullish = smartBullish.score;
  values.smart_bullish_pattern_found = smartBullish.patternFound;
  values.smart_bullish_signal = smartBullish.signal;
  values.smart_bullish_entry = smartBullish.entryPrice;
  values.smart_bullish_sl = smartBullish.stopLoss;
  values.smart_bullish_tp1 = smartBullish.takeProfit1;
  values.smart_bullish_tp2 = smartBullish.takeProfit2;
  values.smart_bullish_tp3 = smartBullish.takeProfit3;
  values.smart_bullish_rr = smartBullish.riskRewardRatio;
  values.smart_bullish_expected_move = smartBullish.expectedMovePercent;
  values.smart_bullish_max_downside = smartBullish.maxDownsidePercent;
  values.smart_bullish_support = smartBullish.nearestSupport;
  values.smart_bullish_resistance = smartBullish.nearestResistance;
  values.smart_bullish_strong_support = smartBullish.strongSupport;
  values.smart_bullish_strong_resistance = smartBullish.strongResistance;
  values.smart_bullish_support_zone_low = smartBullish.supportZone.low;
  values.smart_bullish_support_zone_high = smartBullish.supportZone.high;
  values.smart_bullish_resistance_zone_low = smartBullish.resistanceZone.low;
  values.smart_bullish_resistance_zone_high = smartBullish.resistanceZone.high;
  values.smart_bullish_swing_low = smartBullish.swingLow;
  values.smart_bullish_swing_high = smartBullish.swingHigh;
  values.smart_bullish_atr = smartBullish.atrValue;
  values.smart_bullish_c1_low = smartBullish.candle1Low;
  values.smart_bullish_c1_close = smartBullish.candle1Close;
  values.smart_bullish_c2_low = smartBullish.candle2Low;
  values.smart_bullish_c2_close = smartBullish.candle2Close;
  values.smart_bullish_c3_low = smartBullish.candle3Low;
  values.smart_bullish_c3_close = smartBullish.candle3Close;

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
  values.price_vs_supertrend = supertrend.direction[lastIndex] === 1 ? 'above' : 'below';

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

  // Candlestick Patterns - detect on latest candles
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

  // Also detect patterns one candle back (for confirmation mode)
  const prevCandles = candles.slice(0, -1);
  if (prevCandles.length >= 3) {
    values.doji_prev = patterns.detectDoji(prevCandles);
    values.hammer_prev = patterns.detectHammer(prevCandles);
    values.shooting_star_prev = patterns.detectShootingStar(prevCandles);
    values.bullish_engulfing_prev = patterns.detectBullishEngulfing(prevCandles);
    values.bearish_engulfing_prev = patterns.detectBearishEngulfing(prevCandles);
    values.morning_star_prev = patterns.detectMorningStar(prevCandles);
    values.evening_star_prev = patterns.detectEveningStar(prevCandles);
    values.marubozu_prev = patterns.detectMarubozu(prevCandles);
    values.bullish_harami_prev = patterns.detectBullishHarami(prevCandles);
    values.bearish_harami_prev = patterns.detectBearishHarami(prevCandles);
    values.inverted_hammer_prev = patterns.detectInvertedHammer(prevCandles);
    values.three_white_soldiers_prev = patterns.detectThreeWhiteSoldiers(prevCandles);
    values.three_black_crows_prev = patterns.detectThreeBlackCrows(prevCandles);
    values.inside_bar_prev = patterns.detectInsideBar(prevCandles);
    values.spinning_top_prev = patterns.detectSpinningTop(prevCandles);
  }
  
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
  values.volume_spike = smc.detectVolumeSpike(candles);
  const uptrendDetail = smc.detectUptrendDetail(candles, condition?.trendMinRetracement ?? 25, condition?.trendBosCount ?? 2);
  values.uptrend = uptrendDetail.detected;
  values.uptrend_detail = JSON.stringify(uptrendDetail);
  const downtrendDetail = smc.detectDowntrendDetail(candles, condition?.trendMinRetracement ?? 25, condition?.trendBosCount ?? 2);
  values.downtrend = downtrendDetail.detected;
  values.downtrend_detail = JSON.stringify(downtrendDetail);
  
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
      const rsiArray = values.rsi_array as number[];
      if (typeof rsiValue !== 'number' || isNaN(rsiValue)) return { matched: false, reason: '' };

      // Range check
      const minVal = condition.minValue ?? 0;
      const maxVal = condition.maxValue ?? 100;
      const inRange = rsiValue >= minVal && rsiValue <= maxVal;

      if (!inRange) return { matched: false, reason: '' };

      // Cross direction check
      const crossDir = condition.rsiCrossDirection ?? 'any';
      if (crossDir !== 'any' && Array.isArray(rsiArray) && rsiArray.length >= 2) {
        const prevRsi = rsiArray[rsiArray.length - 2];
        if (typeof prevRsi === 'number' && !isNaN(prevRsi)) {
          if (crossDir === 'from_below') {
            // Previous RSI was below min (entered range from bottom)
            const wasBelow = prevRsi < minVal;
            if (!wasBelow) return { matched: false, reason: '' };
          } else if (crossDir === 'from_above') {
            // Previous RSI was above max (entered range from top)
            const wasAbove = prevRsi > maxVal;
            if (!wasAbove) return { matched: false, reason: '' };
          }
        }
      }

      const dirLabel = crossDir === 'from_below' ? ' ↑ from below' : crossDir === 'from_above' ? ' ↓ from above' : '';
      return { matched: true, reason: `RSI = ${rsiValue.toFixed(2)} (Range: ${minVal}-${maxVal}${dirLabel})` };
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

          // Cross direction check
          if (config.crossEnabled && config.crossDirection) {
            const emaArray = values[`ema_${config.period}_array`] as number[];
            const confirmCandles = config.crossConfirmCandles ?? 0;
            
            if (Array.isArray(emaArray) && lastIndex > confirmCandles) {
              // Find the cross point: look back confirmCandles + 1 candles
              const crossIdx = lastIndex - confirmCandles;
              const prevEma = emaArray[crossIdx - 1];
              const prevPrice = candles[crossIdx - 1].close;
              const crossEma = emaArray[crossIdx];
              const crossPrice = candles[crossIdx].close;
              
              let crossDetected = false;
              let crossDirection = '';
              
              if (config.crossDirection === 'cross_above' || config.crossDirection === 'any') {
                if (prevPrice <= prevEma && crossPrice > crossEma) {
                  crossDetected = true;
                  crossDirection = 'above';
                }
              }
              if (!crossDetected && (config.crossDirection === 'cross_below' || config.crossDirection === 'any')) {
                if (prevPrice >= prevEma && crossPrice < crossEma) {
                  crossDetected = true;
                  crossDirection = 'below';
                }
              }
              
              if (!crossDetected) {
                allMatched = false;
                continue;
              }
              
              // Verify confirmation candles all closed on the correct side
              if (confirmCandles > 0) {
                let confirmed = true;
                for (let i = crossIdx + 1; i <= lastIndex; i++) {
                  const cClose = candles[i].close;
                  const cEma = emaArray[i];
                  if (crossDirection === 'above' && cClose <= cEma) { confirmed = false; break; }
                  if (crossDirection === 'below' && cClose >= cEma) { confirmed = false; break; }
                }
                if (!confirmed) {
                  allMatched = false;
                  continue;
                }
                reasons.push(`Price crossed ${crossDirection} EMA${config.period} + ${confirmCandles} candle${confirmCandles > 1 ? 's' : ''} confirmed`);
              } else {
                reasons.push(`Price crossed ${crossDirection} EMA${config.period} (${(emaValue as number).toFixed(2)})`);
              }
            } else {
              allMatched = false;
              continue;
            }
          } else if (config.pricePosition === 'above') {
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
        const inRange = value >= minVal && value <= maxVal;
        if (!inRange) return { matched: false, reason: '' };

        // ADX cross direction check
        if (condition.feature === 'adx' && condition.adxCrossDirection && condition.adxCrossDirection !== 'any') {
          const adxArr = values.adx_array as number[] | undefined;
          if (adxArr && adxArr.length >= 2) {
            const prevIdx = adxArr.length - 2;
            const prevVal = adxArr[prevIdx];
            if (!isNaN(prevVal)) {
              const wasBelow = prevVal < minVal;
              const wasAbove = prevVal > maxVal;
              if (condition.adxCrossDirection === 'from_below' && !wasBelow) return { matched: false, reason: '' };
              if (condition.adxCrossDirection === 'from_above' && !wasAbove) return { matched: false, reason: '' };
            }
          }
        }

        const dirLabel = condition.feature === 'adx' && condition.adxCrossDirection && condition.adxCrossDirection !== 'any'
          ? ` [${condition.adxCrossDirection === 'from_below' ? '↑ from below' : '↓ from above'}]`
          : '';
        return { matched: true, reason: `${feature.name} = ${value.toFixed(2)} (Range: ${minVal}-${maxVal})${dirLabel}` };
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
      const value = values[condition.feature];
      if (value === true) {
        // For uptrend/downtrend, show detailed swing point and retracement info
        if (condition.feature === 'uptrend' || condition.feature === 'downtrend') {
          const detailKey = condition.feature === 'uptrend' ? 'uptrend_detail' : 'downtrend_detail';
          const detailStr = values[detailKey] as string;
          if (detailStr) {
            try {
              const detail = JSON.parse(detailStr) as import('./smc').TrendDetail;
              const fmt = (v: number) => v >= 1 ? v.toFixed(2) : v.toFixed(6);
              const label = condition.feature === 'uptrend' ? '📈 Uptrend' : '📉 Downtrend';
              const hhll = condition.feature === 'uptrend' ? 'HH/HL' : 'LH/LL';
              
              const swingHighsStr = detail.swingHighs.map(s => fmt(s.price)).join(' → ');
              const swingLowsStr = detail.swingLows.map(s => fmt(s.price)).join(' → ');
              const retStr = detail.retracements.map(r => `${r.percent}%`).join(', ');
              
              return {
                matched: true,
                reason: `${label} (${hhll}) | BOS: ${detail.bosCount} | Highs: ${swingHighsStr} | Lows: ${swingLowsStr} | Pullback: ${retStr}`,
              };
            } catch {}
          }
        }
        return { matched: true, reason: `${feature.name} detected` };
      }
      return { matched: false, reason: '' };
    }

    case 'supertrend': {
      const stValue = values.supertrend;
      const stDir = values.supertrend_direction as number;
      const stPrevDir = values.supertrend_prev_direction as number;
      if (typeof stValue !== 'number' || isNaN(stValue)) return { matched: false, reason: '' };

      if (condition.crossType === 'crossover') {
        // Flip from bearish to bullish
        if (stDir === 1 && stPrevDir === -1) {
          return { matched: true, reason: `Supertrend flipped Bullish (${stValue.toFixed(2)})` };
        }
      } else if (condition.crossType === 'crossunder') {
        // Flip from bullish to bearish
        if (stDir === -1 && stPrevDir === 1) {
          return { matched: true, reason: `Supertrend flipped Bearish (${stValue.toFixed(2)})` };
        }
      } else if (condition.pricePosition === 'above') {
        if (stDir === 1) {
          return { matched: true, reason: `Price above Supertrend (${stValue.toFixed(2)})` };
        }
      } else if (condition.pricePosition === 'below') {
        if (stDir === -1) {
          return { matched: true, reason: `Price below Supertrend (${stValue.toFixed(2)})` };
        }
      }
      return { matched: false, reason: '' };
    }

    case 'fibonacci': {
      const price = values.price as number;
      const fibLevel = condition.fibLevel ?? '0.618';
      const proximity = condition.fibProximityPercent ?? 1;
      const fibTrend = values.fib_trend as string;

      // Map level string to stored value key
      const levelKeyMap: Record<string, string> = {
        '0': 'fib_level_0',
        '0.236': 'fib_level_0236',
        '0.382': 'fib_level_0382',
        '0.5': 'fib_level_05',
        '0.618': 'fib_level_0618',
        '0.786': 'fib_level_0786',
        '1': 'fib_level_1',
      };

      const levelValue = values[levelKeyMap[fibLevel] ?? 'fib_level_0618'] as number;
      if (typeof levelValue !== 'number' || isNaN(levelValue)) return { matched: false, reason: '' };

      const distance = Math.abs(price - levelValue) / price * 100;
      const isNear = distance <= proximity;

      if (!isNear) return { matched: false, reason: '' };

      // Check price position filter
      if (condition.pricePosition === 'above' && price < levelValue) return { matched: false, reason: '' };
      if (condition.pricePosition === 'below' && price > levelValue) return { matched: false, reason: '' };

      const levelPercent = (parseFloat(fibLevel) * 100).toFixed(1);
      return {
        matched: true,
        reason: `Price near Fib ${levelPercent}% (${levelValue.toFixed(2)}) [${fibTrend}trend, dist: ${distance.toFixed(2)}%]`,
      };
    }

    case 'smart-bullish': {
      const patternFound = values.smart_bullish_pattern_found;
      if (!patternFound) return { matched: false, reason: '' };

      const score = values.smart_bullish as number;
      const threshold = condition.smartBullishThreshold ?? 60;
      if (score < threshold) return { matched: false, reason: '' };

      const signal = values.smart_bullish_signal as string;
      const entry = values.smart_bullish_entry as number;
      const sl = values.smart_bullish_sl as number;
      const tp1 = values.smart_bullish_tp1 as number;
      const tp2 = values.smart_bullish_tp2 as number;
      const tp3 = values.smart_bullish_tp3 as number;
      const rr = values.smart_bullish_rr as number;
      const expMove = values.smart_bullish_expected_move as number;
      const maxDown = values.smart_bullish_max_downside as number;
      const support = values.smart_bullish_support as number;
      const resistance = values.smart_bullish_resistance as number;

      const signalLabel = signal === 'strong_buy' ? '🟢 STRONG BUY' : signal === 'buy' ? '🟡 BUY' : '⚪ NEUTRAL';
      const fmt = (v: number) => v >= 1 ? v.toFixed(2) : v.toFixed(6);
      return {
        matched: true,
        reason: `🔻 3-Candle Bottom ${signalLabel} (${score}/100) | Entry: ${fmt(entry)} | SL: ${fmt(sl)} (-${maxDown}%) | TP1: ${fmt(tp1)} | TP2: ${fmt(tp2)} (+${expMove}%) | TP3: ${fmt(tp3)} | R:R ${rr} | S: ${fmt(support)} | R: ${fmt(resistance)}`,
      };
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
  
  // Supertrend
  if (values.supertrend_direction === 1) bullishScore++;
  if (values.supertrend_direction === -1) bearishScore++;
  
  return bullishScore >= bearishScore;
}
